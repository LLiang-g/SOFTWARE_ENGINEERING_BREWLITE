import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp() {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    return { app, prisma: app.get(PrismaService) };
}

let counter = 0;

export async function registerUser(app: INestApplication) {
    const email = `e2e-${Date.now()}-${counter++}@test.local`;
    const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'secret123' })
        .expect(201);
    return {
        token: res.body.accessToken as string,
        userId: res.body.user.id as number,
    };
}

export type OrderItemInput = {
    productId: number;
    size: 'S' | 'M' | 'L';
    toppings?: string[];
    qty: number;
};

export function createOrder(
    app: INestApplication,
    token: string,
    items: OrderItemInput[],
) {
    return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items });
}

export function cancelOrder(
    app: INestApplication,
    token: string,
    orderId: number,
) {
    return request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);
}

export function pay(
    app: INestApplication,
    token: string,
    orderId: number,
    key?: string,
    extra: Record<string, unknown> = {},
) {
    const req = request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`);
    if (key) req.set('Idempotency-Key', key);
    return req.send({ orderId, method: 'WALLET', ...extra });
}

export function createTestProduct(prisma: PrismaService, stock = 100) {
    return prisma.product.create({
        data: {
            name: 'E2E test',
            price: 40000,
            imageUrl: '/test.jpg',
            stock,
        },
    });
}

export async function cleanupUsers(prisma: PrismaService, userIds: number[]) {
    if (userIds.length === 0) return;
    const orders = await prisma.order.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}