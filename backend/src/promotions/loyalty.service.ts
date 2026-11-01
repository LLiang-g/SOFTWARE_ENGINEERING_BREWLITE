import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { calcPoints } from './discount';

@Injectable()
export class LoyaltyService {
    /** Cộng điểm cho khách theo số tiền đã trả. Gọi bên trong giao dịch thanh toán. */
    async award(
        tx: Prisma.TransactionClient,
        userId: number,
        amount: number,
    ): Promise<number> {
        const points = calcPoints(amount);
        if (points > 0) {
            await tx.user.update({
                where: { id: userId },
                data: { loyaltyPoints: { increment: points } },
            });
        }
        return points;
    }
}