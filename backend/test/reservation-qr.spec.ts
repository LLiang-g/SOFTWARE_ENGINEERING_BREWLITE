import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VnpayGateway } from '../src/payments/vnpay.gateway';
describe('QR không vượt thời hạn giữ món', () => {
    beforeEach(() => {
        vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T00:00:00Z'));
        vi.stubEnv('VNPAY_ENABLED', 'true'); vi.stubEnv('VNPAY_TMN_CODE', 'TEST0001');
        vi.stubEnv('VNPAY_HASH_SECRET', 'test-secret'); vi.stubEnv('PUBLIC_BASE_URL', 'https://test.example');
        vi.stubEnv('VNPAY_PAYMENT_MINUTES', '10');
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
    it('giới hạn QR theo deadline gần hơn và ký cùng deadline đó', () => {
        const deadline = new Date(Date.now() + 45000);
        const result = new VnpayGateway().build(1, 40000, '127.0.0.1', deadline);
        expect(result.expiresAt).toEqual(deadline);
        expect(new URL(result.paymentUrl).searchParams.get('vnp_ExpireDate')).toBe('20261112070045');
    });
    it('QR vẫn hết hạn sớm hơn giữ món để có thể cấp QR mới', () => {
        const result = new VnpayGateway().build(1, 40000, '127.0.0.1', new Date(Date.now() + 30 * 60000));
        expect(result.expiresAt.getTime() - Date.now()).toBe(10 * 60000);
    });
    it('không cấp QR khi còn dưới năm giây giữ món', () => {
        expect(() => new VnpayGateway().build(1, 40000, '127.0.0.1', new Date(Date.now() + 4999))).toThrow('dưới 5 giây');
    });
});
