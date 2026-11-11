import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SIZE_EXTRA, TOPPINGS } from '../common/pricing';
import { calcServings, calcServingsBySize } from './availability';

const PRODUCT_SELECT = {
    id: true,
    name: true,
    price: true,
    imageUrl: true,
    recipes: {
        select: {
            quantity: true,
            scalesWithSize: true,
            ingredient: { select: { stock: true } },
        },
    },
} as const;

type ProductRow = {
    recipes: {
        quantity: number;
        scalesWithSize: boolean;
        ingredient: { stock: number };
    }[];
};

// Số ly còn lại không lưu trong database: tính từ kho nguyên liệu theo công thức.
// available là số ly size S (nhiều nhất), availableBySize cho từng size.
function withAvailable<T extends ProductRow>({ recipes, ...product }: T) {
    const availableBySize = calcServingsBySize(
        recipes.map((r) => ({
            quantity: r.quantity,
            scalesWithSize: r.scalesWithSize,
            stock: r.ingredient.stock,
        })),
    );
    return { ...product, available: availableBySize.S, availableBySize };
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

        const toppingRecipes = await this.prisma.toppingRecipe.findMany({
            select: {
                toppingCode: true,
                quantity: true,
                ingredient: { select: { stock: true } },
            },
        });

        return {
            ...withAvailable(row),
            options: {
                sizes: Object.entries(SIZE_EXTRA).map(([code, extra]) => ({
                    code,
                    extra,
                })),
                // available = null: topping chưa khai báo nguyên liệu nên không theo dõi kho.
                toppings: TOPPINGS.map((topping) => {
                    const lines = toppingRecipes.filter((r) => r.toppingCode === topping.code);
                    return {
                        ...topping,
                        available:
                            lines.length === 0
                                ? null
                                : calcServings(
                                      lines.map((r) => ({
                                          quantity: r.quantity,
                                          scalesWithSize: false,
                                          stock: r.ingredient.stock,
                                      })),
                                  ),
                    };
                }),
            },
        };
    }
}
