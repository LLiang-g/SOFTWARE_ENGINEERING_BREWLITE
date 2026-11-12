import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersGateway } from '../src/realtime/orders.gateway';
import { MockGatewayService } from '../src/payments/mock-gateway.service';
import { LoyaltyService } from '../src/promotions/loyalty.service';
import { calcServings } from '../src/products/availability';
import type { OrderStatus } from '../src/generated/prisma/client';
import {
    cancelOrder, cleanupUsers, createBarista, createOrder, createTestApp,
    createTestProduct, deleteTestProducts, pay, registerUser, servingsOf,
} from './helpers';

describe('API nhân viên và WebSocket', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let baristaToken: string;
    let baristaId: number;
    let otherToken: string;
    let userId: number;
    let otherUserId: number;
    let productId: number;
    const sockets: Socket[] = [];
    const pendingListeners = new Set<() => void>();
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
            const cleanup = () => {
                clearTimeout(timer);
                socket.off('connect', connected);
                socket.off('connect_error', failed);
            };
            const connected = () => { cleanup(); resolve(); };
            const failed = (error: Error) => { cleanup(); reject(error); };
            const timer = setTimeout(() => failed(new Error('WebSocket kết nối quá hạn')), 5000);
            socket.once('connect', connected);
            socket.once('connect_error', failed);
            socket.connect();
        });
    }

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        ({ token: otherToken, userId: otherUserId } = await registerUser(app));
        ({ token: baristaToken, userId: baristaId } = await createBarista(app, prisma));
        productId = (await createTestProduct(prisma, 100, { scalesWithSize: false })).id;
        await connectSocket();
        await connectSocket();
    });

    afterEach(() => {
        pendingListeners.forEach((cleanup) => cleanup());
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        sockets.forEach((socket) => socket.disconnect());
        if (userId) await cleanupUsers(prisma, [userId, otherUserId, baristaId].filter(Boolean));
        if (productId) await deleteTestProducts(prisma, [productId]);
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

    // Mọi thao tác quầy đi kèm token của tài khoản barista.
    const staff = () => request.agent(app.getHttpServer()).set('Authorization', `Bearer ${baristaToken}`);

    const update = (id: number, status: string) => staff()
        .patch(`/staff/orders/${id}/status`).send({ status });

    function nextChange(socket: Socket, orderId: number, readStock = false) {
        const pending = new Promise<{ args: unknown[]; status: string | undefined; stock?: number }>((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                socket.off('orders.changed', listener);
                pendingListeners.delete(cleanup);
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Không nhận được orders.changed'));
            }, 5000);
            const listener = async (...args: unknown[]) => {
                cleanup();
                try {
                    if (readStock) {
                        const [order, recipes] = await prisma.$transaction([
                            prisma.order.findUnique({ where: { id: orderId } }),
                            prisma.recipe.findMany({
                                where: { productId },
                                select: { quantity: true, ingredient: { select: { stock: true } } },
                            }),
                        ], { isolationLevel: 'RepeatableRead' });
                        const stock = calcServings(recipes.map((r) => ({ quantity: r.quantity, stock: r.ingredient.stock })));
                        resolve({ args, status: order?.status, stock });
                        return;
                    }
                    const order = await prisma.order.findUnique({ where: { id: orderId } });
                    resolve({ args, status: order?.status });
                } catch (error) { reject(error); }
            };
            pendingListeners.add(cleanup);
            socket.once('orders.changed', listener);
        });
        // Promise được chờ sau HTTP; vẫn xử lý rejection nếu HTTP đã thất bại trước đó.
        void pending.catch(() => undefined);
        return pending;
    }

    async function paidOrderAt(status: 'PAID' | 'PREPARING' | 'READY') {
        const id = await newOrder();
        const paymentKey = key();
        let changes = sockets.map((socket) => nextChange(socket, id));
        await pay(app, token, id, paymentKey).expect(201);
        await Promise.all(changes);
        for (const next of ['PREPARING', 'READY'] as const) {
            if (status === 'PAID' || (next === 'READY' && status === 'PREPARING')) break;
            changes = sockets.map((socket) => nextChange(socket, id));
            await update(id, next).expect(200);
            await Promise.all(changes);
        }
        return { id, paymentKey };
    }

    async function recordChanges(action: () => Promise<unknown>) {
        const messages: unknown[][][] = sockets.map(() => []);
        const listeners = sockets.map((_, index) => (...args: unknown[]) => messages[index].push(args));
        sockets.forEach((socket, index) => socket.on('orders.changed', listeners[index]));
        try {
            await action();
            // Khoảng quan sát hữu hạn để phát hiện sự kiện thừa/không được phép trên wire.
            await new Promise((resolve) => setTimeout(resolve, 150));
            return messages;
        } finally {
            sockets.forEach((socket, index) => socket.off('orders.changed', listeners[index]));
        }
    }

    it('chỉ barista được vào: thiếu token 401, khách thường 403, barista 200', async () => {
        const id = await newOrder(true);
        const api = () => request(app.getHttpServer());
        await api().get('/staff/orders').expect(401);
        await api().patch(`/staff/orders/${id}/status`).send({ status: 'PREPARING' }).expect(401);
        await api().get('/staff/orders').set('Authorization', `Bearer ${token}`).expect(403);
        await api().patch(`/staff/orders/${id}/status`).set('Authorization', `Bearer ${token}`)
            .send({ status: 'PREPARING' }).expect(403);
        // Khách bị từ chối không làm đổi đơn.
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('PAID');
        await staff().get('/staff/orders').expect(200);
    });

    it('ẩn đơn chưa trả tiền và dữ liệu tài khoản', async () => {
        const pending = await newOrder();
        const paid = await newOrder(true);
        const response = await staff().get('/staff/orders').expect(200);
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
        const response = await staff().get('/staff/orders').expect(200);
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
        const stock = (await servingsOf(prisma, productId));
        const points = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
        for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
            const response = await update(id, status).expect(200);
            expect(response.body.status).toBe(status);
        }
        expect((await servingsOf(prisma, productId))).toBe(stock);
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
        await staff().patch(`/staff/orders/${id}/status`).send({}).expect(400);
        await update(2147483647, 'PREPARING').expect(404);
        await staff().patch('/staff/orders/abc/status')
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
        const response = await staff().get('/staff/orders').expect(200);
        expect(response.body.find((order: { id: number }) => order.id === id).status).toBe('PREPARING');
        await request(app.getHttpServer()).get(`/orders/${id}`).expect(401);
        await request(app.getHttpServer()).get(`/orders/${id}`)
            .set('Authorization', `Bearer ${otherToken}`).expect(404);
        const owner = await request(app.getHttpServer()).get(`/orders/${id}`)
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(owner.body.status).toBe('PREPARING');
        const changes = sockets.map((socket) => nextChange(socket, id));
        await update(id, 'READY').expect(200);
        expect(await Promise.all(changes)).toEqual([
            { args: [], status: 'READY' }, { args: [], status: 'READY' },
        ]);
    });

    it('hàng đợi hơn 20 đơn không cắt mất PAID, PREPARING hoặc READY và ẩn các đơn không xử lý', async () => {
        const createdAt = new Date();
        const states: OrderStatus[] = ['PAID', 'PREPARING', 'READY'];
        const active = await Promise.all(Array.from({ length: 27 }, (_, index) =>
            prisma.order.create({ data: { userId, total: 40000, status: states[index % 3], createdAt } }),
        ));
        const hidden = await Promise.all((['PENDING', 'PAYMENT_FAILED', 'CANCELLED'] as const).map((status) =>
            prisma.order.create({ data: { userId, total: 40000, status } }),
        ));
        const response = await staff().get('/staff/orders').expect(200);
        const ids: number[] = response.body.map((order: { id: number }) => order.id);
        const fixtureIds = new Set(active.map((order) => order.id));
        expect(ids.filter((id) => fixtureIds.has(id))).toEqual(active.map((order) => order.id).sort((a, b) => a - b));
        hidden.forEach((order) => expect(ids).not.toContain(order.id));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it.each([
        ['PAID', 'PREPARING'],
        ['PREPARING', 'READY'],
        ['READY', 'COMPLETED'],
    ] as const)('8 nhân viên cùng đổi %s → %s: một cập nhật, một sự kiện trên mỗi client', async (from, to) => {
        const { id } = await paidOrderAt(from);
        const stock = (await servingsOf(prisma, productId));
        const points = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
        const messages = await recordChanges(async () => {
            const responses = await Promise.all(Array.from({ length: 8 }, () => update(id, to)));
            expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
            expect(responses.filter((res) => res.status === 409)).toHaveLength(7);
        });
        expect(messages).toEqual([[[]], [[]]]);
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe(to);
        expect(await prisma.payment.count({ where: { orderId: id } })).toBe(1);
        expect((await servingsOf(prisma, productId))).toBe(stock);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(points);
    });

    it('replay, bấm lặp và chuyển lùi không phát sự kiện trên WebSocket thật', async () => {
        const { id, paymentKey } = await paidOrderAt('READY');
        const messages = await recordChanges(async () => {
            await pay(app, token, id, paymentKey).expect(201);
            await update(id, 'READY').expect(409);
            await update(id, 'PREPARING').expect(409);
            await update(id, 'CANCELLED').expect(400);
        });
        expect(messages).toEqual([[], []]);
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('READY');
    });

    it('lỗi cộng điểm sau khi đã ghi Payment/PAID rollback toàn bộ và không phát sự kiện', async () => {
        const id = await newOrder();
        const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const stock = (await servingsOf(prisma, productId));
        const award = vi.spyOn(app.get(LoyaltyService), 'award').mockRejectedValueOnce(new Error('Test loyalty rollback'));
        const messages = await recordChanges(async () => {
            await pay(app, token, id, key()).expect(500);
        });
        expect(award).toHaveBeenCalledTimes(1);
        expect(messages).toEqual([[], []]);
        expect(await prisma.payment.count({ where: { orderId: id } })).toBe(0);
        expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
        expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(before.loyaltyPoints);
        expect((await servingsOf(prisma, productId))).toBe(stock);
        const changes = sockets.map((socket) => nextChange(socket, id));
        await pay(app, token, id, key()).expect(201);
        expect(await Promise.all(changes)).toEqual([
            { args: [], status: 'PAID' }, { args: [], status: 'PAID' },
        ]);
    });

    it('hủy đơn chỉ thông báo khi tồn kho đã được hoàn, hủy lại không phát hoặc hoàn thêm', async () => {
        const id = await newOrder();
        const reservedStock = (await servingsOf(prisma, productId));
        const changes = sockets.map((socket) => nextChange(socket, id, true));
        await cancelOrder(app, token, id).expect(200);
        expect(await Promise.all(changes)).toEqual([
            { args: [], status: 'CANCELLED', stock: reservedStock + 1 },
            { args: [], status: 'CANCELLED', stock: reservedStock + 1 },
        ]);
        const messages = await recordChanges(async () => { await cancelOrder(app, token, id).expect(409); });
        expect(messages).toEqual([[], []]);
        expect((await servingsOf(prisma, productId))).toBe(reservedStock + 1);
    });

    it('thất bại lần đầu phát sự kiện; thất bại không đổi trạng thái không phát; thử lại thành công vào hàng đợi', async () => {
        const id = await newOrder();
        let changes = sockets.map((socket) => nextChange(socket, id));
        await pay(app, token, id, key(), { simulateFailure: true }).expect(201);
        expect(await Promise.all(changes)).toEqual([
            { args: [], status: 'PAYMENT_FAILED' }, { args: [], status: 'PAYMENT_FAILED' },
        ]);
        const messages = await recordChanges(async () => {
            await pay(app, token, id, key(), { simulateFailure: true }).expect(201);
        });
        expect(messages).toEqual([[], []]);
        const failedList = await staff().get('/staff/orders').expect(200);
        expect(failedList.body.some((order: { id: number }) => order.id === id)).toBe(false);
        changes = sockets.map((socket) => nextChange(socket, id));
        await pay(app, token, id, key()).expect(201);
        await Promise.all(changes);
        const paidList = await staff().get('/staff/orders').expect(200);
        expect(paidList.body.find((order: { id: number }) => order.id === id).status).toBe('PAID');
    });
});
