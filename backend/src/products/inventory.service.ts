import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { calcServings } from './availability';

export type ReservedIngredient = { ingredientId: number; quantity: number };

type Recipe = { ingredientId: number; quantity: number };

@Injectable()
export class InventoryService {
    /**
     * Trừ nguyên liệu cho các món (productId -> tổng số ly). Gọi bên trong một giao dịch.
     * Khóa các dòng nguyên liệu theo thứ tự id, kiểm tra đủ hàng rồi mới trừ.
     */
    async reserve(
        tx: Prisma.TransactionClient,
        needs: Map<number, number>,
    ): Promise<ReservedIngredient[]> {
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
        // Lưu chính lượng vừa trừ, không đọc công thức thêm lần nữa để tạo snapshot.
        return ids.map((ingredientId) => ({
            ingredientId,
            quantity: demand.get(ingredientId) as number,
        }));
    }

    /** Hoàn đúng snapshot đã giữ; trạng thái hủy, kho và dấu hoàn phải cùng commit. */
    async release(tx: Prisma.TransactionClient, orderId: number) {
        const reservations = await tx.$queryRaw<{
            ingredientId: number;
            quantity: number;
            releasedAt: Date | null;
        }[]>`
            SELECT "ingredientId", quantity, "releasedAt"
            FROM "OrderInventoryReservation"
            WHERE "orderId" = ${orderId}
            ORDER BY "ingredientId"
            FOR UPDATE`;

        if (reservations.length === 0) {
            // Đơn cũ không có bằng chứng lượng đã trừ. Không suy ngược từ Recipe.
            throw new ConflictException(
                'Đơn chưa có dữ liệu giữ nguyên liệu, cần nhân viên đối soát trước khi hủy',
            );
        }
        if (reservations.some((row) => row.releasedAt !== null)) {
            throw new ConflictException('Nguyên liệu của đơn đã được hoàn');
        }

        for (const row of reservations) {
            await tx.ingredient.update({
                where: { id: row.ingredientId },
                data: { stock: { increment: row.quantity } },
            });
        }
        await tx.orderInventoryReservation.updateMany({
            where: { orderId },
            data: { releasedAt: new Date() },
        });
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
