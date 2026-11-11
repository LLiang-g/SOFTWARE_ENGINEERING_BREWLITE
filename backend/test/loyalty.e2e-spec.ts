import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
    cleanupUsers, createOrder, createTestApp, createTestProduct, pay, registerUser,
} from './helpers';

describe('Sổ cái điểm thưởng', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let productId: number;
    let cheapProductId: number;
    const userIds: number[] = [];
    let sequence = 0;
    const key = () => `loyalty-${Date.now()}-${sequence++}`;

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        productId = (await createTestProduct(prisma)).id; // 40.000đ, size S: 4 điểm
        cheapProductId = (await prisma.product.create({
            data: { name: 'E2E rẻ', price: 9000, imageUrl: '/test.jpg', stock: 100 },
        })).id; // 9.000đ: chưa đủ 1 điểm
    });

    afterAll(async () => {
        await cleanupUsers(prisma, userIds);
        await prisma.product.deleteMany({ where: { id: { in: [productId, cheapProductId] } } });
        await app?.close();
    });

    async function customer() {
        const user = await registerUser(app);
        userIds.push(user.userId);
        return user;
    }

    async function paidOrder(token: string, id = productId) {
        const order = await createOrder(app, token, [{ productId: id, size: 'S', qty: 1 }]).expect(201);
        await pay(app, token, order.body.id, key()).expect(201);
        return order.body.id as number;
    }

    const ledgerOf = (userId: number) =>
        prisma.loyaltyTransaction.findMany({ where: { userId }, orderBy: { id: 'asc' } });

    it('thanh toán thành công ghi một dòng EARN khớp số điểm và số dư', async () => {
        const { token, userId } = await customer();
        const orderId = await paidOrder(token);

        const rows = await ledgerOf(userId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ orderId, type: 'EARN', points: 4, balanceAfter: 4 });
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(4);
    });

    it('nhiều đơn cộng dồn số dư, tổng sổ cái bằng loyaltyPoints', async () => {
        const { token, userId } = await customer();
        await paidOrder(token);
        await paidOrder(token);

        const rows = await ledgerOf(userId);
        expect(rows.map((r) => r.balanceAfter)).toEqual([4, 8]);
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        expect(rows.reduce((sum, r) => sum + r.points, 0)).toBe(user.loyaltyPoints);
    });

    it('gửi lại cùng Idempotency-Key không ghi thêm dòng', async () => {
        const { token, userId } = await customer();
        const order = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        const paymentKey = key();
        await pay(app, token, order.body.id, paymentKey).expect(201);
        await pay(app, token, order.body.id, paymentKey).expect(201);

        expect(await ledgerOf(userId)).toHaveLength(1);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(4);
    });

    it('thanh toán thất bại không ghi dòng nào', async () => {
        const { token, userId } = await customer();
        const order = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        await pay(app, token, order.body.id, key(), { simulateFailure: true }).expect(201);

        expect(await ledgerOf(userId)).toHaveLength(0);
    });

    it('đơn chưa đủ 1 điểm không ghi dòng nào', async () => {
        const { token, userId } = await customer();
        await paidOrder(token, cheapProductId);

        expect(await ledgerOf(userId)).toHaveLength(0);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(0);
    });

    it('mỗi đơn chỉ được ghi một dòng EARN', async () => {
        const { token, userId } = await customer();
        const orderId = await paidOrder(token);

        await expect(prisma.loyaltyTransaction.create({
            data: { userId, orderId, type: 'EARN', points: 4, balanceAfter: 8 },
        })).rejects.toMatchObject({ code: 'P2002' });
    });
});
