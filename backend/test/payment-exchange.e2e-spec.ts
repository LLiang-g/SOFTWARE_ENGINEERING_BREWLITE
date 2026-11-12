import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { VnpayGateway } from '../src/payments/vnpay.gateway';
import { signedQuery } from '../src/payments/vnpay.crypto';
import { cleanupUsers, createBarista, createOrder, createTestApp, createTestProduct, deleteTestProducts, registerUser } from './helpers';

describe('Retry, đổi món, thu chênh lệch và hoàn khoản dư', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let staff: string;
    const users: number[] = [];
    const products: number[] = [];
    let number = 800000;
    beforeAll(async () => {
        vi.stubEnv('VNPAY_ENABLED','true'); vi.stubEnv('VNPAY_TMN_CODE','TEST0001');
        vi.stubEnv('VNPAY_HASH_SECRET','test-secret'); vi.stubEnv('PUBLIC_BASE_URL','https://example.ngrok-free.app');
        ({app,prisma} = await createTestApp());
        const customer = await registerUser(app); token = customer.token; users.push(customer.userId);
        const barista = await createBarista(app,prisma); staff = barista.token; users.push(barista.userId);
    });
    afterAll(async () => {
        vi.restoreAllMocks(); vi.unstubAllEnvs();
        await cleanupUsers(prisma,users); await deleteTestProducts(prisma,products); await app.close();
    });
    function post(url: string, body: object, auth = token, key = randomUUID()) {
        return request(app.getHttpServer()).post(url).set('Authorization',`Bearer ${auth}`).set('Idempotency-Key',key).send(body);
    }
    async function product(price = 40000, servings = 10) {
        const p = await createTestProduct(prisma,servings,{price}); products.push(p.id); return p;
    }
    async function start(orderId: number) { return post('/payments/vnpay/start',{orderId}).expect(201); }
    async function settle(id: number) {
        const a = await prisma.vnpayAttempt.findUniqueOrThrow({where:{id}});
        const query = signedQuery({vnp_TmnCode:'TEST0001',vnp_TxnRef:a.txnRef,vnp_Amount:String(a.amount*100),
            vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:String(++number)},'test-secret');
        return request(app.getHttpServer()).get(`/payments/vnpay/ipn?${query}`).expect(200);
    }
    async function paidFixture() {
        const p = await product();
        const o = await createOrder(app,token,[{productId:p.id,size:'S',qty:1}]).expect(201);
        const a = await start(o.body.id); await settle(a.body.id);
        return {orderId:o.body.id as number,productId:p.id};
    }
    async function exchange(orderId: number, productId: number, key = randomUUID()) {
        return post(`/orders/${orderId}/exchanges`,{items:[{productId,size:'S',qty:1}],reason:'Khách muốn đổi món'},token,key).expect(201);
    }
    function decide(id: number, version = 0, approve = true) {
        return post(`/staff/exchanges/${id}/decision`,{version,approve,note:'Đã kiểm tra điều kiện'},staff);
    }
    async function stock(productId: number) {
        const recipe = await prisma.recipe.findFirstOrThrow({where:{productId},include:{ingredient:true}}); return recipe.ingredient.stock;
    }
    it('mã hết hạn + query timeout vẫn tạo mã mới; IPN cả hai lần chỉ phục vụ một lần và mở một hồ sơ hoàn',async () => {
        const p = await product(); const o = await createOrder(app,token,[{productId:p.id,size:'S',qty:1}]).expect(201);
        const a = await start(o.body.id);
        await prisma.vnpayAttempt.update({where:{id:a.body.id},data:{expiresAt:new Date(Date.now()-1000)}});
        const spy = vi.spyOn(app.get(VnpayGateway),'query').mockRejectedValue(new Error('timeout'));
        let b;
        try { b = await start(o.body.id); } finally { spy.mockRestore(); }
        expect(b.body.id).not.toBe(a.body.id);
        expect((await prisma.vnpayAttempt.findUniqueOrThrow({where:{id:a.body.id}})).status).toBe('PENDING');
        await Promise.all([settle(a.body.id),settle(b.body.id)]);
        expect(await prisma.payment.count({where:{orderId:o.body.id}})).toBe(1);
        const refund = await prisma.paymentRefundCase.findFirstOrThrow({where:{attempt:{orderId:o.body.id}}});
        expect(refund.amount).toBe(40000); expect(refund.status).toBe('OPEN');
        const own = await request(app.getHttpServer()).get('/orders/payment-refunds/mine').set('Authorization',`Bearer ${token}`).expect(200);
        expect(own.body.some((row: { id: number }) => row.id === refund.id)).toBe(true);
        expect(await stock(p.id)).toBe(90);
        await post(`/staff/payment-refunds/${refund.id}/status`,{version:0,status:'COMPLETED',reference:'BANK-12345',note:'Bỏ qua xử lý'},staff).expect(409);
        const claim = await post(`/staff/payment-refunds/${refund.id}/status`,{version:0,status:'PROCESSING',reference:'',note:'Liên hệ khách'},staff).expect(201);
        await post(`/staff/payment-refunds/${refund.id}/status`,{version:0,status:'COMPLETED',reference:'BANK-12345',note:'Đã chuyển trả'},staff).expect(409);
        await post(`/staff/payment-refunds/${refund.id}/status`,{version:claim.body.version,status:'COMPLETED',reference:'BANK-12345',note:'Đã chuyển trả'},staff).expect(201);
        await post(`/staff/payment-refunds/${refund.id}/status`,{version:2,status:'COMPLETED',reference:'BANK-67890',note:'Lặp lại'},staff).expect(409);
        await post(`/staff/payment-refunds/${refund.id}/status`,{version:2,status:'COMPLETED',reference:'BANK-67890',note:'Khách tự hoàn'}).expect(403);
    });
    it('đổi bằng giá: tiền cũ chuyển sang đơn mới, snapshot cũ hoàn đúng, không tạo Payment giả',async () => {
        const old = await paidFixture(); const p = await product(); const key = randomUUID();
        const a = await exchange(old.orderId,p.id,key); const replay = await exchange(old.orderId,p.id,key);
        expect(replay.body.id).toBe(a.body.id);
        const results = await Promise.all([decide(a.body.id),decide(a.body.id)]);
        expect(results.map(r=>r.status).sort()).toEqual([201,409]);
        const row = await prisma.orderExchange.findUniqueOrThrow({where:{id:a.body.id},include:{replacementOrder:true}});
        expect(row.replacementOrder?.status).toBe('PAID'); expect(row.replacementOrder?.creditApplied).toBe(40000);
        expect(await stock(old.productId)).toBe(100); expect(await stock(p.id)).toBe(90);
        expect(await prisma.payment.count({where:{orderId:row.replacementOrderId!}})).toBe(0);
        await post(`/orders/${row.replacementOrderId}/cancel`,{}).expect(409);
    });
    it('đổi giá cao hơn: VNPay chỉ thu chênh lệch và chỉ cộng điểm phần mới',async () => {
        const old = await paidFixture(); const p = await product(55000);
        const e = await exchange(old.orderId,p.id); const result = await decide(e.body.id).expect(201);
        const newId = result.body.replacementOrderId as number;
        const attempt = await start(newId); expect(attempt.body.amount).toBe(15000);
        await settle(attempt.body.id);
        expect((await prisma.order.findUniqueOrThrow({where:{id:newId}})).status).toBe('PAID');
        const payment = await prisma.payment.findFirstOrThrow({where:{orderId:newId}}); expect(payment.amount).toBe(15000);
        const points = await prisma.loyaltyTransaction.findFirstOrThrow({where:{orderId:newId}}); expect(points.points).toBe(1);
    });
    it('món rẻ hơn hoặc thiếu kho: rollback toàn bộ, đơn cũ và kho không đổi',async () => {
        const old = await paidFixture(); const cheap = await product(30000);
        const a = await exchange(old.orderId,cheap.id); await decide(a.body.id).expect(409); await decide(a.body.id,0,false).expect(201);
        const empty = await product(40000,0); const b = await exchange(old.orderId,empty.id); await decide(b.body.id).expect(409);
        expect((await prisma.order.findUniqueOrThrow({where:{id:old.orderId}})).status).toBe('PAID');
        expect(await stock(old.productId)).toBe(90);
    });
    it('đơn đang pha không được đổi; khách không được duyệt hoặc tự xác nhận hoàn',async () => {
        const old = await paidFixture(); const p = await product(); const e = await exchange(old.orderId,p.id);
        await post(`/staff/exchanges/${e.body.id}/decision`,{version:0,approve:true,note:'Tự duyệt'}).expect(403);
        await request(app.getHttpServer()).patch(`/staff/orders/${old.orderId}/status`).set('Authorization',`Bearer ${staff}`).send({status:'PREPARING'}).expect(200);
        await decide(e.body.id).expect(409);
        const another = await registerUser(app); users.push(another.userId);
        await post(`/orders/${old.orderId}/exchanges`,{items:[{productId:p.id,size:'S',qty:1}],reason:'Không phải chủ đơn'},another.token).expect(404);
    });
    it('duyệt đổi và bắt đầu pha đồng thời chỉ một thao tác thắng, không trả kho món đã pha',async () => {
        const old = await paidFixture(); const p = await product(); const e = await exchange(old.orderId,p.id);
        const results = await Promise.all([decide(e.body.id), request(app.getHttpServer())
            .patch(`/staff/orders/${old.orderId}/status`).set('Authorization',`Bearer ${staff}`).send({status:'PREPARING'})]);
        const order = await prisma.order.findUniqueOrThrow({where:{id:old.orderId}});
        if (order.status === 'CANCELLED') {
            expect(results.map(r=>r.status)).toEqual([201,409]);
            expect(await stock(old.productId)).toBe(100); expect(await stock(p.id)).toBe(90);
        } else {
            expect(order.status).toBe('PREPARING'); expect(results.map(r=>r.status)).toEqual([409,200]);
            expect(await stock(old.productId)).toBe(90); expect(await stock(p.id)).toBe(100);
        }
    });
});
