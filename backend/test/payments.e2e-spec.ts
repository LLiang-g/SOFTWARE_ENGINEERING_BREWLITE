import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockGatewayService } from '../src/payments/mock-gateway.service';
import {
    cancelOrder,
    cleanupUsers,
    createOrder,
    createTestApp,
    createTestProduct,
    pay,
    registerUser,
} from './helpers';

describe('Thanh toán (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let gateway: MockGatewayService;
    let token: string;
    let userId: number;
    let productId: number;

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        gateway = app.get(MockGatewayService);
        ({ token, userId } = await registerUser(app));
        productId = (await createTestProduct(prisma)).id;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        if (userId) await cleanupUsers(prisma, [userId]);
        if (productId) {
            await prisma.product.deleteMany({ where: { id: productId } });
        }
        await app?.close();
    });

    async function newOrder(): Promise<number> {
        const res = await createOrder(app, token, [
            { productId, size: 'S', qty: 1 },
        ]).expect(201);
        return res.body.id as number;
    }

    function delayGateway() {
        const originalCharge = gateway.charge.bind(gateway);
        return vi.spyOn(gateway, 'charge').mockImplementation(async (input) => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return originalCharge(input);
        });
    }

    it('(b) gửi 2 lần liên tiếp cùng Idempotency-Key chỉ tạo 1 thanh toán', async () => {
        const orderId = await newOrder();
        const key = `seq-${Date.now()}`;
        const charge = vi.spyOn(gateway, 'charge');

        const first = await pay(app, token, orderId, key);
        const second = await pay(app, token, orderId, key);

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(first.body.status).toBe('PAID');
        expect(second.body.paymentId).toBe(first.body.paymentId);
        expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
        expect(charge).toHaveBeenCalledTimes(1);
    });

    it('(b) gửi 2 yêu cầu đồng thời cùng key vẫn chỉ tạo 1 thanh toán', async () => {
        const orderId = await newOrder();
        const key = `par-${Date.now()}`;
        const charge = delayGateway();

        const [a, b] = await Promise.all([
            pay(app, token, orderId, key),
            pay(app, token, orderId, key),
        ]);

        expect([a.status, b.status]).toEqual([201, 201]);
        expect(b.body.paymentId).toBe(a.body.paymentId);
        expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
        const order = await prisma.order.findUniqueOrThrow({
            where: { id: orderId },
        });
        expect(order.status).toBe('PAID');
        expect(charge).toHaveBeenCalledTimes(1);
    });

    it('cùng key nhưng cho đơn khác thì bị từ chối (409)', async () => {
        const key = `reuse-${Date.now()}`;
        const orderA = await newOrder();
        const orderB = await newOrder();

        await pay(app, token, orderA, key).expect(201);
        await pay(app, token, orderB, key).expect(409);
    });

    it('hai đơn dùng đồng thời cùng key chỉ gọi gateway một lần, đơn còn lại bị từ chối', async () => {
        const key = `cross-order-${Date.now()}`;
        const orderA = await newOrder();
        const orderB = await newOrder();
        const charge = delayGateway();

        const [a, b] = await Promise.all([
            pay(app, token, orderA, key),
            pay(app, token, orderB, key),
        ]);

        expect([a.status, b.status].sort()).toEqual([201, 409]);
        expect(charge).toHaveBeenCalledTimes(1);
        expect(
            await prisma.payment.count({ where: { idempotencyKey: key } }),
        ).toBe(1);
        const rejectedOrderId = a.status === 409 ? orderA : orderB;
        const rejectedOrder = await prisma.order.findUniqueOrThrow({
            where: { id: rejectedOrderId },
        });
        expect(rejectedOrder.status).toBe('PENDING');
    });

    it('thanh toán lỗi thì đơn PAYMENT_FAILED, thử lại bằng key mới thì PAID', async () => {
        const orderId = await newOrder();

        const failed = await pay(app, token, orderId, `fail-${Date.now()}`, {
            simulateFailure: true,
        });
        expect(failed.status).toBe(201);
        expect(failed.body.status).toBe('PAYMENT_FAILED');
        expect(
            (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status,
        ).toBe('PAYMENT_FAILED');
        expect(await prisma.payment.count({ where: { orderId } })).toBe(0);

        const retry = await pay(app, token, orderId, `retry-${Date.now()}`);
        expect(retry.body.status).toBe('PAID');
        expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    });

    it('thanh toán lại đơn đã PAID bằng key khác thì bị từ chối (409)', async () => {
        const orderId = await newOrder();
        await pay(app, token, orderId, `once-${Date.now()}`).expect(201);
        await pay(app, token, orderId, `twice-${Date.now()}`).expect(409);
        expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    });

    it('thiếu header Idempotency-Key thì báo lỗi 400', async () => {
        const orderId = await newOrder();
        await pay(app, token, orderId).expect(400);
    });

    it('(a) API chặn chuyển trạng thái sai: hủy 2 lần, thanh toán đơn đã hủy', async () => {
        const orderId = await newOrder();

        const cancelled = await cancelOrder(app, token, orderId).expect(200);
        expect(cancelled.body.status).toBe('CANCELLED');

        await cancelOrder(app, token, orderId).expect(409);
        await pay(app, token, orderId, `cancelled-${Date.now()}`).expect(409);
    });
});
