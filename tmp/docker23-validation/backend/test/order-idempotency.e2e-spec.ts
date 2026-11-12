import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConflictException, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/products/inventory.service';
import { cancelOrder, cleanupUsers, createTestApp, createTestProduct, deleteTestProducts, registerUser } from './helpers';

describe('Idempotency tạo đơn (API)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    const userIds: number[] = [];
    const productIds: number[] = [];

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        userIds.push(userId);
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        if (prisma) {
            await cleanupUsers(prisma, userIds);
            await deleteTestProducts(prisma, productIds);
        }
        await app?.close();
    });
    async function fixture(servings = 10) {
        const product = await createTestProduct(prisma, servings);
        productIds.push(product.id);
        const recipe = await prisma.recipe.findFirstOrThrow({ where: { productId: product.id } });
        return { productId: product.id, ingredientId: recipe.ingredientId };
    }
    const body = (productId: number, qty = 1) => ({ items: [{ productId, size: 'S', toppings: [], qty }] });
    const send = (key: string, payload: object, accessToken = token) =>
        request(app.getHttpServer()).post('/orders')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Idempotency-Key', key).send(payload);
    const stock = async (id: number) => (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock;

    it('mất phản hồi rồi gửi lại: cùng id, không trừ kho hoặc ghi snapshot lần hai', async () => {
        const f = await fixture();
        const key = randomUUID();
        const first = await send(key, body(f.productId, 2)).expect(201);
        const second = await send(key, body(f.productId, 2)).expect(201);
        expect(second.body.id).toBe(first.body.id);
        expect(await stock(f.ingredientId)).toBe(80);
        expect(await prisma.orderItem.count({ where: { productId: f.productId } })).toBe(1);
        expect(await prisma.orderInventoryReservation.count({ where: { ingredientId: f.ingredientId } })).toBe(1);
    });

    it('8 request đồng thời cùng key khi chỉ còn 1 ly đều nhận đúng một đơn', async () => {
        const f = await fixture(1);
        const key = randomUUID();
        const results = await Promise.all(Array.from({ length: 8 }, () => send(key, body(f.productId))));
        expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
        expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
        expect(await stock(f.ingredientId)).toBe(0);
        expect(await prisma.orderItem.count({ where: { productId: f.productId } })).toBe(1);
    });

    it('cùng key khác số lượng trả 409, không trừ thêm', async () => {
        const f = await fixture();
        const key = randomUUID();
        await send(key, body(f.productId)).expect(201);
        await send(key, body(f.productId, 2)).expect(409);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('hai nội dung khác nhau tranh cùng key chỉ một nội dung được tạo', async () => {
        const f = await fixture();
        const key = randomUUID();
        const results = await Promise.all([send(key, body(f.productId)), send(key, body(f.productId, 2))]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(await prisma.orderItem.count({ where: { productId: f.productId } })).toBe(1);
        const item = await prisma.orderItem.findFirstOrThrow({ where: { productId: f.productId } });
        expect(await stock(f.ingredientId)).toBe(100 - item.qty * 10);
    });

    it('hai khách dùng cùng chuỗi key vẫn có hai đơn độc lập', async () => {
        const f = await fixture();
        const other = await registerUser(app);
        userIds.push(other.userId);
        const key = randomUUID();
        const a = await send(key, body(f.productId)).expect(201);
        const b = await send(key, body(f.productId), other.token).expect(201);
        expect(a.body.id).not.toBe(b.body.id);
        expect(await stock(f.ingredientId)).toBe(80);
    });

    it('khác key là yêu cầu mua mới dù nội dung giống hệt', async () => {
        const f = await fixture();
        const a = await send(randomUUID(), body(f.productId)).expect(201);
        const b = await send(randomUUID(), body(f.productId)).expect(201);
        expect(a.body.id).not.toBe(b.body.id);
        expect(await stock(f.ingredientId)).toBe(80);
    });

    it('rollback trước khi tạo đơn không giữ key vĩnh viễn: retry được', async () => {
        const f = await fixture();
        const key = randomUUID();
        const spy = vi.spyOn(app.get(InventoryService), 'reserve')
            .mockRejectedValueOnce(new ConflictException('Simulated shortage'));
        try { await send(key, body(f.productId)).expect(409); }
        finally { spy.mockRestore(); }
        expect(await prisma.orderCreateRequest.findUnique({
            where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        })).toBeNull();
        expect(await stock(f.ingredientId)).toBe(100);
        await send(key, body(f.productId)).expect(201);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('đổi giá sau đặt vẫn replay đơn cũ, không tính giá/trừ kho lại', async () => {
        const f = await fixture();
        const key = randomUUID();
        const first = await send(key, body(f.productId)).expect(201);
        await prisma.product.update({ where: { id: f.productId }, data: { price: 90000 } });
        const again = await send(key, body(f.productId)).expect(201);
        expect(again.body.id).toBe(first.body.id);
        expect(again.body.total).toBe(40000);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it('đơn đã hủy vẫn replay đúng đơn, không giữ hàng trở lại', async () => {
        const f = await fixture();
        const key = randomUUID();
        const first = await send(key, body(f.productId)).expect(201);
        await cancelOrder(app, token, first.body.id).expect(200);
        const again = await send(key, body(f.productId)).expect(201);
        expect(again.body.id).toBe(first.body.id);
        expect(again.body.status).toBe('CANCELLED');
        expect(await stock(f.ingredientId)).toBe(100);
    });

    it('chuẩn hóa thứ tự topping và voucher trước khi so sánh', async () => {
        const f = await fixture();
        const voucherCode = `IDEM-${randomUUID()}`.toUpperCase();
        const voucher = await prisma.voucher.create({ data: {
            code: voucherCode, discountPercent: 10, expiresAt: new Date('2030-01-01'),
        } });
        try {
            const key = randomUUID();
            const a = await send(key, {
                items: [{ productId: f.productId, size: 'S', toppings: ['KEM', 'TRAN_CHAU'], qty: 1 }],
                voucherCode: ` ${voucherCode.toLowerCase()} `,
            }).expect(201);
            const b = await send(key, {
                items: [{ productId: f.productId, size: 'S', toppings: ['TRAN_CHAU', 'KEM'], qty: 1 }],
                voucherCode,
            }).expect(201);
            expect(b.body.id).toBe(a.body.id);
        } finally {
            await prisma.order.updateMany({ where: { voucherId: voucher.id }, data: { voucherId: null } });
            await prisma.voucher.delete({ where: { id: voucher.id } });
        }
    });

    it('khác size/topping/voucher không thể dùng lại key đã thành công', async () => {
        const f = await fixture();
        const key = randomUUID();
        await send(key, body(f.productId)).expect(201);
        for (const payload of [
            { items: [{ productId: f.productId, size: 'L', qty: 1 }] },
            { items: [{ productId: f.productId, size: 'S', toppings: ['KEM'], qty: 1 }] },
            { ...body(f.productId), voucherCode: 'DIFFERENT' },
        ]) await send(key, payload).expect(409);
        expect(await stock(f.ingredientId)).toBe(90);
    });

    it.each(['', 'short', 'x'.repeat(101), 'contains space'])('key không hợp lệ bị chặn: %s', async (key) => {
        const f = await fixture();
        await send(key, body(f.productId)).expect(400);
        expect(await stock(f.ingredientId)).toBe(100);
    });

    it('thiếu key bị chặn; thiếu JWT không lộ đơn của key đã có', async () => {
        const f = await fixture();
        await request(app.getHttpServer()).post('/orders').set('Authorization', `Bearer ${token}`)
            .send(body(f.productId)).expect(400);
        const key = randomUUID();
        await send(key, body(f.productId)).expect(201);
        await request(app.getHttpServer()).post('/orders').set('Idempotency-Key', key)
            .send(body(f.productId)).expect(401);
        expect(await stock(f.ingredientId)).toBe(90);
    });
});
