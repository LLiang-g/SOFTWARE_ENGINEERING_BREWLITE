import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { calcServings } from '../src/products/availability';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp() {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    // Dùng một cổng cố định trong suốt bài test, cả HTTP và WebSocket dùng chung.
    await app.listen(0, '127.0.0.1');
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

// Tạo thẳng một tài khoản barista trong database rồi đăng nhập như người dùng thật.
export async function createBarista(app: INestApplication, prisma: PrismaService) {
    const email = `barista-${Date.now()}-${counter++}@test.local`;
    const user = await prisma.user.create({
        data: { email, passwordHash: await hash('secret123', 4), role: 'BARISTA' },
    });
    const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'secret123' })
        .expect(200);
    return { token: res.body.accessToken as string, userId: user.id };
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
    voucherCode?: string,
) {
    return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items, ...(voucherCode ? { voucherCode } : {}) });
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

// Mỗi ly của món test dùng 10 đơn vị một nguyên liệu riêng, nên servings ly = kho / 10.
const TEST_UNIT = 10;

/** Tạo món test cùng một nguyên liệu riêng và công thức, đủ để pha đúng `servings` ly. */
export async function createTestProduct(
    prisma: PrismaService,
    servings = 100,
    overrides: { name?: string; price?: number } = {},
) {
    const ingredient = await prisma.ingredient.create({
        data: {
            name: `E2E nguyên liệu ${Date.now()}-${counter++}`,
            unit: 'g',
            stock: servings * TEST_UNIT,
        },
    });
    return prisma.product.create({
        data: {
            name: overrides.name ?? 'E2E test',
            price: overrides.price ?? 40000,
            imageUrl: '/test.jpg',
            recipes: { create: { ingredientId: ingredient.id, quantity: TEST_UNIT } },
        },
    });
}

/** Số ly còn lại của món, tính từ kho nguyên liệu giống như API. */
export async function servingsOf(prisma: PrismaService, productId: number) {
    const recipes = await prisma.recipe.findMany({
        where: { productId },
        select: { quantity: true, ingredient: { select: { stock: true } } },
    });
    return calcServings(
        recipes.map((r) => ({ quantity: r.quantity, stock: r.ingredient.stock })),
    );
}

/** Xóa món test cùng công thức và các nguyên liệu mà công thức đó dùng. */
export async function deleteTestProducts(prisma: PrismaService, productIds: number[]) {
    if (productIds.length === 0) return;
    const recipes = await prisma.recipe.findMany({
        where: { productId: { in: productIds } },
        select: { ingredientId: true },
    });
    await prisma.recipe.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.ingredient.deleteMany({
        where: { id: { in: recipes.map((r) => r.ingredientId) } },
    });
}

export async function cleanupUsers(prisma: PrismaService, userIds: number[]) {
    if (userIds.length === 0) return;
    const orders = await prisma.order.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.loyaltyTransaction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
