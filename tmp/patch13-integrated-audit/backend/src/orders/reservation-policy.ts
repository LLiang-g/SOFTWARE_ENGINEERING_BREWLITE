export const RESERVATION_EXPIRED_MESSAGE = 'Đã hết thời gian đặt món, vui lòng đặt lại.';

export function reservationDeadline(now = new Date()): Date {
    const minutes = Number(process.env.ORDER_RESERVATION_MINUTES ?? 30);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
        throw new Error('ORDER_RESERVATION_MINUTES phải là số nguyên từ 1 đến 1440');
    return new Date(now.getTime() + minutes * 60000);
}

export function holdHasExpired(order: { reservationExpiresAt: Date | null; reservationExpiredAt: Date | null }, now = new Date()) {
    return order.reservationExpiredAt !== null ||
        (order.reservationExpiresAt !== null && order.reservationExpiresAt <= now);
}
