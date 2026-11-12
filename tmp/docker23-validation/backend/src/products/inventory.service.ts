import {
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ingredientDemand, type InventoryItem } from './ingredient-demand';

export type ReservedIngredient = { ingredientId: number; quantity: number };


@Injectable()
export class InventoryService {
    /**
     * Trừ nguyên liệu cho các món (productId -> tổng số ly). Gọi bên trong một giao dịch.
     * Khóa các dòng nguyên liệu theo thứ tự id, kiểm tra đủ hàng rồi mới trừ.
     */
    async reserve(
        tx: Prisma.TransactionClient,
        items: InventoryItem[],
    ): Promise<ReservedIngredient[]> {
        const products = await tx.product.findMany({
            where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
            select: {
                id: true,
                name: true,
                recipes: { select: { ingredientId: true, quantity: true, scalesWithSize: true } },
            },
        });
        const toppingRecipes = await tx.toppingRecipe.findMany({
            where: { toppingCode: { in: [...new Set(items.flatMap((item) => item.toppings ?? []))] } },
        });
        const demand = ingredientDemand(items, products, toppingRecipes);

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
                throw new ConflictException('Không đủ nguyên liệu cho size/topping đã chọn, vui lòng chọn lại món');
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

}
