import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonical, hmac, readCallback, signedQuery, vietnamTime, queryResponseHash, type Fields } from './vnpay.crypto';
import { VnpayGateway } from './vnpay.gateway';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('VNPay protocol helpers', () => {
    it('HMAC-SHA512 khớp RFC 4231 test case 1', () => {
        expect(hmac('\x0b'.repeat(20), 'Hi There')).toBe(
            '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cde'
            + 'daa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854');
    });
    it('sort trường, encode khoảng trắng và & đúng một lần', () => {
        expect(canonical({ vnp_TxnRef: 'ABC', vnp_OrderInfo: 'Ca phe & tra' }))
            .toBe('vnp_OrderInfo=Ca+phe+%26+tra&vnp_TxnRef=ABC');
    });
    it('callback hợp lệ được đọc; sửa tiền hoặc thêm query trùng bị chặn', () => {
        const data = Object.fromEntries(new URLSearchParams(signedQuery({ vnp_Amount: '1000000', vnp_TxnRef: 'ABC' }, 'test-key')));
        expect(readCallback(data, 'test-key')?.vnp_TxnRef).toBe('ABC');
        expect(readCallback({ ...data, vnp_Amount: '1' }, 'test-key')).toBeNull();
        expect(readCallback({ ...data, vnp_Amount: ['1000000', '1'] }, 'test-key')).toBeNull();
        expect(readCallback({ ...data, vnp_SecureHash: 'bad' }, 'test-key')).toBeNull();
    });
    it('định dạng thời gian độc lập timezone máy, dùng GMT+7', () => {
        expect(vietnamTime(new Date('2026-11-12T00:00:00Z'))).toBe('20261112070000');
    });
    it('QueryDr xác minh response bằng chuỗi trường theo giao thức, không dùng querystring', async () => {
        vi.stubEnv('VNPAY_ENABLED', 'true'); vi.stubEnv('VNPAY_TMN_CODE', 'TEST0001');
        vi.stubEnv('VNPAY_HASH_SECRET', 'test-key'); vi.stubEnv('PUBLIC_BASE_URL', 'https://example.ngrok-free.app');
        const fields: Fields = { vnp_ResponseId: 'response1', vnp_Command: 'querydr', vnp_ResponseCode: '00',
            vnp_Message: 'OK', vnp_TmnCode: 'TEST0001', vnp_TxnRef: 'ABC', vnp_Amount: '1000000',
            vnp_BankCode: 'NCB', vnp_PayDate: '20261112070000', vnp_TransactionNo: '123',
            vnp_TransactionType: '01', vnp_TransactionStatus: '00', vnp_OrderInfo: 'test' };
        fields.vnp_SecureHash = queryResponseHash(fields, 'test-key');
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fields });
        vi.stubGlobal('fetch', fetchMock);
        const gateway = new VnpayGateway();
        expect((await gateway.query({ txnRef: 'ABC', createDate: '20261112060000' })).vnp_TransactionStatus).toBe('00');
        const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Fields;
        expect(request.vnp_SecureHash).toBe(hmac('test-key', [request.vnp_RequestId, '2.1.0', 'querydr', 'TEST0001',
            'ABC', '20261112060000', request.vnp_CreateDate, request.vnp_IpAddr, request.vnp_OrderInfo].join('|')));
        fields.vnp_Amount = '1';
        await expect(gateway.query({ txnRef: 'ABC', createDate: '20261112060000' })).rejects.toThrow();
    });
});
