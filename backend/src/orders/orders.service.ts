import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TOPPINGS, calcUnitPrice } from '../common/pricing';
import { CreateOrderDto } from './dto/create-order.dto';

const ORDER_INCLUDE = {
    items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true } } },
    },
} as const;

type OrderWithItems = NonNullable<Awaited<ReturnType<OrdersService['loadOrder']>>>;

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) {}

    async create(userId: number, dto: CreateOrderDto) {
        const productIds = [...new Set(dto.items.map((i) => i.productId))];
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        const lines = dto.items.map((item) => {
            const product = byId.get(item.productId);
            if (!product) {
                throw new BadRequestException(
                    `Sản phẩm #${item.productId} không tồn tại`,
                );
            }
            const toppings = item.toppings ?? [];
            const unitPrice = calcUnitPrice(product.price, item.size, toppings);
            return {
                productId: item.productId,
                size: item.size,
                toppings,
                qty: item.qty,
                lineTotal: unitPrice * item.qty,
            };
        });

        const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

        const order = await this.prisma.order.create({
            data: { userId, total, items: { create: lines } },
            include: ORDER_INCLUDE,
        });
        return this.toResponse(order);
    }

    async findOne(userId: number, id: number) {
        const order = await this.loadOrder(id);
        if (!order || order.userId !== userId) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }
        return this.toResponse(order);
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