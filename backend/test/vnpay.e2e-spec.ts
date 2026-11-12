import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { VnpayGateway } from '../src/payments/vnpay.gateway';
import { LoyaltyService } from '../src/promotions/loyalty.service';
import { signedQuery, type Fields } from '../src/payments/vnpay.crypto';
import { createBarista, createOrder, createTestApp, createTestProduct, cleanupUsers, deleteTestProducts, registerUser, cancelOrder, pay } from './helpers';

describe('VNPay Sandbox API (gateway giả lập, DB thật riêng)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    let staffToken: string;
    const userIds: number[] = [];
    const productIds: number[] = [];
    let sequence = 100000;
    beforeAll(async () => {
        vi.stubEnv('VNPAY_ENABLED', 'true'); vi.stubEnv('VNPAY_TMN_CODE', 'TEST0001');
        vi.stubEnv('VNPAY_HASH_SECRET', 'test-secret-for-automated-tests');
        vi.stubEnv('PUBLIC_BASE_URL', 'https://example.ngrok-free.app'); vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app)); userIds.push(userId);
        const staff = await createBarista(app, prisma); staffToken = staff.token; userIds.push(staff.userId);
    });
    afterAll(async () => {
        vi.restoreAllMocks(); vi.unstubAllEnvs();
        if (prisma) { await cleanupUsers(prisma, userIds); await deleteTestProducts(prisma, productIds); }
        await app?.close();
    });
    async function fixture() {
        const product = await createTestProduct(prisma, 10); productIds.push(product.id);
        const order = await createOrder(app, token, [{ productId: product.id, size: 'S', qty: 1 }]).expect(201);
        const recipe = await prisma.recipe.findFirstOrThrow({ where: { productId: product.id } });
        return { orderId: order.body.id as number, ingredientId: recipe.ingredientId };
    }
    function start(orderId: number, key = randomUUID(), auth = token) {
        return request(app.getHttpServer()).post('/payments/vnpay/start')
            .set('Authorization', `Bearer ${auth}`).set('Idempotency-Key', key).send({ orderId });
    }
    async function attempt() {
        const f = await fixture();
        const result = await start(f.orderId).expect(201);
        return { ...f, ...result.body } as { id: number; orderId: number; txnRef: string; ingredientId: number; paymentUrl: string };
    }
    function fields(txnRef: string, changes: Fields = {}): Fields {
        return { vnp_TmnCode: 'TEST0001', vnp_TxnRef: txnRef, vnp_Amount: '4000000',
            vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: String(++sequence), ...changes };
    }
    function callback(data: Fields, endpoint = 'ipn') {
        return request(app.getHttpServer()).get(`/payments/vnpay/${endpoint}?${signedQuery(data, 'test-secret-for-automated-tests')}`);
    }
    const stock = async (id: number) => (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock;

    it('số tiền/merchant do backend quyết định, cùng key hoặc key khác vẫn tái dùng mã đang hiệu lực', async () => {
        const f = await fixture(); const key = randomUUID();
        const results = await Promise.all([start(f.orderId, key), start(f.orderId, key), start(f.orderId)]);
        expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
        expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
        const url = new URL(results[0].body.paymentUrl);
        expect(url.searchParams.get('vnp_Amount')).toBe('4000000');
        expect(url.searchParams.get('vnp_ReturnUrl')).toBe('https://example.ngrok-free.app/payments/vnpay/return');
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('IPN thành công đồng thời chỉ ghi Payment và cộng điểm một lần', async () => {
        const f = await attempt(); const data = fields(f.txnRef);
        const before = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
        const results = await Promise.all(Array.from({ length: 6 }, () => callback(data)));
        expect(results.every((r) => ['00', '02'].includes(r.body.RspCode))).toBe(true);
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(1);
        expect((await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } })).status).toBe('PAID');
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(before + 4);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('Return hợp lệ chỉ redirect về đơn, không ghi PAID', async () => {
        const f = await attempt();
        const response = await callback(fields(f.txnRef), 'return').expect(303);
        expect(response.headers.location).toBe(`http://localhost:3000/orders/${f.orderId}?vnpay=returned`);
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
    });

    it('chữ ký giả, số tiền sai và merchant sai không cập nhật đơn', async () => {
        const f = await attempt();
        const bad = await request(app.getHttpServer()).get(`/payments/vnpay/ipn?vnp_TxnRef=${f.txnRef}&vnp_SecureHash=bad`);
        expect(bad.body.RspCode).toBe('97');
        expect((await callback(fields(f.txnRef, { vnp_Amount: '1' }))).body.RspCode).toBe('04');
        expect((await callback(fields(f.txnRef, { vnp_TmnCode: 'OTHER001' }))).body.RspCode).toBe('01');
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
    });

    it('thất bại đã xác minh cho tạo lần mới cùng đơn, không giữ kho thêm', async () => {
        const f = await attempt();
        await callback(fields(f.txnRef, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
        const next = await start(f.orderId).expect(201);
        expect(next.body.txnRef).not.toBe(f.txnRef);
        expect(next.body.orderId).toBe(f.orderId);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('hết hạn đồng hồ chưa đủ; QueryDr đã xác minh thất bại mới cấp mã mới', async () => {
        const f = await attempt();
        await prisma.vnpayAttempt.update({ where: { id: f.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        const spy = vi.spyOn(app.get(VnpayGateway), 'query').mockResolvedValueOnce(fields(f.txnRef, {
            vnp_ResponseCode: '91', vnp_TransactionStatus: '01', vnp_TransactionType: '01',
        }));
        try { await start(f.orderId).expect(409); } finally { spy.mockRestore(); }
        expect(await prisma.vnpayAttempt.count({ where: { orderId: f.orderId } })).toBe(1);
        await prisma.vnpayAttempt.update({ where: { id: f.id }, data: { lastCheckedAt: null } });
        const verified = vi.spyOn(app.get(VnpayGateway), 'query').mockResolvedValueOnce(fields(f.txnRef, {
            vnp_ResponseCode: '00', vnp_TransactionStatus: '02', vnp_TransactionType: '01',
        }));
        try {
            const next = await start(f.orderId).expect(201);
            expect(next.body.id).not.toBe(f.id);
        } finally { verified.mockRestore(); }
    });

    it('QueryDr timeout không biến thành thất bại hoặc hoàn kho', async () => {
        const f = await attempt();
        const spy = vi.spyOn(app.get(VnpayGateway), 'query').mockRejectedValueOnce(new Error('network timeout'));
        try {
            const result = await request(app.getHttpServer()).post(`/payments/vnpay/attempts/${f.id}/check`)
                .set('Authorization', `Bearer ${token}`).expect(200);
            expect(result.body.status).toBe('PENDING');
        } finally { spy.mockRestore(); }
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('đang chờ tiền thì hủy bị chặn; sau thất bại chắc chắn hủy hoàn đúng kho', async () => {
        const f = await attempt();
        await cancelOrder(app, token, f.orderId).expect(409);
        await callback(fields(f.txnRef, { vnp_ResponseCode: '11', vnp_TransactionStatus: '02' }));
        await cancelOrder(app, token, f.orderId).expect(200);
        expect(await stock(f.ingredientId)).toBe(100);
    });

    it('tiền về muộn sau hủy được ghi REVIEW, không gửi pha chế hoặc trừ lại kho', async () => {
        const f = await attempt();
        await callback(fields(f.txnRef, { vnp_ResponseCode: '11', vnp_TransactionStatus: '02' }));
        await cancelOrder(app, token, f.orderId).expect(200);
        await callback(fields(f.txnRef));
        const row = await prisma.vnpayAttempt.findUniqueOrThrow({ where: { id: f.id } });
        expect(row.status).toBe('REVIEW'); expect(row.paidAt).not.toBeNull();
        expect(row.reviewReason).toBe('PAID_WITHOUT_ACTIVE_ORDER');
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
        expect(await stock(f.ingredientId)).toBe(100);
    });

    it('hai khoản thu cho một đơn được giữ đủ trên attempt, chỉ có một Payment/điểm', async () => {
        const f = await attempt();
        await callback(fields(f.txnRef, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
        const next = await start(f.orderId).expect(201);
        await callback(fields(next.body.txnRef));
        await callback(fields(f.txnRef));
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(1);
        expect(await prisma.vnpayAttempt.count({ where: { orderId: f.orderId, paidAt: { not: null } } })).toBe(2);
        expect((await prisma.vnpayAttempt.findUniqueOrThrow({ where: { id: f.id } })).reviewReason).toBe('DUPLICATE_PAYMENT');
        expect(await prisma.loyaltyTransaction.count({ where: { orderId: f.orderId } })).toBe(1);
    });

    it('không cho khách xem/tra giao dịch người khác và không cho khách vào thanh toán barista', async () => {
        const f = await attempt(); const other = await registerUser(app); userIds.push(other.userId);
        await request(app.getHttpServer()).get(`/payments/vnpay/orders/${f.orderId}`).set('Authorization', `Bearer ${other.token}`).expect(404);
        await request(app.getHttpServer()).post(`/payments/vnpay/attempts/${f.id}/check`).set('Authorization', `Bearer ${other.token}`).expect(404);
        await request(app.getHttpServer()).get('/staff/payments').set('Authorization', `Bearer ${token}`).expect(403);
        await request(app.getHttpServer()).get('/staff/payments').expect(401);
    });

    it('barista xem và ghi chú được, không có API tự ép PAID', async () => {
        const f = await attempt();
        const rows = await request(app.getHttpServer()).get('/staff/payments').set('Authorization', `Bearer ${staffToken}`).expect(200);
        expect(rows.body.some((row: { id: number }) => row.id === f.id)).toBe(true);
        await request(app.getHttpServer()).post(`/staff/payments/${f.id}/notes`).set('Authorization', `Bearer ${staffToken}`)
            .send({ note: 'Đã tiếp nhận yêu cầu tra soát của khách' }).expect(201);
        expect(await prisma.paymentAudit.count({ where: { attemptId: f.id, action: 'STAFF_NOTE' } })).toBe(1);
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
    });

    it('bật VNPay thì endpoint mock bị chặn kể cả cờ mock=true', async () => {
        const f = await fixture();
        await pay(app, token, f.orderId, randomUUID()).expect(403);
    });

    it('retry key không được trả URL của lần còn chờ khi đơn đã trả tiền bằng lần cũ', async () => {
        const f = await attempt();
        await callback(fields(f.txnRef, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
        const key = randomUUID();
        const next = await start(f.orderId, key).expect(201);
        await callback(fields(f.txnRef));
        const again = await start(f.orderId, key).expect(201);
        expect(again.body.id).toBe(next.body.id);
        expect(again.body.paymentUrl).toBeNull();
    });

    it('key đã dùng cho đơn khác trả 409, không tạo giao dịch thừa', async () => {
        const a = await fixture(); const b = await fixture(); const key = randomUUID();
        await start(a.orderId, key).expect(201);
        await start(b.orderId, key).expect(409);
        expect(await prisma.vnpayAttempt.count({ where: { orderId: b.orderId } })).toBe(0);
    });

    it('IPN thất bại đến sau thành công không hạ trạng thái PAID', async () => {
        const f = await attempt(); const data = fields(f.txnRef);
        await callback(data);
        const later = await callback({ ...data, vnp_ResponseCode: '24', vnp_TransactionStatus: '02' });
        expect(later.body.RspCode).toBe('02');
        expect((await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } })).status).toBe('PAID');
    });

    it('kết quả nghi ngờ không gửi pha chế và không tự cho thanh toán mới', async () => {
        const f = await attempt();
        await callback(fields(f.txnRef, { vnp_ResponseCode: '07', vnp_TransactionStatus: '07' }));
        await start(f.orderId).expect(409);
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('lỗi cộng điểm rollback cả settlement; IPN retry có thể thành công', async () => {
        const f = await attempt(); const data = fields(f.txnRef);
        const spy = vi.spyOn(app.get(LoyaltyService), 'award').mockRejectedValueOnce(new Error('Simulated loyalty rollback'));
        try { expect((await callback(data)).body.RspCode).toBe('99'); }
        finally { spy.mockRestore(); }
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(0);
        expect((await prisma.vnpayAttempt.findUniqueOrThrow({ where: { id: f.id } })).paidAt).toBeNull();
        expect((await callback(data)).body.RspCode).toBe('00');
        expect(await prisma.payment.count({ where: { orderId: f.orderId } })).toBe(1);
    });
});
