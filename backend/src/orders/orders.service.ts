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

    async create(userId: number, dto: CreateOrderDto) {
        const order = await this.prisma.$transaction(
            async (tx) => {
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
                await this.inventory.reserve(tx, needs);

                return tx.order.create({
                    data: {
                        userId,
                        total: subtotal - discount,
                        discount,
                        voucherId,
                        items: { create: lines },
                    },
                    include: ORDER_INCLUDE,
                });
            },
            { maxWait: 10000, timeout: 20000 },
        );
        return this.toResponse(order);
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

        assertTransition(order.status, 'CANCELLED');

        await this.prisma.$transaction(async (tx) => {
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
            await this.inventory.release(
                tx,
                order.items.map((i) => ({ productId: i.productId, qty: i.qty })),
            );
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
            discount: order.discount,
            voucherCode: order.voucher?.code ?? null,
            pointsEarned: PAID_STATUSES.includes(order.status)
                ? calcPoints(order.total)
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
