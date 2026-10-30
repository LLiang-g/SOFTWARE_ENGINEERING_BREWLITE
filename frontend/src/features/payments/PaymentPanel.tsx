'use client';

import { useRef, useState } from 'react';
import { ApiError, payOrder } from '@/lib/orders-api';
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

export default function PaymentPanel({
                                         orderId,
                                         total,
                                         onResult,
                                     }: {
    orderId: number;
    total: number;
    onResult: () => Promise<void>;
}) {
    const [method, setMethod] = useState<PaymentMethod>('WALLET');
    const [simulateFailure, setSimulateFailure] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const keyRef = useRef<string | null>(null);

    async function handlePay() {
        setError(null);
        setLoading(true);
        try {
            if (keyRef.current === null) keyRef.current = makeKey();
            const result = await payOrder({
                orderId,
                method,
                simulateFailure,
                idempotencyKey: keyRef.current,
            });
            keyRef.current = null;

            if (result.status === 'PAYMENT_FAILED') {
                setError(
                    `${result.message ?? 'Thanh toán thất bại'}. Đơn của bạn vẫn được giữ nguyên, bạn có thể thử lại.`,
                );
            }
            await onResult();
        } catch (err) {
            if (err instanceof ApiError) {
                keyRef.current = null;
                setError(
                    err.status === 401
                        ? 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'
                        : err.message,
                );
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
        <section className="mt-4 border-t pt-4 text-left">
            <h2 className="font-semibold">Phương thức thanh toán</h2>
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

            {error && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={handlePay}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
                {loading ? 'Đang xử lý...' : `Thanh toán ${formatPrice(total)}`}
            </button>
        </section>
    );
}