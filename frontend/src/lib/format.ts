import type { OrderStatus } from './types';

export function formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    PENDING: 'Chờ thanh toán',
    PAID: 'Đã thanh toán',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    PREPARING: 'Đang pha chế',
    READY: 'Sẵn sàng nhận',
    COMPLETED: 'Đã hoàn tất',
    CANCELLED: 'Đã hủy',
};