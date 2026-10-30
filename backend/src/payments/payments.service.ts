import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockGatewayService } from './mock-gateway.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrderStatus } from '../generated/prisma/client';

const PAYABLE: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: MockGatewayService,
    ) {}

    async pay(userId: number, idempotencyKey: string, dto: CreatePaymentDto) {
        // 1. Cùng Idempotency-Key đã thanh toán rồi: trả lại kết quả cũ, không trừ tiền lần nữa.
        const replay = await this.findReplay(userId, idempotencyKey, dto.orderId);
        if (replay) return replay;

        // 2. Kiểm tra đơn: phải của chính người dùng và đang ở trạng thái thanh toán được.
        const order = await this.prisma.order.findUnique({
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

        // 3. Gọi cổng thanh toán giả lập.
        const charge = await this.gateway.charge({
            amount: order.total,
            method: dto.method,
            simulateFailure: dto.simulateFailure,
        });

        if (!charge.success) {
            await this.prisma.order.updateMany({
                where: { id: order.id, status: { in: PAYABLE } },
                data: { status: 'PAYMENT_FAILED' },
            });
            return {
                orderId: order.id,
                status: 'PAYMENT_FAILED' as const,
                message: charge.message ?? 'Thanh toán thất bại',
            };
        }

        // 4. Thành công: đổi đơn sang PAID và ghi Payment trong cùng một giao dịch.
        try {
            const payment = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.order.updateMany({
                    where: { id: order.id, status: { in: PAYABLE } },
                    data: { status: 'PAID' },
                });
                if (updated.count === 0) {
                    throw new ConflictException('Đơn đã được thanh toán hoặc đã bị hủy');
                }
                return tx.payment.create({
                    data: {
                        orderId: order.id,
                        idempotencyKey,
                        amount: order.total,
                        method: dto.method,
                    },
                });
            });
            return {
                orderId: order.id,
                status: 'PAID' as const,
                paymentId: payment.id,
            };
        } catch (e) {
            // Hai yêu cầu cùng key đến sát nhau: bên đến sau trả lại kết quả của bên đến trước.
            if ((e as { code?: string }).code === 'P2002') {
                const again = await this.findReplay(userId, idempotencyKey, dto.orderId);
                if (again) return again;
            }
            throw e;
        }
    }

    private async findReplay(userId: number, key: string, orderId: number) {
        const existing = await this.prisma.payment.findUnique({
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