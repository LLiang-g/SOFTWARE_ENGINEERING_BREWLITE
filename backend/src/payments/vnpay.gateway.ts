import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { hmac, queryResponseHash, signedQuery, validHash, vietnamTime, type Fields } from './vnpay.crypto';

const PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const QUERY_URL = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';

@Injectable()
export class VnpayGateway {
    enabled() { return process.env.VNPAY_ENABLED === 'true'; }
    config() {
        const secret = process.env.VNPAY_HASH_SECRET?.trim();
        const merchant = process.env.VNPAY_TMN_CODE?.trim();
        const publicBase = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
        const frontend = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
        const minutes = Number(process.env.VNPAY_PAYMENT_MINUTES ?? 10);
        if (!this.enabled() || !secret || !merchant || !publicBase
            || !Number.isInteger(minutes) || minutes < 1 || minutes > 30
            || (process.env.VNPAY_PAY_URL && process.env.VNPAY_PAY_URL !== PAY_URL)) {
            throw new ServiceUnavailableException('Cấu hình VNPay Sandbox chưa đầy đủ');
        }
        try {
            const callback = new URL(publicBase);
            const target = new URL(frontend);
            if (callback.protocol !== 'https:' || callback.pathname !== '/' || callback.search || callback.hash
                || callback.username || callback.password || target.username || target.password
                || target.search || target.hash || target.pathname !== '/'
                || (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)))) throw Error();
        } catch { throw new ServiceUnavailableException('URL callback/frontend chưa hợp lệ'); }
        return { secret, merchant, publicBase, frontend: new URL(frontend).origin, minutes };
    }
    build(orderId: number, amount: number, ip: string, reservationExpiresAt?: Date | null) {
        const config = this.config();
        if (!Number.isSafeInteger(amount) || amount < 5000 || amount * 100 > 999999999999) {
            throw new ServiceUnavailableException('Số tiền không nằm trong giới hạn VNPay của bản tích hợp');
        }
        const now = new Date();
        const expiresAt = new Date(Math.min(now.getTime() + config.minutes * 60000,
            reservationExpiresAt?.getTime() ?? Infinity));
        if (expiresAt.getTime() - now.getTime() < 5000)
            throw new ServiceUnavailableException('Thời gian giữ món còn dưới 5 giây; vui lòng chờ hết hạn và đặt lại');
        const createDate = vietnamTime(now);
        const txnRef = randomUUID().replace(/-/g, '');
        const clientIp = ip.replace(/^::ffff:/, '');
        const fields: Fields = {
            vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: config.merchant,
            vnp_Amount: String(amount * 100), vnp_CurrCode: 'VND', vnp_TxnRef: txnRef,
            vnp_OrderInfo: `Thanh toan don ${orderId}`, vnp_OrderType: 'other', vnp_Locale: 'vn',
            vnp_ReturnUrl: `${config.publicBase}/payments/vnpay/return`,
            vnp_IpAddr: isIP(clientIp) ? clientIp : '127.0.0.1',
            vnp_CreateDate: createDate, vnp_ExpireDate: vietnamTime(expiresAt),
        };
        return { txnRef, amount, merchantCode: config.merchant, createDate, expiresAt,
            paymentUrl: `${PAY_URL}?${signedQuery(fields, config.secret)}` };
    }
    async query(attempt: { txnRef: string; createDate: string }): Promise<Fields> {
        const config = this.config();
        const ip = process.env.VNPAY_QUERY_IP || '127.0.0.1';
        if (!isIP(ip)) throw new ServiceUnavailableException('VNPAY_QUERY_IP không hợp lệ');
        const fields: Fields = {
            vnp_RequestId: randomUUID().replace(/-/g, ''), vnp_Version: '2.1.0',
            vnp_Command: 'querydr', vnp_TmnCode: config.merchant, vnp_TxnRef: attempt.txnRef,
            vnp_TransactionDate: attempt.createDate, vnp_CreateDate: vietnamTime(new Date()),
            vnp_IpAddr: ip, vnp_OrderInfo: `Tra cuu ${attempt.txnRef}`,
        };
        const input = ['vnp_RequestId', 'vnp_Version', 'vnp_Command', 'vnp_TmnCode', 'vnp_TxnRef',
            'vnp_TransactionDate', 'vnp_CreateDate', 'vnp_IpAddr', 'vnp_OrderInfo'].map((key) => fields[key]).join('|');
        fields.vnp_SecureHash = hmac(config.secret, input);
        const response = await fetch(QUERY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields), signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new ServiceUnavailableException('VNPay chưa trả kết quả tra cứu');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ServiceUnavailableException('Phản hồi tra cứu không hợp lệ');
        const result: Fields = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value !== 'string' || value.length > 2000) throw new ServiceUnavailableException('Kiểu dữ liệu tra cứu không hợp lệ');
            result[key] = value;
        }
        if (!validHash(result.vnp_SecureHash, queryResponseHash(result, config.secret))
            || result.vnp_TmnCode !== config.merchant || result.vnp_TxnRef !== attempt.txnRef
            || result.vnp_Command !== 'querydr') throw new ServiceUnavailableException('Không xác minh được phản hồi VNPay');
        return result;
    }
}
