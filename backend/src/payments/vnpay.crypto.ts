import { createHmac, timingSafeEqual } from 'node:crypto';

export type Fields = Record<string, string>;
export function hmac(secret: string, data: string): string {
    return createHmac('sha512', secret).update(data, 'utf8').digest('hex');
}
export function validHash(actual: string | undefined, expected: string): boolean {
    return typeof actual === 'string' && /^[a-fA-F0-9]{128}$/.test(actual)
        && timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
// Encode sorted keys/values exactly once using form encoding (space => +).
export function canonical(fields: Fields): string {
    const query = new URLSearchParams();
    for (const key of Object.keys(fields).sort()) {
        if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') query.append(key, fields[key]);
    }
    return query.toString();
}
export function signedQuery(fields: Fields, secret: string): string {
    const data = canonical(fields);
    return `${data}&vnp_SecureHash=${hmac(secret, data)}`;
}
export function readCallback(input: Record<string, unknown>, secret: string): Fields | null {
    const fields: Fields = {};
    for (const [key, value] of Object.entries(input)) {
        if (!key.startsWith('vnp_')) continue;
        if (typeof value !== 'string' || value.length > 1024) return null;
        fields[key] = value;
    }
    return validHash(fields.vnp_SecureHash, hmac(secret, canonical(fields))) ? fields : null;
}
export function vietnamTime(date: Date): string {
    return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace(/[-:T]/g, '');
}
export const QUERY_RESPONSE_FIELDS = [
    'vnp_ResponseId', 'vnp_Command', 'vnp_ResponseCode', 'vnp_Message', 'vnp_TmnCode',
    'vnp_TxnRef', 'vnp_Amount', 'vnp_BankCode', 'vnp_PayDate', 'vnp_TransactionNo',
    'vnp_TransactionType', 'vnp_TransactionStatus', 'vnp_OrderInfo',
    'vnp_PromotionCode', 'vnp_PromotionAmount',
];
export function queryResponseHash(fields: Fields, secret: string): string {
    return hmac(secret, QUERY_RESPONSE_FIELDS.map((key) => fields[key] ?? '').join('|'));
}
