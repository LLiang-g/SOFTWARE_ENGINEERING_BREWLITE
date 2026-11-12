import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservationExpiryService } from '../src/orders/reservation-expiry.service';
import { VnpayGateway } from '../src/payments/vnpay.gateway';
import { InventoryService } from '../src/products/inventory.service';
import { signedQuery } from '../src/payments/vnpay.crypto';
import { cancelOrder, cleanupUsers, createOrder, createTestApp, registerUser, pay } from './helpers';

describe('Định lượng thật và hết thời gian giữ món', () => {
    let app: INestApplication, prisma: PrismaService, expiry: ReservationExpiryService;
    let token: string, userId: number;
    const ingredientIds: number[] = [], productIds: number[] = [];
    const toppingRows: { toppingCode: string; ingredientId: number; quantity: number }[] = [];
    let serial = 0;
    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        expiry = app.get(ReservationExpiryService);
        // Tạm thay công thức KEM trên DB test RIÊNG để kiểm tra topping dùng chung.
        toppingRows.push(...await prisma.toppingRecipe.findMany({ where: { toppingCode: 'KEM' },
            select: { toppingCode: true, ingredientId: true, quantity: true } }));
    });
    afterAll(async () => {
        vi.restoreAllMocks(); vi.unstubAllEnvs();
        if (prisma) {
            await cleanupUsers(prisma, [userId]);
            await prisma.toppingRecipe.deleteMany({ where: { toppingCode: 'KEM' } });
            await prisma.toppingRecipe.createMany({ data: toppingRows });
            await prisma.recipe.deleteMany({ where: { productId: { in: productIds } } });
            await prisma.product.deleteMany({ where: { id: { in: productIds } } });
            await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
        }
        await app?.close();
    });
    async function fixture(stock = 100) {
        const ingredient = await prisma.ingredient.create({ data: { name: `p13-${Date.now()}-${serial++}`, unit: 'g', stock } });
        ingredientIds.push(ingredient.id);
        const cups = await prisma.ingredient.create({ data: { name: `cups-p13-${Date.now()}-${serial++}`, unit: 'cái', stock: 100 } });
        ingredientIds.push(cups.id);
        const product = await prisma.product.create({ data: { name: 'p13 coffee', price: 40000, imageUrl: '/test.jpg', recipes: { create: [
            { ingredientId: ingredient.id, quantity: 20, scalesWithSize: true },
            { ingredientId: cups.id, quantity: 1, scalesWithSize: false },
        ] } } });
        productIds.push(product.id);
        return { product, ingredient, cups };
    }
    const stock = async (id: number) => (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock;
    async function overdue(id: number) {
        await prisma.order.update({ where: { id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    }
    function start(id: number) {
        return request(app.getHttpServer()).post('/payments/vnpay/start')
            .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID()).send({ orderId: id });
    }
    async function ipn(attemptId: number) {
        const a = await prisma.vnpayAttempt.findUniqueOrThrow({ where: { id: attemptId } });
        const query = signedQuery({ vnp_TmnCode: 'TEST0001', vnp_TxnRef: a.txnRef,
            vnp_Amount: String(a.amount * 100), vnp_ResponseCode: '00', vnp_TransactionStatus: '00',
            vnp_TransactionNo: String(910000 + serial++) }, 'test-secret');
        return request(app.getHttpServer()).get(`/payments/vnpay/ipn?${query}`);
    }
    function sandbox() {
        vi.stubEnv('VNPAY_ENABLED', 'true'); vi.stubEnv('VNPAY_TMN_CODE', 'TEST0001');
        vi.stubEnv('VNPAY_HASH_SECRET', 'test-secret'); vi.stubEnv('PUBLIC_BASE_URL', 'https://test.example');
    }
    it('size L và topping dùng chung nguyên liệu được cộng đủ, ly không nhân size, hoàn theo snapshot', async () => {
        const f = await fixture();
        await prisma.toppingRecipe.deleteMany({ where: { toppingCode: 'KEM' } });
        await prisma.toppingRecipe.create({ data: { toppingCode: 'KEM', ingredientId: f.ingredient.id, quantity: 5 } });
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'L', qty: 2, toppings: ['KEM'] }]).expect(201);
        expect(await stock(f.ingredient.id)).toBe(30); // (20 * 1.5 + 5) * 2
        expect(await stock(f.cups.id)).toBe(98);
        await prisma.recipe.updateMany({ where: { productId: f.product.id }, data: { quantity: 50 } });
        await prisma.toppingRecipe.updateMany({ where: { toppingCode: 'KEM' }, data: { quantity: 10 } });
        await cancelOrder(app, token, order.body.id).expect(200);
        expect(await stock(f.ingredient.id)).toBe(100);
        expect(await stock(f.cups.id)).toBe(100);
    });
    it('menu tính hết hàng theo tổ hợp size/topping, đơn vượt kho rollback', async () => {
        const f = await fixture(30);
        await prisma.toppingRecipe.deleteMany({ where: { toppingCode: 'KEM' } });
        await prisma.toppingRecipe.create({ data: { toppingCode: 'KEM', ingredientId: f.ingredient.id, quantity: 5 } });
        const detail = await request(app.getHttpServer()).get(`/products/${f.product.id}`).expect(200);
        expect(detail.body.availability.find((r: { size: string; toppings: string[] }) => r.size === 'L' && r.toppings.length === 0).available).toBe(1);
        expect(detail.body.availability.find((r: { size: string; toppings: string[] }) => r.size === 'L' && r.toppings.join() === 'KEM').available).toBe(0);
        await createOrder(app, token, [{ productId: f.product.id, size: 'L', qty: 1, toppings: ['KEM'] }]).expect(409);
        expect(await stock(f.ingredient.id)).toBe(30);
    });
    it('hai món khác nhau tranh nguyên liệu cuối: chỉ một đơn thành công', async () => {
        const f = await fixture(30);
        const other = await prisma.product.create({ data: { name: 'p13 other', price: 40000, imageUrl: '/test.jpg',
            recipes: { create: { ingredientId: f.ingredient.id, quantity: 20, scalesWithSize: true } } } });
        productIds.push(other.id);
        const res = await Promise.all([f.product.id, other.id].map(productId => createOrder(app, token, [{ productId, size: 'L', qty: 1 }])));
        expect(res.map(r => r.status).sort()).toEqual([201, 409]);
        expect(await stock(f.ingredient.id)).toBe(0);
    });
    it('hết hạn: hai worker chỉ hoàn một lần và API trả thông báo đặt lại', async () => {
        const f = await fixture();
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'M', qty: 1 }]).expect(201);
        expect(order.body.reservationExpiresAt).toBeTruthy();
        await overdue(order.body.id);
        await Promise.all([expiry.expireOne(order.body.id), expiry.expireOne(order.body.id)]);
        expect(await stock(f.ingredient.id)).toBe(100);
        const response = await request(app.getHttpServer()).get(`/orders/${order.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
        expect(response.body.status).toBe('CANCELLED');
        expect(response.body.expiryMessage).toContain('vui lòng đặt lại');
        await pay(app, token, order.body.id, randomUUID()).expect(409);
        expect(await expiry.expireOne(order.body.id)).toBe(false);
    });
    it('quá deadline trước khi worker chạy: chặn thanh toán mock và giữ nguyên tới lúc đóng đơn', async () => {
        vi.stubEnv('VNPAY_ENABLED', 'false');
        const f = await fixture();
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'S', qty: 1 }]).expect(201);
        await overdue(order.body.id);
        const res = await pay(app, token, order.body.id, randomUUID()).expect(409);
        expect(res.body.message).toContain('vui lòng đặt lại');
        await expiry.sweep();
        expect(await stock(f.ingredient.id)).toBe(100);
    });
    it('lỗi release rollback trạng thái và kho; worker lần sau xử lý lại được', async () => {
        const f = await fixture();
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'S', qty: 1 }]).expect(201);
        await overdue(order.body.id);
        const inventory = app.get(InventoryService), original = inventory.release.bind(inventory);
        const spy = vi.spyOn(inventory, 'release').mockImplementationOnce(async (tx, id) => { await original(tx, id); throw Error('rollback'); });
        await expect(expiry.expireOne(order.body.id)).rejects.toThrow('rollback'); spy.mockRestore();
        expect(await stock(f.ingredient.id)).toBe(80);
        expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('PENDING');
        expect(await expiry.expireOne(order.body.id)).toBe(true);
    });
    it('đơn đã trả tiền hoặc dùng credit không tự hết hạn', async () => {
        for (const mode of ['PAID', 'CREDIT']) {
            const f = await fixture();
            const order = await createOrder(app, token, [{ productId: f.product.id, size: 'S', qty: 1 }]).expect(201);
            await overdue(order.body.id);
            await prisma.order.update({ where: { id: order.body.id }, data: mode === 'PAID' ? { status: 'PAID' } : { creditApplied: 20000 } });
            expect(await expiry.expireOne(order.body.id)).toBe(false);
            expect(await stock(f.ingredient.id)).toBe(80);
        }
    });
    it.each([false, true])('IPN tiền về muộn, worker đã chạy=%s: REVIEW, không pha, không giữ lại kho', async (workerFirst) => {
        sandbox();
        const f = await fixture();
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'S', qty: 1 }]).expect(201);
        const attempt = await start(order.body.id).expect(201);
        await overdue(order.body.id);
        if (workerFirst) await expiry.expireOne(order.body.id);
        await start(order.body.id).expect(409);
        expect((await ipn(attempt.body.id)).body.RspCode).toBe('00');
        expect(await stock(f.ingredient.id)).toBe(100);
        expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('CANCELLED');
        expect((await prisma.vnpayAttempt.findUniqueOrThrow({ where: { id: attempt.body.id } })).status).toBe('REVIEW');
        expect(await prisma.paymentRefundCase.count({ where: { attemptId: attempt.body.id } })).toBe(1);
        expect(await prisma.payment.count({ where: { orderId: order.body.id } })).toBe(0);
    });
    it('QR giới hạn theo thời hạn giữ món; QR hết hạn sớm vẫn được tạo lại khi đơn còn hạn', async () => {
        sandbox();
        const f = await fixture();
        const order = await createOrder(app, token, [{ productId: f.product.id, size: 'S', qty: 1 }]).expect(201);
        const deadline = new Date(Date.now() + 5 * 60000);
        await prisma.order.update({ where: { id: order.body.id }, data: { reservationExpiresAt: deadline } });
        const first = await start(order.body.id).expect(201);
        expect(new Date(first.body.expiresAt).getTime()).toBe(deadline.getTime());
        await prisma.vnpayAttempt.update({ where: { id: first.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        const spy = vi.spyOn(app.get(VnpayGateway), 'query').mockRejectedValueOnce(Error('timeout'));
        const again = await start(order.body.id).expect(201); spy.mockRestore();
        expect(again.body.id).not.toBe(first.body.id);
        expect(await stock(f.ingredient.id)).toBe(80);
    });
});
