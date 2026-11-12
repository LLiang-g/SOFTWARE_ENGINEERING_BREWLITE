import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { calcPoints } from './discount';

@Injectable()
export class LoyaltyService {
    /**
     * Cộng điểm cho khách theo số tiền đã trả và ghi một dòng vào sổ cái.
     * Gọi bên trong giao dịch thanh toán, nên lỗi ở đâu cũng rollback cả hai.
     */
    async award(
        tx: Prisma.TransactionClient,
        userId: number,
        amount: number,
        orderId: number,
    ): Promise<number> {
        const points = calcPoints(amount);
        if (points > 0) {
            const user = await tx.user.update({
                where: { id: userId },
                data: { loyaltyPoints: { increment: points } },
                select: { loyaltyPoints: true },
            });
            await tx.loyaltyTransaction.create({
                data: {
                    userId,
                    orderId,
                    type: 'EARN',
                    points,
                    balanceAfter: user.loyaltyPoints,
                },
            });
        }
        return points;
    }
}
