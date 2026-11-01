export const POINT_UNIT = 10000;

export function calcDiscount(subtotal: number, percent: number): number {
    const safePercent = Math.min(Math.max(percent, 0), 100);
    const discount = Math.floor((subtotal * safePercent) / 100);
    return Math.min(discount, subtotal);
}

export function calcPoints(amount: number): number {
    return Math.max(0, Math.floor(amount / POINT_UNIT));
}