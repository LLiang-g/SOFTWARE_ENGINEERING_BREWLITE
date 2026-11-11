import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
    cancelOrder, cleanupUsers, createOrder, createTestApp, registerUser, servingsOf,
} from './helpers';

describe('Nguyên liệu và công thức (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    const productIds: number[] = [];
    const ingredientIds: number[] = [];
    // Công thức gốc của từng topping, chụp một lần ở lần thay đầu tiên để trả lại đúng khi xong.
    const originalToppings = new Map<string, { toppingCode: string; ingredientId: number; quantity: number }[]>();
    let sequence = 0;

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
    });

    afterAll(async () => {
        if (userId) await cleanupUsers(prisma, [userId]);
        for (const [code, rows] of originalToppings) {
            await prisma.toppingRecipe.deleteMany({ where: { toppingCode: code } });
            await prisma.toppingRecipe.createMany({ data: rows });
        }
        await prisma.recipe.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });
        await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
        await app?.close();
    });

    async function ingredient(stock: number) {
        const row = await prisma.ingredient.create({
            data: { name: `E2E công thức ${Date.now()}-${sequence++}`, unit: 'g', stock },
        });
        ingredientIds.push(row.id);
        return row.id;
    }

    // Tạm thay công thức của một topping bằng dòng test, rồi trả lại công thức cũ sau khi chạy xong.
    async function toppingUses(code: string, lines: { ingredientId: number; quantity: number }[]) {
        if (!originalToppings.has(code)) {
            const saved = await prisma.toppingRecipe.findMany({ where: { toppingCode: code } });
            originalToppings.set(
                code,
                saved.map(({ toppingCode, ingredientId, quantity }) => ({ toppingCode, ingredientId, quantity })),
            );
        }
        await prisma.toppingRecipe.deleteMany({ where: { toppingCode: code } });
        await prisma.toppingRecipe.createMany({
            data: lines.map((l) => ({ toppingCode: code, ...l })),
        });
    }

    async function drink(recipe: { ingredientId: number; quantity: number; scalesWithSize?: boolean }[]) {
        const row = await prisma.product.create({
            data: {
                name: `E2E món ${Date.now()}-${sequence++}`,
                price: 40000,
                imageUrl: '/test.jpg',
                recipes: { create: recipe },
            },
        });
        productIds.push(row.id);
        return row.id;
    }

    const stockOf = async (id: number) =>
        (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock;

    it('số ly còn lại tính từ nguyên liệu khan hiếm nhất và không lưu thành cột', async () => {
        const coffee = await ingredient(100);
        const milk = await ingredient(90);
        const productId = await drink([
            { ingredientId: coffee, quantity: 20 },
            { ingredientId: milk, quantity: 30 },
        ]);

        const list = await request(app.getHttpServer()).get('/products').expect(200);
        const item = list.body.find((p: { id: number }) => p.id === productId);
        expect(item.available).toBe(3);
        expect(item).not.toHaveProperty('stock');
        expect(item).not.toHaveProperty('recipes');

        const one = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);
        expect(one.body.available).toBe(3);
        expect(one.body).not.toHaveProperty('recipes');
    });

    it('đặt hàng trừ đúng lượng nguyên liệu theo công thức', async () => {
        const coffee = await ingredient(100);
        const milk = await ingredient(200);
        const productId = await drink([
            { ingredientId: coffee, quantity: 20 },
            { ingredientId: milk, quantity: 30 },
        ]);

        await createOrder(app, token, [{ productId, size: 'S', qty: 2 }]).expect(201);

        expect(await stockOf(coffee)).toBe(60);
        expect(await stockOf(milk)).toBe(140);
        expect(await servingsOf(prisma, productId)).toBe(3);
    });

    it('hai món dùng chung nguyên liệu: bán món này làm món kia ít đi', async () => {
        const cup = await ingredient(5);
        const syrup = await ingredient(1000);
        const plain = await drink([{ ingredientId: cup, quantity: 1 }]);
        const fancy = await drink([
            { ingredientId: cup, quantity: 1 },
            { ingredientId: syrup, quantity: 10 },
        ]);

        await createOrder(app, token, [{ productId: plain, size: 'S', qty: 3 }]).expect(201);

        expect(await servingsOf(prisma, fancy)).toBe(2);
        const list = await request(app.getHttpServer()).get('/products').expect(200);
        expect(list.body.find((p: { id: number }) => p.id === fancy).available).toBe(2);
    });

    it('đơn nhiều món vượt nguyên liệu dùng chung bị từ chối cả đơn, không trừ gì', async () => {
        const cup = await ingredient(3);
        const a = await drink([{ ingredientId: cup, quantity: 1 }]);
        const b = await drink([{ ingredientId: cup, quantity: 1 }]);

        const res = await createOrder(app, token, [
            { productId: a, size: 'S', qty: 2 },
            { productId: b, size: 'S', qty: 2 },
        ]);

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('chỉ còn');
        expect(await stockOf(cup)).toBe(3);
        expect(await prisma.orderItem.count({ where: { productId: { in: [a, b] } } })).toBe(0);
    });

    it('món chưa có công thức không bán được và hiện 0 ly', async () => {
        const productId = await drink([]);

        const res = await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]);

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('chưa có công thức');
        const one = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);
        expect(one.body.available).toBe(0);
    });

    it('hủy đơn hoàn đúng từng nguyên liệu, hủy lần hai không hoàn thêm', async () => {
        const coffee = await ingredient(100);
        const milk = await ingredient(200);
        const productId = await drink([
            { ingredientId: coffee, quantity: 20 },
            { ingredientId: milk, quantity: 30 },
        ]);

        const created = await createOrder(app, token, [{ productId, size: 'S', qty: 2 }]).expect(201);
        expect([await stockOf(coffee), await stockOf(milk)]).toEqual([60, 140]);

        await cancelOrder(app, token, created.body.id).expect(200);
        expect([await stockOf(coffee), await stockOf(milk)]).toEqual([100, 200]);

        await cancelOrder(app, token, created.body.id).expect(409);
        expect([await stockOf(coffee), await stockOf(milk)]).toEqual([100, 200]);
    });

    it('đặt đồng thời: nguyên liệu khan hiếm chốt số đơn thành công, kho không âm', async () => {
        const coffee = await ingredient(100);
        const milk = await ingredient(90);
        const productId = await drink([
            { ingredientId: coffee, quantity: 20 },
            { ingredientId: milk, quantity: 30 },
        ]);

        const responses = await Promise.all(
            Array.from({ length: 8 }, () =>
                createOrder(app, token, [{ productId, size: 'S', qty: 1 }]),
            ),
        );

        expect(responses.filter((r) => r.status === 201)).toHaveLength(3);
        expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
        expect(await stockOf(milk)).toBe(0);
        expect(await stockOf(coffee)).toBe(40);
    });

    it('database chặn kho âm, lượng dùng bằng 0 và công thức trùng nguyên liệu', async () => {
        const stuff = await ingredient(10);
        const productId = await drink([{ ingredientId: stuff, quantity: 5 }]);

        await expect(
            prisma.ingredient.update({ where: { id: stuff }, data: { stock: -1 } }),
        ).rejects.toThrow();
        await expect(
            prisma.recipe.create({ data: { productId, ingredientId: await ingredient(1), quantity: 0 } }),
        ).rejects.toThrow();
        await expect(
            prisma.recipe.create({ data: { productId, ingredientId: stuff, quantity: 7 } }),
        ).rejects.toMatchObject({ code: 'P2002' });
        expect(await stockOf(stuff)).toBe(10);
    });

    describe('hệ số theo size', () => {
        it('size lớn dùng nhiều nguyên liệu hơn, ly nhựa giữ nguyên', async () => {
            const milk = await ingredient(1000);
            const cup = await ingredient(10);
            const productId = await drink([
                { ingredientId: milk, quantity: 100 },
                { ingredientId: cup, quantity: 1, scalesWithSize: false },
            ]);

            await createOrder(app, token, [{ productId, size: 'L', qty: 2 }]).expect(201);
            expect([await stockOf(milk), await stockOf(cup)]).toEqual([700, 8]);

            await createOrder(app, token, [{ productId, size: 'M', qty: 1 }]).expect(201);
            expect([await stockOf(milk), await stockOf(cup)]).toEqual([575, 7]);
        });

        it('API trả số ly còn lại theo từng size', async () => {
            const milk = await ingredient(1000);
            const cup = await ingredient(7);
            const productId = await drink([
                { ingredientId: milk, quantity: 100 },
                { ingredientId: cup, quantity: 1, scalesWithSize: false },
            ]);

            const one = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);
            expect(one.body.availableBySize).toEqual({ S: 7, M: 7, L: 6 });
            expect(one.body.available).toBe(7);

            const list = await request(app.getHttpServer()).get('/products').expect(200);
            const item = list.body.find((p: { id: number }) => p.id === productId);
            expect(item.availableBySize).toEqual({ S: 7, M: 7, L: 6 });
        });

        it('kho chỉ đủ ly nhỏ thì đơn size lớn bị từ chối, size nhỏ vẫn đặt được', async () => {
            const milk = await ingredient(140);
            const productId = await drink([{ ingredientId: milk, quantity: 100 }]);

            const large = await createOrder(app, token, [{ productId, size: 'L', qty: 1 }]);
            expect(large.status).toBe(409);
            expect(large.body.message).toContain('chỉ còn 0 phần');
            expect(await stockOf(milk)).toBe(140);

            await createOrder(app, token, [{ productId, size: 'S', qty: 1 }]).expect(201);
            expect(await stockOf(milk)).toBe(40);
        });

        it('hủy đơn hoàn đúng lượng theo size và topping', async () => {
            const milk = await ingredient(1000);
            const pearls = await ingredient(500);
            await toppingUses('TRAN_CHAU', [{ ingredientId: pearls, quantity: 50 }]);
            const productId = await drink([{ ingredientId: milk, quantity: 100 }]);

            const created = await createOrder(app, token, [
                { productId, size: 'L', qty: 2, toppings: ['TRAN_CHAU'] },
            ]).expect(201);
            expect([await stockOf(milk), await stockOf(pearls)]).toEqual([700, 400]);

            await cancelOrder(app, token, created.body.id).expect(200);
            expect([await stockOf(milk), await stockOf(pearls)]).toEqual([1000, 500]);
        });
    });

    describe('topping dùng nguyên liệu', () => {
        it('topping trừ nguyên liệu theo số ly, không nhân theo size', async () => {
            const coffee = await ingredient(1000);
            const pearls = await ingredient(100);
            await toppingUses('TRAN_CHAU', [{ ingredientId: pearls, quantity: 50 }]);
            const productId = await drink([{ ingredientId: coffee, quantity: 20 }]);

            await createOrder(app, token, [
                { productId, size: 'L', qty: 2, toppings: ['TRAN_CHAU'] },
            ]).expect(201);

            expect(await stockOf(pearls)).toBe(0);
            expect(await stockOf(coffee)).toBe(940);
        });

        it('API trả số phần topping còn lại, null nếu topping không theo dõi kho', async () => {
            const pearls = await ingredient(120);
            await toppingUses('TRAN_CHAU', [{ ingredientId: pearls, quantity: 50 }]);
            await toppingUses('KEM', []);
            const coffee = await ingredient(100);
            const productId = await drink([{ ingredientId: coffee, quantity: 20 }]);

            const one = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);
            const byCode = Object.fromEntries(
                one.body.options.toppings.map((t: { code: string; available: number | null }) => [t.code, t.available]),
            );
            expect(byCode.TRAN_CHAU).toBe(2);
            expect(byCode.KEM).toBeNull();

            // Topping không theo dõi kho vẫn đặt được và không trừ gì thêm.
            await createOrder(app, token, [
                { productId, size: 'S', qty: 1, toppings: ['KEM'] },
            ]).expect(201);
            expect(await stockOf(coffee)).toBe(80);
        });

        it('hết topping thì cả đơn bị từ chối, nguyên liệu của món không bị trừ', async () => {
            const coffee = await ingredient(1000);
            const pearls = await ingredient(40);
            await toppingUses('TRAN_CHAU', [{ ingredientId: pearls, quantity: 50 }]);
            const productId = await drink([{ ingredientId: coffee, quantity: 20 }]);

            const res = await createOrder(app, token, [
                { productId, size: 'S', qty: 1, toppings: ['TRAN_CHAU'] },
            ]);

            expect(res.status).toBe(409);
            expect(res.body.message).toBe('Topping Trân châu chỉ còn 0 phần');
            expect(await stockOf(coffee)).toBe(1000);
            expect(await stockOf(pearls)).toBe(40);
        });

        it('database chặn lượng dùng của topping bằng 0 hoặc trùng nguyên liệu', async () => {
            const stuff = await ingredient(10);
            await toppingUses('KEM', [{ ingredientId: stuff, quantity: 5 }]);

            await expect(
                prisma.toppingRecipe.create({
                    data: { toppingCode: 'KEM', ingredientId: await ingredient(1), quantity: 0 },
                }),
            ).rejects.toThrow();
            await expect(
                prisma.toppingRecipe.create({
                    data: { toppingCode: 'KEM', ingredientId: stuff, quantity: 7 },
                }),
            ).rejects.toMatchObject({ code: 'P2002' });
        });
    });
});
