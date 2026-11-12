import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TOPPINGS, calcUnitPrice } from '../common/pricing';
import { InventoryService } from '../products/inventory.service';
import { PromotionsService } from '../promotions/promotions.service';
import { calcDiscount, calcPoints } from '../promotions/discount';
import { CreateOrderDto } from './dto/create-order.dto';
import { assertTransition } from './order-state-machine';
import { OrdersGateway } from '../realtime/orders.gateway';
import type { UpdateStaffOrderStatusDto } from './dto/update-staff-order-status.dto';
import { createHash } from 'node:crypto';

const ORDER_INCLUDE = {
    items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true } } },
    },
    voucher: { select: { code: true } },
} as const;

const PAID_STATUSES: string[] = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];

type OrderWithItems = NonNullable<
    Awaited<ReturnType<OrdersService['loadOrder']>>
>;

@Injectable()
export class OrdersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventory: InventoryService,
        private readonly promotions: PromotionsService,
        private readonly events: OrdersGateway,
    ) {}

    async create(userId: number, dto: CreateOrderDto, idempotencyKey: string) {
        // Hash nội dung nghiệp vụ đã validate, không hash giá do client gửi.
        const requestHash = createHash('sha256').update(JSON.stringify({
            items: dto.items.map((item) => ({
                productId: item.productId,
                size: item.size,
                toppings: [...(item.toppings ?? [])].sort(),
                qty: item.qty,
            })),
            voucherCode: dto.voucherCode?.trim().toUpperCase() || null,
        })).digest('hex');
        const replay = await this.findCreateReplay(userId, idempotencyKey, requestHash);
        if (replay) return replay;

        try {
            const order = await this.prisma.$transaction(
            async (tx) => {
                // Tranh quyền sở hữu key TRƯỚC khi đụng đến kho.
                // Unique constraint buộc yêu cầu cùng key phải chờ giao dịch đầu.
                await tx.orderCreateRequest.create({
                    data: { userId, idempotencyKey, requestHash },
                });
                const productIds = [...new Set(dto.items.map((i) => i.productId))];
                const products = await tx.product.findMany({
                    where: { id: { in: productIds } },
                });
                const byId = new Map(products.map((p) => [p.id, p]));

                const needs = new Map<number, number>();
                const lines = dto.items.map((item) => {
                    const product = byId.get(item.productId);
                    if (!product) {
                        throw new BadRequestException(
                            `Sản phẩm #${item.productId} không tồn tại`,
                        );
                    }
                    const toppings = item.toppings ?? [];
                    const unitPrice = calcUnitPrice(product.price, item.size, toppings);
                    needs.set(item.productId, (needs.get(item.productId) ?? 0) + item.qty);
                    return {
                        productId: item.productId,
                        size: item.size,
                        toppings,
                        qty: item.qty,
                        lineTotal: unitPrice * item.qty,
                    };
                });

                const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

                // Kiểm tra mã giảm giá trước khi đụng tới kho: mã sai thì không trừ kho.
                let discount = 0;
                let voucherId: number | undefined;
                const code = dto.voucherCode?.trim();
                if (code) {
                    const voucher = await this.promotions.findValid(code, tx);
                    discount = calcDiscount(subtotal, voucher.discountPercent);
                    voucherId = voucher.id;
                }

                // Trừ kho và tạo đơn nằm chung một giao dịch: lỗi ở đâu thì hoàn tác tất cả.
                const reservations = await this.inventory.reserve(tx, needs);

                const created = await tx.order.create({
                    data: {
                        userId,
                        total: subtotal - discount,
                        discount,
                        voucherId,
                        items: { create: lines },
                        inventoryReservations: { create: reservations },
                    },
                    include: ORDER_INCLUDE,
                });
                await tx.orderCreateRequest.update({
                    where: { userId_idempotencyKey: { userId, idempotencyKey } },
                    data: { orderId: created.id },
                });
                return created;
            },
            { maxWait: 10000, timeout: 20000 },
        );
            return this.toResponse(order);
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                // PostgreSQL transaction đã lỗi phải được rollback trước khi đọc lại.
                const again = await this.findCreateReplay(userId, idempotencyKey, requestHash);
                if (again) return again;
            }
            throw error;
        }
    }

    private async findCreateReplay(userId: number, idempotencyKey: string, requestHash: string) {
        const existing = await this.prisma.orderCreateRequest.findUnique({
            where: { userId_idempotencyKey: { userId, idempotencyKey } },
            include: { order: { include: ORDER_INCLUDE } },
        });
        if (!existing) return null;
        if (existing.requestHash !== requestHash) {
            throw new ConflictException('Idempotency-Key đã được dùng cho nội dung đặt hàng khác');
        }
        if (!existing.order) {
            throw new ConflictException('Yêu cầu đặt hàng chưa có kết quả, vui lòng thử lại cùng key');
        }
        // Trả chính đơn cũ ở trạng thái hiện tại, không tạo đơn khác dù đã hủy/đã trả tiền.
        return this.toResponse(existing.order);
    }

    async findOne(userId: number, id: number) {
        const order = await this.loadOrder(id);
        if (!order || order.userId !== userId) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }
        return this.toResponse(order);
    }

    async findByUser(userId: number) {
        const orders = await this.prisma.order.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: ORDER_INCLUDE,
            take: 50,
        });
        return orders.map((order) => this.toResponse(order));
    }

    async cancel(userId: number, id: number) {
        const order = await this.loadOrder(id);
        if (!order || order.userId !== userId) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }

        // Hủy tự phục vụ chỉ áp dụng cho đơn chưa thanh toán.
        // Đơn đã trả tiền cần quy trình hoàn tiền riêng trước khi hoàn kho.
        if (order.creditApplied > 0) throw new ConflictException('Đơn đổi món đã sử dụng tiền cũ, không được tự hủy');
        if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
            throw new ConflictException('Chỉ có thể hủy đơn chưa thanh toán');
        }
        assertTransition(order.status, 'CANCELLED');

        await this.prisma.$transaction(async (tx) => {
            // Đồng bộ với start/settle VNPay: không hoàn kho khi tiền còn có thể về.
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
            if (await tx.vnpayAttempt.findFirst({ where: { orderId: id, status: { in: ['PENDING', 'REVIEW'] } } })) {
                throw new ConflictException('Giao dịch thanh toán đang cần xác minh, chưa thể hủy đơn');
            }
            const result = await tx.order.updateMany({
                where: { id, status: order.status },
                data: { status: 'CANCELLED' },
            });
            if (result.count === 0) {
                throw new ConflictException(
                    'Trạng thái đơn vừa thay đổi, vui lòng thử lại',
                );
            }
            // Chỉ hoàn kho khi chính giao dịch này đổi được trạng thái: hủy hai lần không hoàn hai lần.
            await this.inventory.release(tx, id);
        });

        this.events.notifyOrdersChanged();
        return this.findOne(userId, id);
    }

    async findForStaff() {
        // Cùng một ảnh chụp dữ liệu, tránh mất/lặp đơn vừa chuyển sang COMPLETED.
        const [active, completed] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                where: { status: { in: ['PAID', 'PREPARING', 'READY'] } },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                include: ORDER_INCLUDE,
            }),
            this.prisma.order.findMany({
                where: { status: 'COMPLETED' },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: 20,
                include: ORDER_INCLUDE,
            }),
        ], { isolationLevel: 'RepeatableRead' });
        return [...active, ...completed].map((order) => this.toResponse(order));
    }

    async updateStaffStatus(id: number, status: UpdateStaffOrderStatusDto['status']) {
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
            const order = await tx.order.findUnique({ where: { id } });
            if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
            if (!['PAID', 'PREPARING', 'READY'].includes(order.status)) {
                throw new ConflictException('Chỉ xử lý đơn đã thanh toán và chưa hoàn tất');
            }
            assertTransition(order.status, status);

            // Hai nhân viên cùng thao tác: chỉ người còn đúng trạng thái cũ mới ghi được.
            const result = await tx.order.updateMany({
                where: { id, status: order.status },
                data: { status },
            });
            if (result.count === 0) {
                throw new ConflictException('Đơn vừa được cập nhật ở màn hình khác, vui lòng tải lại');
            }
            return tx.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
        });
        this.events.notifyOrdersChanged();
        return this.toResponse(updated);
    }

    loadOrder(id: number) {
        return this.prisma.order.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
    }

    private toResponse(order: OrderWithItems) {
        return {
            id: order.id,
            status: order.status,
            total: order.total,
            creditApplied: order.creditApplied,
            amountDue: Math.max(0, order.total - order.creditApplied),
            discount: order.discount,
            voucherCode: order.voucher?.code ?? null,
            pointsEarned: PAID_STATUSES.includes(order.status)
                ? calcPoints(order.total - order.creditApplied)
                : 0,
            createdAt: order.createdAt,
            items: order.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                name: i.product.name,
                size: i.size,
                toppings: i.toppings,
                toppingNames: i.toppings.map(
                    (code) => TOPPINGS.find((t) => t.code === code)?.name ?? code,
                ),
                qty: i.qty,
                lineTotal: i.lineTotal,
            })),
        };
    }
}
