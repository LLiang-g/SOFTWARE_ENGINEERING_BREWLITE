import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SIZE_EXTRA, TOPPINGS } from '../common/pricing';
import { calcServings } from './availability';

const PRODUCT_SELECT = {
    id: true,
    name: true,
    price: true,
    imageUrl: true,
    recipes: {
        select: { quantity: true, ingredient: { select: { stock: true } } },
    },
} as const;

type ProductRow = {
    recipes: { quantity: number; ingredient: { stock: number } }[];
};

// Số ly còn lại không lưu trong database: tính từ kho nguyên liệu theo công thức.
function withAvailable<T extends ProductRow>({ recipes, ...product }: T) {
    return {
        ...product,
        available: calcServings(
            recipes.map((r) => ({ quantity: r.quantity, stock: r.ingredient.stock })),
        ),
    };
}

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        const products = await this.prisma.product.findMany({
            select: PRODUCT_SELECT,
            orderBy: { id: 'asc' },
        });
        return products.map(withAvailable);
    }

    async findOne(id: number) {
        const row = await this.prisma.product.findUnique({
            where: { id },
            select: PRODUCT_SELECT,
        });
        if (!row) {
            throw new NotFoundException('Không tìm thấy sản phẩm');
        }

        return {
            ...withAvailable(row),
            options: {
                sizes: Object.entries(SIZE_EXTRA).map(([code, extra]) => ({
                    code,
                    extra,
                })),
                toppings: TOPPINGS,
            },
        };
    }
}
