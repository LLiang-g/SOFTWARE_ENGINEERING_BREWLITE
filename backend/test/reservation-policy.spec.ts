import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdHasExpired, reservationDeadline } from '../src/orders/reservation-policy';
describe('Thời hạn giữ món', () => {
    afterEach(() => vi.unstubAllEnvs());
    it('mặc định 30 phút, hết hạn ngay tại ranh giới thời gian', () => {
        vi.stubEnv('ORDER_RESERVATION_MINUTES', '30');
        const now = new Date('2026-11-12T00:00:00Z');
        const row = { reservationExpiresAt: reservationDeadline(now), reservationExpiredAt: null };
        expect(row.reservationExpiresAt.toISOString()).toBe('2026-11-12T00:30:00.000Z');
        expect(holdHasExpired(row, new Date('2026-11-12T00:29:59Z'))).toBe(false);
        expect(holdHasExpired(row, row.reservationExpiresAt)).toBe(true);
    });
    it('không tự hết hạn đơn ngoại lệ không có deadline', () => {
        expect(holdHasExpired({ reservationExpiresAt: null, reservationExpiredAt: null })).toBe(false);
    });
    it('không chấp nhận cấu hình sai', () => {
        vi.stubEnv('ORDER_RESERVATION_MINUTES', '0');
        expect(() => reservationDeadline()).toThrow();
    });
});
