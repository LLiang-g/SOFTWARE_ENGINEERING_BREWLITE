import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { VnpayAttempt } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../promotions/loyalty.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { VnpayGateway } from './vnpay.gateway';
import { readCallback, type Fields } from './vnpay.crypto';

const BLOCKING = ['PENDING', 'REVIEW'] as const;
type Ack = { RspCode: string; Message: string };
const ack = (RspCode: string, Message: string): Ack => ({ RspCode, Message });

@Injectable()
export class VnpayService {
    constructor(private readonly prisma: PrismaService, private readonly gateway: VnpayGateway,
        private readonly loyalty: LoyaltyService, private readonly events: OrdersGateway) {}

    private view(row: VnpayAttempt) {
        return { id: row.id, orderId: row.orderId, txnRef: row.txnRef, amount: row.amount,
            status: row.status, expiresAt: row.expiresAt, paidAt: row.paidAt,
            paymentUrl: row.status === 'PENDING' && row.expiresAt > new Date() ? row.paymentUrl : null,
            responseCode: row.responseCode, reviewReason: row.reviewReason, createdAt: row.createdAt };
    }
    async customer(orderId: number, userId: number) {
        const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        const attempts = await this.prisma.vnpayAttempt.findMany({ where: { orderId }, orderBy: { id: 'desc' }, take: 10 });
        const payable = ['PENDING', 'PAYMENT_FAILED'].includes(order.status);
        return { orderStatus: order.status, attempts: attempts.map((row) => ({ ...this.view(row),
            paymentUrl: payable ? this.view(row).paymentUrl : null })) };
    }
    private async replay(userId: number, key: string, orderId: number) {
        const existing = await this.prisma.paymentStartRequest.findUnique({
            where: { userId_key: { userId, key } }, include: { attempt: true },
        });
        if (!existing) return null;
        if (existing.attempt.orderId !== orderId) throw new ConflictException('Key thanh toán đã dùng cho đơn khác');
        return this.view(existing.attempt);
    }
    async start(orderId: number, userId: number, key: string, ip: string) {
        this.gateway.config();
        const current = await this.customer(orderId, userId);
        const replay = await this.replay(userId, key, orderId);
        if (replay) return { ...replay, paymentUrl: ['PENDING', 'PAYMENT_FAILED'].includes(current.orderStatus) ? replay.paymentUrl : null };
        const expired = await this.prisma.vnpayAttempt.findFirst({ where: {
            orderId, status: { in: [...BLOCKING] }, expiresAt: { lte: new Date() },
        }, orderBy: { id: 'desc' } });
        // QueryDr là network I/O: chạy ngoài transaction và không giữ khóa Order.
        if (expired) await this.check(expired.id, userId, false);
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
                const order = await tx.order.findFirst({ where: { id: orderId, userId } });
                if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
                if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) throw new ConflictException('Đơn không còn chờ thanh toán');
                const already = await tx.payment.findFirst({ where: { orderId } });
                if (already) throw new ConflictException('Đơn đã có khoản thanh toán');
                const reservations = await tx.orderInventoryReservation.findMany({ where: { orderId } });
                if (!reservations.length || reservations.some((row) => row.releasedAt !== null)) {
                    throw new ConflictException('Đơn chưa giữ nguyên liệu hợp lệ; cần quầy kiểm tra trước khi thanh toán');
                }
                let attempt = await tx.vnpayAttempt.findFirst({ where: { orderId, status: { in: [...BLOCKING] } }, orderBy: { id: 'desc' } });
                if (attempt && (attempt.status === 'REVIEW' || attempt.expiresAt <= new Date())) {
                    throw new ConflictException('Giao dịch trước đang cần xác minh. Kiểm tra kết quả hoặc liên hệ quầy.');
                }
                if (!attempt) {
                    attempt = await tx.vnpayAttempt.create({ data: { orderId, ...this.gateway.build(orderId, order.total, ip) } });
                    await tx.paymentAudit.create({ data: { attemptId: attempt.id, actorId: userId, action: 'CREATED', note: 'Tạo lần thanh toán Sandbox' } });
                }
                await tx.paymentStartRequest.create({ data: { userId, key, attemptId: attempt.id } });
                return attempt;
            });
            return this.view(result);
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                const again = await this.replay(userId, key, orderId);
                if (again) return again;
            }
            throw error;
        }
    }

    async ipn(input: Record<string, unknown>): Promise<Ack> {
        try {
            const fields = readCallback(input, this.gateway.config().secret);
            if (!fields) return ack('97', 'Invalid signature');
            return await this.apply(fields, 'IPN');
        } catch { return ack('99', 'Temporary processing error'); }
    }

    async returnUrl(input: Record<string, unknown>) {
        const config = this.gateway.config();
        const fields = readCallback(input, config.secret);
        if (!fields || fields.vnp_TmnCode !== config.merchant) throw new BadRequestException('Không xác minh được URL trả về');
        const attempt = await this.prisma.vnpayAttempt.findUnique({ where: { txnRef: fields.vnp_TxnRef || '' } });
        if (!attempt || attempt.merchantCode !== fields.vnp_TmnCode
            || fields.vnp_Amount !== String(attempt.amount * 100)) throw new BadRequestException('Thông tin trả về không khớp');
        // Return chỉ điều hướng; tuyệt đối không ghi PAID tại đây.
        return `${config.frontend}/orders/${attempt.orderId}?vnpay=returned`;
    }

    private async apply(fields: Fields, source: 'IPN' | 'QUERY'): Promise<Ack> {
        const initial = await this.prisma.vnpayAttempt.findUnique({ where: { txnRef: fields.vnp_TxnRef || '' } });
        if (!initial || initial.merchantCode !== fields.vnp_TmnCode) return ack('01', 'Attempt not found');
        if (fields.vnp_Amount !== String(initial.amount * 100)) return ack('04', 'Invalid amount');
        if (fields.vnp_CurrCode && fields.vnp_CurrCode !== 'VND') return ack('04', 'Invalid currency');
        if (!/^\d{2}$/.test(fields.vnp_TransactionStatus || '') || !/^\d{2}$/.test(fields.vnp_ResponseCode || '')) return ack('99', 'Invalid result');
        const success = fields.vnp_ResponseCode === '00' && fields.vnp_TransactionStatus === '00';
        if (success && !/^\d{1,15}$/.test(fields.vnp_TransactionNo || '')) return ack('99', 'Invalid transaction number');
        const result = await this.prisma.$transaction(async (tx) => {
            // Tất cả start, settle, mock và cancel đều lấy khóa Order trước.
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${initial.orderId} FOR UPDATE`;
            const attempt = await tx.vnpayAttempt.findUniqueOrThrow({ where: { id: initial.id } });
            if (attempt.paidAt) {
                if (success && attempt.providerTxnNo !== fields.vnp_TransactionNo) return { response: ack('04', 'Transaction mismatch'), changed: false };
                return { response: ack('02', 'Already confirmed'), changed: false };
            }
            if (!success && ['FAILED', 'EXPIRED'].includes(attempt.status)) {
                return { response: ack('02', 'Already confirmed'), changed: false };
            }
            const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
            if (success) {
                const duplicateNo = await tx.vnpayAttempt.findUnique({ where: { providerTxnNo: fields.vnp_TransactionNo } });
                if (duplicateNo && duplicateNo.id !== attempt.id) return { response: ack('04', 'Transaction mismatch'), changed: false };
                const settled = await tx.payment.findFirst({ where: { orderId: order.id } });
                const reservations = await tx.orderInventoryReservation.findMany({ where: { orderId: order.id } });
                const canFulfill = ['PENDING', 'PAYMENT_FAILED'].includes(order.status)
                    && !settled && attempt.amount === order.total
                    && reservations.length > 0 && reservations.every((row) => row.releasedAt === null);
                const reason = canFulfill ? null : settled ? 'DUPLICATE_PAYMENT'
                    : attempt.amount !== order.total ? 'ORDER_AMOUNT_CHANGED' : 'PAID_WITHOUT_ACTIVE_ORDER';
                await tx.vnpayAttempt.update({ where: { id: attempt.id }, data: {
                    status: canFulfill ? 'SUCCEEDED' : 'REVIEW', paidAt: new Date(),
                    providerTxnNo: fields.vnp_TransactionNo, responseCode: fields.vnp_ResponseCode,
                    transactionStatus: fields.vnp_TransactionStatus, reviewReason: reason,
                } });
                if (canFulfill) {
                    await tx.payment.create({ data: { orderId: order.id, amount: attempt.amount, method: 'VNPAY',
                        idempotencyKey: `vnpay:${attempt.txnRef}`, vnpayAttemptId: attempt.id } });
                    await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
                    await this.loyalty.award(tx, order.userId, attempt.amount, order.id);
                }
                await tx.paymentAudit.create({ data: { attemptId: attempt.id, action: source,
                    note: canFulfill ? 'Đã xác minh thanh toán thành công' : `Đã thu tiền, cần đối soát: ${reason}` } });
                return { response: ack('00', 'Confirm success'), changed: true };
            }
            // Chỉ status 02 là thất bại chắc chắn; status 01/04/07 không tự cấp mã mới.
            const failed = fields.vnp_TransactionStatus === '02'
                && (source === 'QUERY' || !['00', '07'].includes(fields.vnp_ResponseCode));
            const status = failed ? ((fields.vnp_ResponseCode === '11' || (source === 'QUERY' && attempt.expiresAt <= new Date())) ? 'EXPIRED' : 'FAILED')
                : fields.vnp_TransactionStatus === '01' && attempt.status !== 'REVIEW' ? 'PENDING' : 'REVIEW';
            if (['FAILED', 'EXPIRED'].includes(attempt.status) && !failed) return { response: ack('02', 'Already confirmed'), changed: false };
            await tx.vnpayAttempt.update({ where: { id: attempt.id }, data: { status,
                responseCode: fields.vnp_ResponseCode, transactionStatus: fields.vnp_TransactionStatus,
                reviewReason: failed ? null : 'UNCONFIRMED_RESULT' } });
            if (failed && ['PENDING', 'PAYMENT_FAILED'].includes(order.status)) {
                await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_FAILED' } });
            }
            await tx.paymentAudit.create({ data: { attemptId: attempt.id, action: source,
                note: `Kết quả ${fields.vnp_ResponseCode}/${fields.vnp_TransactionStatus}: ${status}` } });
            return { response: ack('00', 'Confirm success'), changed: true };
        });
        if (result.changed) this.events.notifyOrdersChanged();
        return result.response;
    }

    async check(id: number, userId: number, staff: boolean) {
        const attempt = await this.prisma.vnpayAttempt.findUnique({ where: { id }, include: { order: true } });
        if (!attempt || (!staff && attempt.order.userId !== userId)) throw new NotFoundException('Không tìm thấy giao dịch');
        if (attempt.paidAt || ['FAILED', 'EXPIRED'].includes(attempt.status)) return this.view(attempt);
        const claimed = await this.prisma.vnpayAttempt.updateMany({ where: { id, OR: [
            { lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 15000) } },
        ] }, data: { lastCheckedAt: new Date() } });
        if (claimed.count) {
            try {
                const fields = await this.gateway.query(attempt);
                if (fields.vnp_ResponseCode === '00' && fields.vnp_TransactionType === '01') {
                    await this.apply(fields, 'QUERY');
                } else {
                    await this.prisma.paymentAudit.create({ data: { attemptId: id, actorId: userId,
                        action: 'QUERY_UNCONFIRMED', note: `Tra cứu chưa xác nhận giao dịch: ${fields.vnp_ResponseCode}` } });
                }
            } catch {
                await this.prisma.paymentAudit.create({ data: { attemptId: id, actorId: userId,
                    action: 'QUERY_UNAVAILABLE', note: 'Không xác minh được kết quả tra cứu; giữ trạng thái và nguyên liệu' } });
            }
        }
        return this.view(await this.prisma.vnpayAttempt.findUniqueOrThrow({ where: { id } }));
    }

    async staffList() {
        const rows = await this.prisma.vnpayAttempt.findMany({ orderBy: { id: 'desc' }, take: 100,
            include: { order: { select: { status: true } }, audits: { orderBy: { id: 'desc' }, take: 15 } } });
        return rows.map((row) => ({ ...this.view(row), paymentUrl: undefined,
            providerTxnNo: row.providerTxnNo, orderStatus: row.order.status, audits: row.audits }));
    }
    async note(id: number, actorId: number, note: string) {
        if (!await this.prisma.vnpayAttempt.findUnique({ where: { id } })) throw new NotFoundException('Không tìm thấy giao dịch');
        return this.prisma.paymentAudit.create({ data: { attemptId: id, actorId, action: 'STAFF_NOTE', note } });
    }
}
