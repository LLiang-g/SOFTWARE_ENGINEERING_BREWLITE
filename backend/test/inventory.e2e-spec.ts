import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
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
});