import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
    cleanupUsers,
    createOrder,
    createTestApp,
    createTestProduct,
    pay,
    registerUser,
} from './helpers';

describe('Khuyến mãi và điểm thưởng (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let userId: number;
    let productId: number;

    const suffix = Date.now();
    const VALID = `E2E10-${suffix}`;
    const EXPIRED = `E2EOLD-${suffix}`;
    const INACTIVE = `E2EOFF-${suffix}`;
    const voucherIds: number[] = [];
    const extraUserIds: number[] = [];

    async function makeVoucher(code: string, extra: Record<string, unknown> = {}) {
        const voucher = await prisma.voucher.create({
            data: {
                code,
                discountPercent: 10,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                ...extra,
            },
        });
        voucherIds.push(voucher.id);
    }

    function validate(code: string) {
        return request(app.getHttpServer())
            .post('/promotions/validate')
            .send({ code });
    }

    const pointsOf = async (id: number) =>
        (await prisma.user.findUniqueOrThrow({ where: { id } })).loyaltyPoints;

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
        ({ token, userId } = await registerUser(app));
        productId = (await createTestProduct(prisma)).id;
        await makeVoucher(VALID);
        await makeVoucher(EXPIRED, { expiresAt: new Date(Date.now() - 1000) });
        await makeVoucher(INACTIVE, { active: false });
    });

    afterAll(async () => {
        const users = [userId, ...extraUserIds].filter(Boolean);
        if (users.length > 0) await cleanupUsers(prisma, users);
        if (voucherIds.length > 0) {
            await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
        }
        if (productId) {
            await prisma.product.deleteMany({ where: { id: productId } });
        }
        await app?.close();
    });

    it('mã hợp lệ cho biết phần trăm giảm, không phân biệt hoa thường và khoảng trắng', async () => {
        const res = await validate(`  ${VALID.toLowerCase()}  `).expect(200);
        expect(res.body.code).toBe(VALID);
        expect(res.body.discountPercent).toBe(10);
    });

    it('mã không tồn tại bị từ chối (400)', async () => {
        const res = await validate('KHONG-CO-MA-NAY').expect(400);
        expect(res.body.message).toContain('không tồn tại');
    });

    it('mã hết hạn bị từ chối (400)', async () => {
        const res = await validate(EXPIRED).expect(400);
        expect(res.body.message).toContain('hết hạn');
    });

    it('mã đã ngừng áp dụng bị từ chối (400)', async () => {
        const res = await validate(INACTIVE).expect(400);
        expect(res.body.message).toContain('ngừng áp dụng');
    });

    it('đơn có mã giảm giá: backend tự tính giảm 10% và lưu số tiền sau giảm', async () => {
        const res = await createOrder(
            app,
            token,
            [{ productId, size: 'S', qty: 3 }],
            VALID,
        ).expect(201);

        expect(res.body.discount).toBe(12000);
        expect(res.body.total).toBe(108000);
        expect(res.body.voucherCode).toBe(VALID);
    });

    it('đơn không có mã giảm giá: giảm 0 và không có mã', async () => {
        const res = await createOrder(app, token, [
            { productId, size: 'S', qty: 3 },
        ]).expect(201);

        expect(res.body.discount).toBe(0);
        expect(res.body.total).toBe(120000);
        expect(res.body.voucherCode).toBeNull();
    });

    it('mã không hợp lệ làm đơn bị từ chối, không tạo đơn và không trừ kho', async () => {
        const stockBefore = (
            await prisma.product.findUniqueOrThrow({ where: { id: productId } })
        ).stock;
        const ordersBefore = await prisma.order.count({ where: { userId } });

        const res = await createOrder(
            app,
            token,
            [{ productId, size: 'S', qty: 1 }],
            EXPIRED,
        );

        expect(res.status).toBe(400);
        expect(
            (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
                .stock,
        ).toBe(stockBefore);
        expect(await prisma.order.count({ where: { userId } })).toBe(ordersBefore);
    });

    it('thanh toán đúng số tiền sau giảm và cộng điểm đúng một lần', async () => {
        const fresh = await registerUser(app);
        extraUserIds.push(fresh.userId);
        expect(await pointsOf(fresh.userId)).toBe(0);

        const order = await createOrder(
            app,
            fresh.token,
            [{ productId, size: 'S', qty: 3 }],
            VALID,
        ).expect(201);
        const orderId = order.body.id as number;

        // Thanh toán lỗi: chưa được điểm.
        await pay(app, fresh.token, orderId, `pt-fail-${suffix}`, {
            simulateFailure: true,
        }).expect(201);
        expect(await pointsOf(fresh.userId)).toBe(0);

        // Thanh toán thành công: số tiền là 108.000đ nên được 10 điểm.
        const key = `pt-ok-${suffix}`;
        const paid = await pay(app, fresh.token, orderId, key).expect(201);
        expect(paid.body.status).toBe('PAID');
        expect(await pointsOf(fresh.userId)).toBe(10);

        const payment = await prisma.payment.findFirstOrThrow({
            where: { orderId },
        });
        expect(payment.amount).toBe(108000);

        // Gửi lại cùng Idempotency-Key: không cộng thêm điểm.
        await pay(app, fresh.token, orderId, key).expect(201);
        expect(await pointsOf(fresh.userId)).toBe(10);
    });
});