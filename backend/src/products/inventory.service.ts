import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { calcServings } from './availability';

export type StockLine = { productId: number; qty: number };

type Recipe = { ingredientId: number; quantity: number };

@Injectable()
export class InventoryService {
    /**
     * Trừ nguyên liệu cho các món (productId -> tổng số ly). Gọi bên trong một giao dịch.
     * Khóa các dòng nguyên liệu theo thứ tự id, kiểm tra đủ hàng rồi mới trừ.
     */
    async reserve(tx: Prisma.TransactionClient, needs: Map<number, number>) {
        const products = await tx.product.findMany({
            where: { id: { in: [...needs.keys()] } },
            select: {
                id: true,
                name: true,
                recipes: { select: { ingredientId: true, quantity: true } },
            },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        const demand = new Map<number, number>();
        for (const productId of [...needs.keys()].sort((a, b) => a - b)) {
            const product = byId.get(productId);
            if (!product) {
                throw new BadRequestException(`Sản phẩm #${productId} không tồn tại`);
            }
            if (product.recipes.length === 0) {
                throw new ConflictException(
                    `${product.name} chưa có công thức nên chưa bán được`,
                );
            }
            const qty = needs.get(productId) as number;
            for (const line of product.recipes) {
                demand.set(
                    line.ingredientId,
                    (demand.get(line.ingredientId) ?? 0) + line.quantity * qty,
                );
            }
        }

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
                throw this.shortage(id, products, stockById);
            }
        }

        for (const id of ids) {
            await tx.ingredient.update({
                where: { id },
                data: { stock: { decrement: demand.get(id) as number } },
            });
        }
    }

    /** Hoàn nguyên liệu (khi hủy đơn). Gọi bên trong một giao dịch. */
    async release(tx: Prisma.TransactionClient, lines: StockLine[]) {
        const totals = new Map<number, number>();
        for (const l of lines) {
            totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.qty);
        }

        const recipes = await tx.recipe.findMany({
            where: { productId: { in: [...totals.keys()] } },
            select: { productId: true, ingredientId: true, quantity: true },
        });
        const restore = new Map<number, number>();
        for (const r of recipes) {
            const amount = r.quantity * (totals.get(r.productId) as number);
            restore.set(r.ingredientId, (restore.get(r.ingredientId) ?? 0) + amount);
        }

        const ids = [...restore.keys()].sort((a, b) => a - b);
        for (const id of ids) {
            await tx.ingredient.updateMany({
                where: { id },
                data: { stock: { increment: restore.get(id) as number } },
            });
        }
    }

    /** Báo lỗi theo món bị thiếu: "<món> chỉ còn N phần", N tính từ kho hiện tại. */
    private shortage(
        ingredientId: number,
        products: { id: number; name: string; recipes: Recipe[] }[],
        stockById: Map<number, number>,
    ) {
        const affected = products
            .filter((p) => p.recipes.some((r) => r.ingredientId === ingredientId))
            .map((p) => ({
                name: p.name,
                left: calcServings(
                    p.recipes.map((r) => ({
                        quantity: r.quantity,
                        stock: stockById.get(r.ingredientId) ?? 0,
                    })),
                ),
            }))
            .sort((a, b) => a.left - b.left);
        const worst = affected[0];
        return new ConflictException(`${worst.name} chỉ còn ${worst.left} phần`);
    }
}
