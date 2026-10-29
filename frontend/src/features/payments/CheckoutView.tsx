'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { selectTotal, useCartStore } from '@/features/cart/cart.store';
import { useHydrated } from '@/features/cart/useHydrated';
import { useAuthStore } from '@/features/auth/auth.store';
import { ApiError, createOrder, payOrder } from '@/lib/orders-api';
import { formatPrice } from '@/lib/format';
import { PaymentMethod } from '@/lib/types';

const METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'WALLET', label: 'Ví điện tử' },
    { value: 'CARD', label: 'Thẻ ngân hàng' },
];

function makeKey(): string {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );
}

export default function CheckoutView() {
    const router = useRouter();
    const hydrated = useHydrated();
    const user = useAuthStore((s) => s.user);
    const items = useCartStore((s) => s.items);
    const total = useCartStore(selectTotal);
    const clearCart = useCartStore((s) => s.clear);

    const [method, setMethod] = useState<PaymentMethod>('WALLET');
    const [simulateFailure, setSimulateFailure] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Giữ đơn đã tạo và mã Idempotency-Key giữa các lần bấm, để thử lại không tạo đơn mới.
    const orderIdRef = useRef<number | null>(null);
    const keyRef = useRef<string | null>(null);

    if (!hydrated) {
        return <p className="py-12 text-center text-gray-500">Đang tải...</p>;
    }

    if (!user) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Bạn cần đăng nhập để thanh toán.</p>
                <Link
                    href="/login?next=/checkout"
                    className="mt-3 inline-block rounded-lg bg-amber-600 px-5 py-2.5 font-medium text-white hover:bg-amber-700"
                >
                    Đăng nhập
                </Link>
            </div>
        );
    }

    if (items.length === 0 && !done) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Giỏ hàng đang trống.</p>
                <Link href="/" className="mt-3 inline-block text-amber-500 underline">
                    Về menu để chọn món
                </Link>
            </div>
        );
    }

    async function handlePay() {
        setError(null);
        setLoading(true);
        try {
            if (orderIdRef.current === null) {
                const order = await createOrder(
                    items.map((i) => ({
                        productId: i.productId,
                        size: i.size,
                        toppings: i.toppings,
                        qty: i.qty,
                    })),
                );
                orderIdRef.current = order.id;
            }
            const orderId = orderIdRef.current;

            if (keyRef.current === null) keyRef.current = makeKey();
            const result = await payOrder({
                orderId,
                method,
                simulateFailure,
                idempotencyKey: keyRef.current,
            });
            keyRef.current = null;

            if (result.status === 'PAID') {
                setDone(true);
                clearCart();
                router.push(`/orders/${orderId}`);
            } else {
                setError(
                    `${result.message ?? 'Thanh toán thất bại'}. Giỏ hàng vẫn được giữ nguyên, bạn có thể thử lại.`,
                );
            }
        } catch (err) {
            if (err instanceof ApiError) {
                keyRef.current = null;
                if (err.status === 401) {
                    useAuthStore.getState().logout();
                    router.push('/login?next=/checkout');
                    return;
                }
                setError(err.message);
            } else {
                setError(
                    'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa, rồi thử lại.',
                );
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            <section className="rounded-xl bg-white p-4 text-gray-900 shadow-sm">
                <h2 className="mb-3 font-semibold">Đơn hàng của bạn</h2>
                <ul className="space-y-2 text-sm">
                    {items.map((item) => (
                        <li key={item.key} className="flex justify-between gap-3">
              <span>
                {item.name} ({item.size}
                  {item.toppingNames.length > 0 &&
                      `, ${item.toppingNames.join(', ')}`}
                  ) × {item.qty}
              </span>
                            <span>{formatPrice(item.unitPrice * item.qty)}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 border-t pt-3 text-lg font-semibold">
                    Tổng: {formatPrice(total)}
                </p>
            </section>

            <section className="rounded-xl bg-white p-4 text-gray-900 shadow-sm">
                <h2 className="mb-1 font-semibold">Phương thức thanh toán</h2>
                <p className="mb-3 text-sm text-gray-600">Không dùng tiền mặt</p>
                <div className="space-y-2">
                    {METHODS.map((m) => (
                        <label key={m.value} className="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                name="method"
                                value={m.value}
                                checked={method === m.value}
                                onChange={() => setMethod(m.value)}
                            />
                            {m.label}
                        </label>
                    ))}
                </div>

                <label className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <input
                        type="checkbox"
                        checked={simulateFailure}
                        onChange={(e) => setSimulateFailure(e.target.checked)}
                    />
                    Giả lập thanh toán lỗi (chỉ để demo)
                </label>
            </section>

            {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <button
                type="button"
                onClick={handlePay}
                disabled={loading || done}
                className="w-full rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
                {loading ? 'Đang xử lý...' : `Xác nhận trả ${formatPrice(total)}`}
            </button>

            <Link href="/cart" className="block text-center text-sm text-gray-500 underline">
                ← Quay lại giỏ hàng
            </Link>
        </div>
    );
}