import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersGateway } from '../src/realtime/orders.gateway';
import { MockGatewayService } from '../src/payments/mock-gateway.service';
import {
    cancelOrder, cleanupUsers, createOrder, createTestApp,
    createTestProduct, pay, registerUser,
} from './helpers';

describe('API nhân viên và WebSocket', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let otherToken: string;
    let userId: number;
    let otherUserId: number;
    let productId: number;
    const sockets: Socket[] = [];
    let sequence = 0;
    const key = () => `staff-${Date.now()}-${sequence++}`;

    async function connectSocket() {
        const socket = io(`${await app.getUrl()}/orders-live`, {
            transports: ['websocket'], forceNew: true,
            reconnection: false, autoConnect: false,
        });
        sockets.push(socket);
        await waitForConnect(socket);
        return socket;
    }

    function waitForConnect(socket: Socket) {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('WebSocket kết nối quá hạn')), 5000);
            socket.once('connect', () => { clearTimeout(timer); resolve(); });
            socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
            socket.connect();
        });
    }

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        ({ token: otherToken, userId: otherUserId } = await registerUser(app));
        productId = (await createTestProduct(prisma)).id;
        await connectSocket();
        await connectSocket();
    });

    afterEach(() => { vi.restoreAllMocks(); });

    afterAll(async () => {
        sockets.forEach((socket) => socket.disconnect());
        if (userId) await cleanupUsers(prisma, [userId, otherUserId].filter(Boolean));
        if (productId) await prisma.product.deleteMany({ where: { id: productId } });
        await app?.close();
    });

    async function newOrder(paid = false) {
        const result = await createOrder(app, token, [
            { productId, size: 'M', toppings: ['KEM'], qty: 1 },
        ]).expect(201);
        const id = result.body.id as number;
        if (paid) await pay(app, token, id, key()).expect(201);
        return id;
    }

    const update = (id: number, status: string) => request(app.getHttpServer())
        .patch(`/staff/orders/${id}/status`).send({ status });

    function nextChange(socket: Socket, orderId: number) {
        return new Promise<{ args: unknown[]; status: string | undefined }>((resolve, reject) => {
            const timer = setTimeout(() => {
                socket.off('orders.changed', listener);
                reject(new Error('Không nhận được orders.changed'));
            }, 5000);
            const listener = async (...args: unknown[]) => {
                clearTimeout(timer);
                try {
                    const order = await prisma.order.findUnique({ where: { id: orderId } });
                    resolve({ args, status: order?.status });
                } catch (error) { reject(error); }
            };
            socket.once('orders.changed', listener);
        });
    }

    it('mở không cần token, ẩn đơn chưa trả tiền và dữ liệu tài khoản', async () => {
        const pending = await newOrder();
        const paid = await newOrder(true);
        const response = await request(app.getHttpServer()).get('/staff/orders').expect(200);
        expect(response.body.some((order: { id: number }) => order.id === pending)).toBe(false);
        const order = response.body.find((item: { id: number }) => item.id === paid);
        expect(order).toMatchObject({ status: 'PAID', total: 50000 });
        expect(order.items[0]).toMatchObject({ name: 'E2E test', size: 'M', qty: 1, toppingNames: ['Kem'] });
        for (const field of ['userId', 'user', 'email', 'passwordHash', 'payments']) {
            expect(order).not.toHaveProperty(field);
        }
    });

    it('giữ mọi đơn đang xử lý, sắp cũ trước và chỉ lấy 20 đơn hoàn tất gần nhất', async () => {
        const first = await newOrder(true);
        const second = await newOrder(true);
        const base = Date.now() + 60000;
        // Fixture trực tiếp chỉ phục vụ kiểm tra giới hạn danh sách hoàn tất.
        await prisma.order.createMany({
            data: Array.from({ length: 21 }, (_, index) => ({
                userId, total: 40000, status: 'COMPLETED' as const,
                createdAt: new Date(base + index * 1000),
            })),
        });
        const response = await request(app.getHttpServer()).get('/staff/orders').expect(200);
        const ids = response.body.map((order: { id: number }) => order.id);
        expect(ids.indexOf(first)).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(second)).toBeGreaterThan(ids.indexOf(first));
        const completed = response.body.filter((order: { status: string }) => order.status === 'COMPLETED');
        expect(completed).toHaveLength(20);
        expect(new Date(completed[0].createdAt).getTime()).toBe(base + 20000);
        expect(new Date(completed[19].createdAt).getTime()).toBe(base + 1000);
    });

    it('duyệt, pha xong, giao khách; không tạo Payment/trừ kho/cộng điểm lần nữa', async () => {
        const id = await newOrder(true);
        const stock = (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
        const points = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
        for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
            const response = await update(id, status).expect(200);
            expect(response.body.status).toBe(status);
        }
        expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(stock);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(points);
        expect(await prisma.payment.count({ where: { orderId: id } })).toBe(1);
        await update(id, 'PREPARING').expect(409);
    });

    it('chặn bỏ bước, trạng thái lạ, body thiếu và mã đơn sai', async () => {
        const id = await newOrder(true);
        await update(id, 'READY').expect(409);
        await update(id, 'COMPLETED').expect(409);
        await update(id, 'CANCELLED').expect(400);
        await update(id, 'UNKNOWN').expect(400);
        await request(app.getHttpServer()).patch(`/staff/orders/${id}/status`).send({}).expect(400);
        await update(2147483647, 'PREPARING').expect(404);
        await request(app.getHttpServer()).patch('/staff/orders/abc/status')
            .send({ status: 'PREPARING' }).expect(400);
    });

    it('không duyệt PENDING, PAYMENT_FAILED hoặc CANCELLED', async () => {
        const id = await newOrder();
        await update(id, 'PREPARING').expect(409);
        await pay(app, token, id, key(), { simulateFailure: true }).expect(201);
        await update(id, 'PREPARING').expect(409);
        await cancelOrder(app, token, id).expect(200);
        await update(id, 'PREPARING').expect(409);
    });

    it('hai nhân viên duyệt cùng lúc chỉ một bên thành công', async () => {
        const id = await newOrder(true);
        const [a, b] = await Promise.all([update(id, 'PREPARING'), update(id, 'PREPARING')]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('PREPARING');
    });

    it('thanh toán và đổi trạng thái báo hai client qua WebSocket sau commit, không payload', async () => {
        const id = await newOrder();
        let notifications = sockets.map((socket) => nextChange(socket, id));
        await pay(app, token, id, key()).expect(201);
        expect(await Promise.all(notifications)).toEqual([
            { args: [], status: 'PAID' }, { args: [], status: 'PAID' },
        ]);
        for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
            notifications = sockets.map((socket) => nextChange(socket, id));
            await update(id, status).expect(200);
            expect(await Promise.all(notifications)).toEqual([
                { args: [], status }, { args: [], status },
            ]);
        }
        expect(sockets[0].io.engine.transport.name).toBe('websocket');
    });

    it('hủy đơn phát sau khi đã hoàn kho; replay và thao tác lỗi không phát sự kiện', async () => {
        const id = await newOrder();
        const notification = nextChange(sockets[0], id);
        await cancelOrder(app, token, id).expect(200);
        expect(await notification).toEqual({ args: [], status: 'CANCELLED' });

        const paid = await newOrder();
        const paymentKey = key();
        await pay(app, token, paid, paymentKey).expect(201);
        const notify = vi.spyOn(app.get(OrdersGateway), 'notifyOrdersChanged');
        await pay(app, token, paid, paymentKey).expect(201);
        await update(paid, 'READY').expect(409);
        await cancelOrder(app, token, id).expect(409);
        expect(notify).not.toHaveBeenCalled();
    });

    it('thanh toán rollback không phát thông báo thành công', async () => {
        const id = await newOrder();
        const notify = vi.spyOn(app.get(OrdersGateway), 'notifyOrdersChanged');
        vi.spyOn(app.get(MockGatewayService), 'charge').mockRejectedValueOnce(new Error('Test gateway failure'));
        await pay(app, token, id, key()).expect(500);
        expect(await prisma.payment.count({ where: { orderId: id } })).toBe(0);
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
        expect(notify).not.toHaveBeenCalled();
    });

    it('kết nối lại được và đọc trạng thái mới qua API; quyền đọc riêng của khách giữ nguyên', async () => {
        const id = await newOrder(true);
        sockets[1].disconnect();
        await update(id, 'PREPARING').expect(200);
        await waitForConnect(sockets[1]);
        const response = await request(app.getHttpServer()).get('/staff/orders').expect(200);
        expect(response.body.find((order: { id: number }) => order.id === id).status).toBe('PREPARING');
        await request(app.getHttpServer()).get(`/orders/${id}`).expect(401);
        await request(app.getHttpServer()).get(`/orders/${id}`)
            .set('Authorization', `Bearer ${otherToken}`).expect(404);
        const owner = await request(app.getHttpServer()).get(`/orders/${id}`)
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(owner.body.status).toBe('PREPARING');
    });
});
