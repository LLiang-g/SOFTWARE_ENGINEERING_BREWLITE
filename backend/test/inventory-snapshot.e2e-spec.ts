import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/products/inventory.service';
import { OrdersService } from '../src/orders/orders.service';
import { cancelOrder, cleanupUsers, createOrder, createTestApp, registerUser } from './helpers';

describe('Snapshot nguyên liệu của đơn (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    const userIds: number[] = [];
    const productIds: number[] = [];
    const ingredientIds: number[] = [];
    let sequence = 0;

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        userIds.push(userId);
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        if (prisma) {
            await cleanupUsers(prisma, userIds);
            await prisma.recipe.deleteMany({ where: { productId: { in: productIds } } });
            await prisma.product.deleteMany({ where: { id: { in: productIds } } });
            await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
        }
        await app?.close();
    });

    async function ingredient(stock = 100) {
        const row = await prisma.ingredient.create({
            data: { name: `snapshot-${Date.now()}-${sequence++}`, unit: 'g', stock },
        });
        ingredientIds.push(row.id);
        return row.id;
    }

    async function drink(ingredientId: number, quantity = 20) {
        const row = await prisma.product.create({
            data: {
                name: `snapshot-drink-${Date.now()}-${sequence++}`,
                price: 40000,
                imageUrl: '/test.jpg',
                recipes: { create: { ingredientId, quantity } },
            },
        });
        productIds.push(row.id);
        return row.id;
    }

    const stockOf = async (id: number) =>
        (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock;
    const orderOf = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
    const snapshots = (orderId: number) => prisma.orderInventoryReservation.findMany({
        where: { orderId }, orderBy: { ingredientId: 'asc' },
    });

    it('sửa lượng công thức sau đặt không thay đổi lượng hoàn', async () => {
        const coffee = await ingredient();
        const productId = await drink(coffee);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 2 }]).expect(201);
        expect(await stockOf(coffee)).toBe(60);
        expect(await snapshots(created.body.id)).toMatchObject([
            { ingredientId: coffee, quantity: 40, releasedAt: null },
        ]);
        await prisma.recipe.updateMany({ where: { productId }, data: { quantity: 30 } });
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(coffee)).toBe(100);
        const [snapshot] = await snapshots(created.body.id);
        expect(snapshot.quantity).toBe(40);
        expect(snapshot.releasedAt).toBeInstanceOf(Date);
    });

    it('xóa và thay công thức vẫn hoàn nguyên liệu cũ, không cộng nguyên liệu mới', async () => {
        const oldIngredient = await ingredient();
        const newIngredient = await ingredient(200);
        const productId = await drink(oldIngredient);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        await prisma.recipe.deleteMany({ where: { productId } });
        await prisma.recipe.create({ data: { productId, ingredientId: newIngredient, quantity: 50 } });
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(oldIngredient)).toBe(100);
        expect(await stockOf(newIngredient)).toBe(200);
    });

    it('gộp lượng nguyên liệu dùng chung trong một snapshot của đơn', async () => {
        const shared = await ingredient();
        const first = await drink(shared, 10);
        const second = await drink(shared, 15);
        const created = await createOrder(app, token, [
            { productId: first, size: 'S', qty: 1 },
            { productId: first, size: 'L', qty: 1 },
            { productId: second, size: 'S', qty: 2 },
        ]).expect(201);
        // S: 10; L: 15; hai ly S món thứ hai: 30. Tổng giữ 55.
        expect(await stockOf(shared)).toBe(45);
        expect(await snapshots(created.body.id)).toMatchObject([{ ingredientId: shared, quantity: 55 }]);
        expect(await snapshots(created.body.id)).toHaveLength(1);
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(shared)).toBe(100);
    });

    it('hai yêu cầu hủy đồng thời chỉ hoàn một lần; gọi lại release cũng bị chặn', async () => {
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        const responses = await Promise.all([
            cancelOrder(app, token, created.body.id), cancelOrder(app, token, created.body.id),
        ]);
        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        expect(await stockOf(stuff)).toBe(100);
        const inventory = app.get(InventoryService);
        await expect(prisma.$transaction((tx) => inventory.release(tx, created.body.id)))
            .rejects.toThrow('đã được hoàn');
        expect(await stockOf(stuff)).toBe(100);
    });

    it('đơn cũ thiếu snapshot bị chặn và rollback trạng thái hủy', async () => {
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const legacy = await prisma.order.create({
            data: { userId, total: 40000, items: { create: {
                productId, size: 'S', qty: 1, lineTotal: 40000,
            } } },
        });
        const response = await cancelOrder(app, token, legacy.id).expect(409);
        expect(response.body.message).toContain('đối soát');
        expect((await orderOf(legacy.id)).status).toBe('PENDING');
        expect(await stockOf(stuff)).toBe(100);
    });

    it('tạo đơn lỗi sau bước trừ kho sẽ rollback cả kho và snapshot', async () => {
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const before = await prisma.orderInventoryReservation.count({ where: { ingredientId: stuff } });
        // Tổng tiền vượt Int: tạo Order thất bại sau khi reserve đã trừ nguyên liệu.
        await prisma.product.update({ where: { id: productId }, data: { price: 2147483647 } });
        await expect(app.get(OrdersService).create(userId, {
            items: [{ productId, size: 'S', qty: 2 }],
        }, 'snapshot-rollback-key')).rejects.toThrow();
        expect(await stockOf(stuff)).toBe(100);
        expect(await prisma.orderInventoryReservation.count({ where: { ingredientId: stuff } })).toBe(before);
        expect(await prisma.orderItem.count({ where: { productId } })).toBe(0);
    });

    it('lỗi sau khi hoàn nguyên liệu rollback cả kho, dấu hoàn và trạng thái đơn', async () => {
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        const inventory = app.get(InventoryService);
        const originalRelease = inventory.release.bind(inventory);
        const spy = vi.spyOn(inventory, 'release').mockImplementationOnce(async (tx, orderId) => {
            await originalRelease(tx, orderId);
            throw new Error('Intentional snapshot rollback test');
        });
        try {
            await cancelOrder(app, token, created.body.id).expect(500);
        } finally {
            spy.mockRestore();
        }
        expect(await stockOf(stuff)).toBe(80);
        expect((await orderOf(created.body.id)).status).toBe('PENDING');
        expect((await snapshots(created.body.id))[0].releasedAt).toBeNull();
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(stuff)).toBe(100);
    });

    it('khách khác không thể hủy đơn và hoàn nguyên liệu của chủ đơn', async () => {
        const other = await registerUser(app);
        userIds.push(other.userId);
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        await cancelOrder(app, other.token, created.body.id).expect(404);
        expect(await stockOf(stuff)).toBe(80);
        expect((await snapshots(created.body.id))[0].releasedAt).toBeNull();
    });

    it('snapshot bảo vệ nguyên liệu lịch sử khỏi bị xóa sau khi xóa công thức', async () => {
        const stuff = await ingredient();
        const productId = await drink(stuff);
        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
        await prisma.recipe.deleteMany({ where: { productId } });
        await expect(prisma.ingredient.delete({ where: { id: stuff } })).rejects.toMatchObject({ code: 'P2003' });
        await cancelOrder(app, token, created.body.id).expect(200);
        expect(await stockOf(stuff)).toBe(100);
    });
});
