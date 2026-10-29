import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

const MAX_ATTEMPTS = 10;

export type StockLine = { productId: number; qty: number };

@Injectable()
export class InventoryService {
    /** Trừ kho cho các món (productId -> tổng số lượng). Gọi bên trong một giao dịch. */
    async reserve(tx: Prisma.TransactionClient, needs: Map<number, number>) {
        // Luôn xử lý theo thứ tự id tăng dần để các giao dịch không khóa chéo nhau.
        const ids = [...needs.keys()].sort((a, b) => a - b);
        for (const productId of ids) {
            await this.reserveOne(tx, productId, needs.get(productId) as number);
        }
    }

    /** Hoàn kho (khi hủy đơn). Gọi bên trong một giao dịch. */
    async release(tx: Prisma.TransactionClient, lines: StockLine[]) {
        const totals = new Map<number, number>();
        for (const l of lines) {
            totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.qty);
        }
        const ids = [...totals.keys()].sort((a, b) => a - b);
        for (const productId of ids) {
            await tx.product.updateMany({
                where: { id: productId },
                data: {
                    stock: { increment: totals.get(productId) as number },
                    version: { increment: 1 },
                },
            });
        }
    }

    private async reserveOne(
        tx: Prisma.TransactionClient,
        productId: number,
        qty: number,
    ) {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const product = await tx.product.findUnique({
                where: { id: productId },
                select: { name: true, stock: true, version: true },
            });
            if (!product) {
                throw new BadRequestException(`Sản phẩm #${productId} không tồn tại`);
            }
            if (product.stock < qty) {
                throw new ConflictException(
                    `${product.name} chỉ còn ${product.stock} phần`,
                );
            }

            const updated = await tx.product.updateMany({
                where: { id: productId, version: product.version, stock: { gte: qty } },
                data: { stock: { decrement: qty }, version: { increment: 1 } },
            });
            if (updated.count === 1) return;
            // count = 0: có giao dịch khác vừa đổi dòng này, đọc lại và thử lại.
        }
        throw new ConflictException('Hệ thống đang bận, vui lòng thử lại');
    }
}