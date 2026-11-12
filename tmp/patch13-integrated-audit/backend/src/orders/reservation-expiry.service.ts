import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../products/inventory.service';
import { OrdersGateway } from '../realtime/orders.gateway';

@Injectable()
export class ReservationExpiryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ReservationExpiryService.name);
    private timer?: ReturnType<typeof setInterval>;
    private running = false;
    constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService,
        private readonly events: OrdersGateway) {}

    onModuleInit() {
        if (process.env.ORDER_EXPIRY_WORKER_ENABLED === 'false') return;
        this.timer = setInterval(() => void this.sweep(), 30000);
        this.timer.unref();
        // Khôi phục cả đơn quá hạn khi API vừa khởi động lại.
        void this.sweep();
    }
    onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

    async expireOne(id: number, now = new Date()): Promise<boolean> {
        const changed = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw<{ id: number }[]>`
                SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE SKIP LOCKED`;
            if (!locked.length) return false;
            const row = await tx.order.findUniqueOrThrow({ where: { id } });
            if (!['PENDING', 'PAYMENT_FAILED'].includes(row.status) || row.creditApplied > 0 ||
                !row.reservationExpiresAt || row.reservationExpiresAt > now || row.reservationExpiredAt) return false;
            // Không đóng đơn đã có bằng chứng nhận tiền đang chờ nhân viên xử lý.
            if (await tx.payment.findFirst({ where: { orderId: id } }) ||
                await tx.vnpayAttempt.findFirst({ where: { orderId: id, paidAt: { not: null } } })) return false;
            await this.inventory.release(tx, id);
            await tx.order.update({ where: { id }, data: { status: 'CANCELLED', reservationExpiredAt: now } });
            // KHÔNG biến attempt chưa rõ thành FAILED: IPN muộn phải được ghi REVIEW/refund case.
            return true;
        }, { timeout: 15000 });
        if (changed) this.events.notifyOrdersChanged();
        return changed;
    }

    async sweep(now = new Date()) {
        if (this.running) return;
        this.running = true;
        try {
            const rows = await this.prisma.order.findMany({
                where: { status: { in: ['PENDING', 'PAYMENT_FAILED'] }, creditApplied: 0,
                    reservationExpiredAt: null, reservationExpiresAt: { lte: now },
                    payments: { none: {} }, vnpayAttempts: { none: { paidAt: { not: null } } } },
                orderBy: [{ reservationExpiresAt: 'asc' }, { id: 'asc' }], take: 100,
            });
            for (const row of rows) {
                try { await this.expireOne(row.id, now); }
                catch (error) { this.logger.error(`Không đóng được đơn #${row.id}; giữ nguyên dữ liệu để kiểm tra`, error); }
            }
        } catch (error) { this.logger.error('Không quét được đơn hết hạn', error); }
        finally { this.running = false; }
    }
}
