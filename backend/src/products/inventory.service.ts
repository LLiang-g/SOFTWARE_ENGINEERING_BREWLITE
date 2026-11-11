import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { TOPPINGS, type SizeCode } from '../common/pricing';
import { calcServings, usagePerServing } from './availability';

/** Một dòng của đơn: món, size, topping và số ly. */
export type StockLine = {
    productId: number;
    qty: number;
    size: SizeCode;
    toppings: string[];
};

type DrinkRecipe = { ingredientId: number; quantity: number; scalesWithSize: boolean };
type ToppingRecipeRow = { toppingCode: string; ingredientId: number; quantity: number };
type ProductRow = { id: number; name: string; recipes: DrinkRecipe[] };

@Injectable()
export class InventoryService {
    /**
     * Trừ nguyên liệu cho các dòng của đơn. Gọi bên trong một giao dịch.
     * Cộng nhu cầu của cả đơn, khóa các dòng nguyên liệu theo thứ tự id,
     * kiểm tra đủ hàng rồi mới trừ.
     */
    async reserve(tx: Prisma.TransactionClient, lines: StockLine[]) {
        const { productById, toppingRecipes } = await this.load(tx, lines);
        const demand = this.demandFor(lines, productById, toppingRecipes, true);

        // Luôn khóa theo id tăng dần để các giao dịch không khóa chéo nhau.
        const ids = [...demand.keys()].sort((a, b) => a - b);
        const rows = await tx.$queryRaw<{ id: number; stock: number }[]>`
            SELECT id, stock FROM "Ingredient"
            WHERE id IN (${Prisma.join(ids)})
            ORDER BY id
            FOR UPDATE`;
        const stockById = new Map(rows.map((r) => [r.id, r.stock]));

        for (const id of ids) {
            if ((stockById.get(id) ?? 0) < (demand.get(id) as number)) {
                throw this.shortage(id, lines, productById, toppingRecipes, stockById);
            }
        }

        for (const id of ids) {
            await tx.ingredient.update({
                where: { id },
                data: { stock: { decrement: demand.get(id) as number } },
            });
        }
    }

    /** Hoàn nguyên liệu (khi hủy đơn) theo đúng size và topping của từng dòng. */
    async release(tx: Prisma.TransactionClient, lines: StockLine[]) {
        const { productById, toppingRecipes } = await this.load(tx, lines);
        const restore = this.demandFor(lines, productById, toppingRecipes, false);

        for (const id of [...restore.keys()].sort((a, b) => a - b)) {
            await tx.ingredient.updateMany({
                where: { id },
                data: { stock: { increment: restore.get(id) as number } },
            });
        }
    }

    private async load(tx: Prisma.TransactionClient, lines: StockLine[]) {
        const productIds = [...new Set(lines.map((l) => l.productId))];
        const toppingCodes = [...new Set(lines.flatMap((l) => l.toppings))];

        const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                recipes: {
                    select: { ingredientId: true, quantity: true, scalesWithSize: true },
                },
            },
        });
        const toppingRecipes =
            toppingCodes.length === 0
                ? []
                : await tx.toppingRecipe.findMany({
                      where: { toppingCode: { in: toppingCodes } },
                      select: { toppingCode: true, ingredientId: true, quantity: true },
                  });

        return {
            productById: new Map<number, ProductRow>(products.map((p) => [p.id, p])),
            toppingRecipes,
        };
    }

    /**
     * Tổng nguyên liệu cần cho các dòng (ingredientId -> lượng).
     * strict = true khi đặt hàng: món không tồn tại hoặc chưa có công thức thì báo lỗi.
     * strict = false khi hoàn kho: bỏ qua món đã mất công thức.
     */
    private demandFor(
        lines: StockLine[],
        productById: Map<number, ProductRow>,
        toppingRecipes: ToppingRecipeRow[],
        strict: boolean,
    ) {
        const demand = new Map<number, number>();
        const add = (ingredientId: number, amount: number) =>
            demand.set(ingredientId, (demand.get(ingredientId) ?? 0) + amount);

        for (const line of lines) {
            const product = productById.get(line.productId);
            if (!product) {
                if (strict) {
                    throw new BadRequestException(`Sản phẩm #${line.productId} không tồn tại`);
                }
                continue;
            }
            if (product.recipes.length === 0 && strict) {
                throw new ConflictException(
                    `${product.name} chưa có công thức nên chưa bán được`,
                );
            }
            for (const r of product.recipes) {
                add(r.ingredientId, usagePerServing(r.quantity, r.scalesWithSize, line.size) * line.qty);
            }
            for (const code of line.toppings) {
                for (const t of toppingRecipes) {
                    if (t.toppingCode === code) add(t.ingredientId, t.quantity * line.qty);
                }
            }
        }
        return demand;
    }

    /**
     * Báo lỗi theo món hoặc topping bị thiếu, ví dụ "Cà phê sữa chỉ còn 2 phần".
     * Số phần còn lại tính từ kho hiện tại, theo size của dòng đang đặt.
     */
    private shortage(
        ingredientId: number,
        lines: StockLine[],
        productById: Map<number, ProductRow>,
        toppingRecipes: ToppingRecipeRow[],
        stockById: Map<number, number>,
    ) {
        const stockOf = (id: number) => stockById.get(id) ?? 0;
        const candidates: { name: string; left: number }[] = [];

        const seenProducts = new Set<string>();
        for (const line of lines) {
            const product = productById.get(line.productId);
            const key = `${line.productId}:${line.size}`;
            if (!product || seenProducts.has(key)) continue;
            if (!product.recipes.some((r) => r.ingredientId === ingredientId)) continue;
            seenProducts.add(key);
            candidates.push({
                name: product.name,
                left: calcServings(
                    product.recipes.map((r) => ({
                        quantity: r.quantity,
                        scalesWithSize: r.scalesWithSize,
                        stock: stockOf(r.ingredientId),
                    })),
                    line.size,
                ),
            });
        }

        for (const code of new Set(lines.flatMap((l) => l.toppings))) {
            const rows = toppingRecipes.filter((t) => t.toppingCode === code);
            if (!rows.some((t) => t.ingredientId === ingredientId)) continue;
            const name = TOPPINGS.find((t) => t.code === code)?.name ?? code;
            candidates.push({
                name: `Topping ${name}`,
                left: calcServings(
                    rows.map((t) => ({
                        quantity: t.quantity,
                        scalesWithSize: false,
                        stock: stockOf(t.ingredientId),
                    })),
                ),
            });
        }

        const worst = [...candidates].sort((a, b) => a.left - b.left)[0];
        return new ConflictException(
            worst ? `${worst.name} chỉ còn ${worst.left} phần` : 'Không đủ nguyên liệu',
        );
    }
}
