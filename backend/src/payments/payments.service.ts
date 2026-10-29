import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockGatewayService } from './mock-gateway.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import type { OrderStatus, Prisma } from '../generated/prisma/client';

const PAYABLE: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: MockGatewayService,
    ) {}

    async pay(userId: number, idempotencyKey: string, dto: CreatePaymentDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // Khóa đơn đến hết giao dịch: yêu cầu đến sau phải chờ rồi đọc lại kết quả.
                await tx.$queryRaw<Array<{ id: number }>>`
                    SELECT "id" FROM "Order" WHERE "id" = ${dto.orderId} FOR UPDATE
                `;

                const replay = await this.findReplay(
                    tx,
                    userId,
                    idempotencyKey,
                    dto.orderId,
                );
                if (replay) return replay;

                const order = await tx.order.findUnique({
                    where: { id: dto.orderId },
                });
                if (!order || order.userId !== userId) {
                    throw new NotFoundException('Không tìm thấy đơn hàng');
                }
                if (!PAYABLE.includes(order.status)) {
                    throw new ConflictException(
                        `Đơn đang ở trạng thái ${order.status}, không thể thanh toán`,
                    );
                }

                // Giữ key duy nhất trước khi gọi gateway, kể cả khi key bị dùng cho hai đơn.
                // Payment chỉ được lưu khi toàn bộ giao dịch thành công.
                const payment = await tx.payment.create({
                    data: {
                        orderId: order.id,
                        idempotencyKey,
                        amount: order.total,
                        method: dto.method,
                    },
                });

                const charge = await this.gateway.charge({
                    amount: order.total,
                    method: dto.method,
                    simulateFailure: dto.simulateFailure,
                });

                if (!charge.success) {
                    await tx.payment.delete({ where: { id: payment.id } });
                    await tx.order.update({
                        where: { id: order.id },
                        data: { status: 'PAYMENT_FAILED' },
                    });
                    return {
                        orderId: order.id,
                        status: 'PAYMENT_FAILED' as const,
                        message: charge.message ?? 'Thanh toán thất bại',
                    };
                }

                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'PAID' },
                });
                return {
                    orderId: order.id,
                    status: 'PAID' as const,
                    paymentId: payment.id,
                };
            });
        } catch (e) {
            // Key bị tranh chấp giữa hai đơn: đọc lại sau khi giao dịch thua đã rollback.
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

    private async findReplay(
        db: Prisma.TransactionClient,
        userId: number,
        key: string,
        orderId: number,
    ) {
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
            status: 'PAID' as const,
            paymentId: existing.id,
        };
    }
}
