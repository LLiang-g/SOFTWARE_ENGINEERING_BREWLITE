import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { MockGatewayService } from './mock-gateway.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { assertTransition } from '../orders/order-state-machine';
import { LoyaltyService } from '../promotions/loyalty.service';

export type PayResult = {
    orderId: number;
    status: 'PAID' | 'PAYMENT_FAILED';
    paymentId?: number;
    message?: string;
};

type Db = Pick<PrismaService, 'payment'>;

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: MockGatewayService,
        private readonly loyalty: LoyaltyService,
    ) {}

    async pay(
        userId: number,
        idempotencyKey: string,
        dto: CreatePaymentDto,
    ): Promise<PayResult> {
        try {
            return await this.prisma.$transaction(
                (tx) => this.payInTransaction(tx, userId, idempotencyKey, dto),
                { timeout: 15000 },
            );
        } catch (e) {
            // Cùng key nhưng khác đơn đến sát nhau: bên đến sau đụng ràng buộc duy nhất.
            if ((e as { code?: string }).code === 'P2002') {
                const again = await this.findReplay(
                    this.prisma,
                    userId,
                    idempotencyKey,
                    dto.orderId,
                );
                if (again) return again;
            }
            throw e;
        }
    }

    private async payInTransaction(
        tx: Prisma.TransactionClient,
        userId: number,
        idempotencyKey: string,
        dto: CreatePaymentDto,
    ): Promise<PayResult> {
        // 1. Khóa dòng đơn: các yêu cầu cùng một đơn phải xếp hàng, từng yêu cầu một.
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${dto.orderId} FOR UPDATE`;

        // 2. Cùng Idempotency-Key đã xử lý rồi: trả lại kết quả cũ, không trừ tiền lần nữa.
        const replay = await this.findReplay(
            tx,
            userId,
            idempotencyKey,
            dto.orderId,
        );
        if (replay) return replay;

        // 3. Kiểm tra đơn và luật chuyển trạng thái.
        const order = await tx.order.findUnique({ where: { id: dto.orderId } });
        if (!order || order.userId !== userId) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }
        if (order.status === 'PAID') {
            throw new ConflictException('Đơn này đã được thanh toán');
        }
        assertTransition(order.status, 'PAID');

        // 4. Gọi cổng thanh toán giả lập.
        const charge = await this.gateway.charge({
            amount: order.total,
            method: dto.method,
            simulateFailure: dto.simulateFailure,
        });

        if (!charge.success) {
            if (order.status !== 'PAYMENT_FAILED') {
                assertTransition(order.status, 'PAYMENT_FAILED');
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'PAYMENT_FAILED' },
                });
            }
            return {
                orderId: order.id,
                status: 'PAYMENT_FAILED',
                message: charge.message ?? 'Thanh toán thất bại',
            };
        }

        // 5. Thành công: ghi Payment, đổi đơn sang PAID và cộng điểm trong cùng một giao dịch.
        const payment = await tx.payment.create({
            data: {
                orderId: order.id,
                idempotencyKey,
                amount: order.total,
                method: dto.method,
            },
        });
        await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAID' },
        });
        await this.loyalty.award(tx, userId, order.total);

        return { orderId: order.id, status: 'PAID', paymentId: payment.id };
    }

    private async findReplay(
        db: Db,
        userId: number,
        key: string,
        orderId: number,
    ): Promise<PayResult | null> {
        const existing = await db.payment.findUnique({
            where: { idempotencyKey: key },
            include: { order: { select: { userId: true } } },
        });
        if (!existing) return null;
        if (existing.order.userId !== userId || existing.orderId !== orderId) {
            throw new ConflictException(
                'Idempotency-Key đã được dùng cho một yêu cầu khác',
            );
        }
        return {
            orderId: existing.orderId,
            status: 'PAID',
            paymentId: existing.id,
        };
    }
}