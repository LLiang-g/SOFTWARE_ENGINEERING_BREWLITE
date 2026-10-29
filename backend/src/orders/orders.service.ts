import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TOPPINGS, calcUnitPrice } from '../common/pricing';
import { InventoryService } from '../products/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { assertTransition } from './order-state-machine';

const ORDER_INCLUDE = {
    items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true } } },
    },
} as const;

type OrderWithItems = NonNullable<
    Awaited<ReturnType<OrdersService['loadOrder']>>
>;

@Injectable()
export class OrdersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventory: InventoryService,
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

                // Trừ kho và tạo đơn nằm chung một giao dịch: lỗi ở đâu thì hoàn tác tất cả.
                await this.inventory.reserve(tx, needs);

                const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
                return tx.order.create({
                    data: { userId, total, items: { create: lines } },
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

        return this.findOne(userId, id);
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