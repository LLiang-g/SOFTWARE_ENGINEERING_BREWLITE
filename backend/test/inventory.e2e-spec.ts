import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';
import {
    cancelOrder,
    cleanupUsers,
    createOrder,
    createTestApp,
    createTestProduct,
    registerUser,
} from './helpers';

describe('Tồn kho (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    const productIds: number[] = [];

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
    });

    afterAll(async () => {
        if (userId) await cleanupUsers(prisma, [userId]);
        if (productIds.length > 0) {
            await prisma.product.deleteMany({ where: { id: { in: productIds } } });
        }
        await app?.close();
    });

    async function newProduct(stock: number): Promise<number> {
        const product = await createTestProduct(prisma, stock);
        productIds.push(product.id);
        return product.id;
    }

    async function stockOf(id: number): Promise<number> {
        return (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;
    }

    it('(c) 10 đơn đồng thời cho món còn 3 phần: đúng 3 đơn thành công, không bán vượt', async () => {
        const productId = await newProduct(3);

        const responses = await Promise.all(
            Array.from({ length: 10 }, () =>
                createOrder(app, token, [{ productId, size: 'S', qty: 1 }]),
            ),
        );

        expect(responses.filter((r) => r.status === 201)).toHaveLength(3);
        expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
        expect(await stockOf(productId)).toBe(0);
        expect(await prisma.orderItem.count({ where: { productId } })).toBe(3);
    });

    it('(c) nhiều đơn số lượng 2 đặt đồng thời: tổng bán ra không vượt tồn kho', async () => {
        const productId = await newProduct(5);

        const responses = await Promise.all(
            Array.from({ length: 6 }, () =>
                createOrder(app, token, [{ productId, size: 'S', qty: 2 }]),
            ),
        );

        expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
        expect(await stockOf(productId)).toBe(1);
        const sold = await prisma.orderItem.aggregate({
            where: { productId },
            _sum: { qty: true },
        });
        expect(sold._sum.qty).toBe(4);
    });

    it('(c) đơn lớn hơn tồn kho bị từ chối và không đổi tồn kho', async () => {
        const productId = await newProduct(2);

        const res = await createOrder(app, token, [
            { productId, size: 'S', qty: 3 },
        ]);

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('chỉ còn 2 phần');
        expect(await stockOf(productId)).toBe(2);
        expect(await prisma.orderItem.count({ where: { productId } })).toBe(0);
    });

    it('hai dòng cùng một món (khác size) được cộng dồn khi kiểm kho', async () => {
        const productId = await newProduct(3);

        const res = await createOrder(app, token, [
            { productId, size: 'S', qty: 2 },
            { productId, size: 'L', qty: 2 },
        ]);

        expect(res.status).toBe(409);
        expect(await stockOf(productId)).toBe(3);
    });

    it('đơn nhiều dòng mà một món hết hàng thì cả đơn bị từ chối, món còn lại không bị trừ kho', async () => {
        const enough = await newProduct(10);
        const scarce = await newProduct(1);

        const res = await createOrder(app, token, [
            { productId: enough, size: 'S', qty: 2 },
            { productId: scarce, size: 'S', qty: 5 },
        ]);

        expect(res.status).toBe(409);
        expect(await stockOf(enough)).toBe(10);
        expect(await stockOf(scarce)).toBe(1);
        expect(
            await prisma.orderItem.count({
                where: { productId: { in: [enough, scarce] } },
            }),
        ).toBe(0);
    });

    it('hủy đơn thì hoàn kho, hủy lần hai không hoàn thêm', async () => {
        const productId = await newProduct(5);

        const created = await createOrder(app, token, [
            { productId, size: 'S', qty: 2 },
        ]).expect(201);
        expect(await stockOf(productId)).toBe(3);

        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(productId)).toBe(5);

        await cancelOrder(app, token, created.body.id).expect(409);
        expect(await stockOf(productId)).toBe(5);
    });

    it('từ chối giỏ hàng có mảng lồng nhau trước khi tạo đơn hoặc trừ kho', async () => {
        const productId = await newProduct(5);
        const before = await prisma.order.count({ where: { userId } });
        await request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({ items: [[{ productId, size: 'S', qty: 1 }]] })
            .expect(400);
        expect(await stockOf(productId)).toBe(5);
        expect(await prisma.order.count({ where: { userId } })).toBe(before);
    });

    it('không cho hủy đơn đã thanh toán bằng API hủy thông thường', async () => {
        const productId = await newProduct(5);
        const created = await createOrder(app, token, [
            { productId, size: 'S', qty: 2 },
        ]).expect(201);
        // Chuẩn bị trạng thái đã thanh toán; không gọi cổng thanh toán trong test tồn kho.
        await prisma.order.update({ where: { id: created.body.id }, data: { status: 'PAID' } });
        await cancelOrder(app, token, created.body.id).expect(409);
        expect(await stockOf(productId)).toBe(3);
        expect((await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } })).status).toBe('PAID');
    });

    it('hai yêu cầu hủy đồng thời chỉ hoàn kho một lần', async () => {
        const productId = await newProduct(5);
        const created = await createOrder(app, token, [
            { productId, size: 'S', qty: 2 },
        ]).expect(201);
        const responses = await Promise.all([
            cancelOrder(app, token, created.body.id),
            cancelOrder(app, token, created.body.id),
        ]);
        expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
        expect(await stockOf(productId)).toBe(5);
    });

    it('server tự tính giá size/topping và trừ tổng số ly của cùng món', async () => {
        const productId = await newProduct(5);
        const created = await request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
                total: 1,
                items: [
                    { productId, size: 'M', toppings: ['KEM'], qty: 2, lineTotal: 1 },
                    { productId, size: 'L', qty: 1 },
                ],
            }).expect(201);
        expect(created.body.total).toBe(150000);
        expect(created.body.items.map((item: { lineTotal: number }) => item.lineTotal)).toEqual([100000, 50000]);
        expect(await stockOf(productId)).toBe(2);
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(productId)).toBe(5);
    });

    it('chưa đăng nhập không thể đặt đơn hoặc trừ kho', async () => {
        const productId = await newProduct(5);
        await request(app.getHttpServer()).post('/orders')
            .send({ items: [{ productId, size: 'S', qty: 1 }] }).expect(401);
        expect(await stockOf(productId)).toBe(5);
    });

    it.each([0, -1, 1.5, 100, '2', null])('từ chối số lượng không hợp lệ %s, không trừ kho', async (qty) => {
        const productId = await newProduct(5);
        await request(app.getHttpServer()).post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({ items: [{ productId, size: 'S', qty }] }).expect(400);
        expect(await stockOf(productId)).toBe(5);
        expect(await prisma.orderItem.count({ where: { productId } })).toBe(0);
    });

    it.each([
        { productId: 2147483648, size: 'S', qty: 1 },
        { size: 'XL', qty: 1 },
        { size: 'S', qty: 1, toppings: ['KHONG_TON_TAI'] },
        { size: 'S', qty: 1, toppings: ['KEM', 'KEM'] },
    ])('dữ liệu món không hợp lệ không tạo đơn hoặc trừ kho: %j', async (item) => {
        const productId = await newProduct(5);
        const before = await prisma.order.count({ where: { userId } });
        await request(app.getHttpServer()).post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({ items: [{ productId, ...item }] }).expect(400);
        expect(await stockOf(productId)).toBe(5);
        expect(await prisma.order.count({ where: { userId } })).toBe(before);
    });

    it('mã giảm giá không tồn tại không tạo đơn hoặc trừ kho', async () => {
        const productId = await newProduct(5);
        await createOrder(app, token, [{ productId, size: 'S', qty: 1 }],
            `MISSING-${Date.now()}`).expect(400);
        expect(await stockOf(productId)).toBe(5);
        expect(await prisma.orderItem.count({ where: { productId } })).toBe(0);
    });
});
