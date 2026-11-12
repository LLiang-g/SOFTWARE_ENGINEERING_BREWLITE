import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SIZE_EXTRA, TOPPINGS, type SizeCode } from '../common/pricing';
import { ingredientDemand, availableFor } from './ingredient-demand';

const PRODUCT_SELECT = {
    id: true, name: true, price: true, imageUrl: true,
    recipes: { select: { ingredientId: true, quantity: true, scalesWithSize: true,
        ingredient: { select: { stock: true } } } },
} as const;

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) {}

    private async views(id?: number) {
        // Một ảnh chụp nhất quán cho kho món và topping dùng chung nguyên liệu.
        return this.prisma.$transaction(async (tx) => {
            const products = await tx.product.findMany({ where: id === undefined ? {} : { id },
                select: PRODUCT_SELECT, orderBy: { id: 'asc' } });
            const toppings = await tx.toppingRecipe.findMany({
                include: { ingredient: { select: { stock: true } } },
            });
            return products.map(({ recipes, ...product }) => {
                const stocks = new Map([...recipes, ...toppings].map((line) => [line.ingredientId, line.ingredient.stock]));
                const selections: string[][] = [[]];
                // TOPPINGS hiện có hai mã: sinh mọi tổ hợp để kiểm tra nguyên liệu dùng chung.
                for (const topping of TOPPINGS) selections.push(...selections.map((set) => [...set, topping.code]));
                const availability = (Object.keys(SIZE_EXTRA) as SizeCode[]).flatMap((size) => selections.map((codes) => {
                    let available = 0;
                    try {
                        available = availableFor(ingredientDemand([{ productId: product.id, size, qty: 1, toppings: codes }],
                            [{ ...product, recipes }], toppings), stocks);
                    } catch { /* Thiếu công thức: không cho bán lựa chọn này. */ }
                    return { size, toppings: codes, available };
                }));
                return { ...product, available: availability[0].available, availability };
            });
        }, { isolationLevel: 'RepeatableRead' });
    }
    findAll() { return this.views(); }
    async findOne(id: number) {
        const [product] = await this.views(id);
        if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
        return { ...product, options: { sizes: Object.entries(SIZE_EXTRA).map(([code, extra]) => ({ code, extra })), toppings: TOPPINGS } };
    }
}
