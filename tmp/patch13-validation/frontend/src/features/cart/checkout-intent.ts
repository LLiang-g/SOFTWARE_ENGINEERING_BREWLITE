import type { NewOrderItem } from '../../lib/orders-api';

export type CheckoutIntent = {
    key: string;
    body: string;
    items: NewOrderItem[];
    voucherCode?: string;
};

// Lưu trước khi gửi: reload cùng tab sau khi mất phản hồi vẫn dùng lại key.
// Không lưu token, và không dùng chung intent giữa hai tài khoản.
export function prepareCheckoutIntent(
    userId: number,
    items: NewOrderItem[],
    voucherCode?: string,
    storage: Storage = window.sessionStorage,
    makeKey: () => string = () => crypto.randomUUID(),
): CheckoutIntent {
    const normalizedItems = items.map((item) => ({
        productId: item.productId,
        size: item.size,
        toppings: [...item.toppings].sort(),
        qty: item.qty,
    }));
    const normalizedVoucher = voucherCode?.trim().toUpperCase() || undefined;
    const body = JSON.stringify({ items: normalizedItems, voucherCode: normalizedVoucher ?? null });
    const storageKey = `brewlite-checkout:${userId}`;
    const saved = storage.getItem(storageKey);
    if (saved) {
        const previous = JSON.parse(saved) as { key?: unknown; body?: unknown };
        if (typeof previous.key !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(previous.key)
            || typeof previous.body !== 'string') {
            throw new Error('Dữ liệu đặt hàng đang lưu không hợp lệ. Kiểm tra lịch sử đơn trước khi đặt lại.');
        }
        if (previous.body === body) {
            return { key: previous.key, body, items: normalizedItems, voucherCode: normalizedVoucher };
        }
        throw new Error('Còn yêu cầu đặt hàng chưa xác nhận với nội dung khác. Kiểm tra lịch sử đơn trước khi bắt đầu lần đặt mới.');
    }
    const key = makeKey();
    // Nếu không lưu được thì không gửi request: tránh tự retry bằng key mới.
    storage.setItem(storageKey, JSON.stringify({ key, body }));
    return { key, body, items: normalizedItems, voucherCode: normalizedVoucher };
}

// Chỉ gọi sau khi khách chủ động xác nhận đã kiểm tra đơn trước.
export function discardCheckoutIntent(userId: number, storage: Storage = window.sessionStorage) {
    storage.removeItem(`brewlite-checkout:${userId}`);
}

export function completeCheckoutIntent(
    userId: number,
    key: string,
    storage: Storage = window.sessionStorage,
) {
    try {
        const storageKey = `brewlite-checkout:${userId}`;
        const saved = storage.getItem(storageKey);
        if (saved && (JSON.parse(saved) as { key?: string }).key === key) storage.removeItem(storageKey);
    } catch {
        // Server đã xác nhận đơn. Lỗi dọn storage không được biến thành yêu cầu đặt mới.
        // Giữ key cũ an toàn hơn: lần thử tiếp theo trả về chính đơn đã tạo.
    }
}
