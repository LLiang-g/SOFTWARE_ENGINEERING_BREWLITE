import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupUsers, createBarista, createTestApp, registerUser } from './helpers';

describe('Vai trò tài khoản', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    const userIds: number[] = [];

    beforeAll(async () => {
        ({ app, prisma } = await createTestApp());
    });

    afterAll(async () => {
        await cleanupUsers(prisma, userIds);
        await app?.close();
    });

    it('đăng ký luôn tạo tài khoản khách, bỏ qua role gửi lên', async () => {
        const email = `role-${Date.now()}@test.local`;
        const res = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email, password: 'secret123', role: 'BARISTA' })
            .expect(201);
        userIds.push(res.body.user.id);
        expect(res.body.user.role).toBe('CUSTOMER');
        const stored = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
        expect(stored.role).toBe('CUSTOMER');
    });

    it('đăng nhập và /auth/me trả về vai trò', async () => {
        const barista = await createBarista(app, prisma);
        userIds.push(barista.userId);
        const me = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${barista.token}`)
            .expect(200);
        expect(me.body).toMatchObject({ id: barista.userId, role: 'BARISTA' });
        expect(me.body).not.toHaveProperty('passwordHash');

        const customer = await registerUser(app);
        userIds.push(customer.userId);
        const customerMe = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${customer.token}`)
            .expect(200);
        expect(customerMe.body.role).toBe('CUSTOMER');
    });

    it('đổi vai trò trong database có hiệu lực ngay, không đợi token hết hạn', async () => {
        const barista = await createBarista(app, prisma);
        userIds.push(barista.userId);
        const list = () => request(app.getHttpServer())
            .get('/staff/orders')
            .set('Authorization', `Bearer ${barista.token}`);

        await list().expect(200);
        await prisma.user.update({ where: { id: barista.userId }, data: { role: 'CUSTOMER' } });
        await list().expect(403);
        await prisma.user.update({ where: { id: barista.userId }, data: { role: 'BARISTA' } });
        await list().expect(200);
    });
});
