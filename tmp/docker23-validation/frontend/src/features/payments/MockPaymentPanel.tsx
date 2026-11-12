'use client';

import { useRef, useState } from 'react';
import { IconCard, IconWallet } from '@/components/icons';
import { ApiError, payOrder } from '@/lib/orders-api';
import { formatPrice } from '@/lib/format';
import { PaymentMethod } from '@/lib/types';

const METHODS: { value: PaymentMethod; label: string; Icon: typeof IconWallet }[] = [
    { value: 'WALLET', label: 'Ví điện tử', Icon: IconWallet },
    { value: 'CARD', label: 'Thẻ ngân hàng', Icon: IconCard },
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
        <section className="mt-4 rounded-[24px] border border-line bg-paper p-5" aria-labelledby="pay-title">
            <h2 id="pay-title" className="font-display text-lg font-bold">Phương thức thanh toán</h2>
            <p className="mt-0.5 text-sm text-muted">Không dùng tiền mặt</p>

            <div role="radiogroup" aria-labelledby="pay-title" className="mt-4 grid grid-cols-2 gap-2.5">
                {METHODS.map(({ value, label, Icon }) => (
                    <label
                        key={value}
                        className="flex min-h-[76px] cursor-pointer flex-col items-start justify-center gap-1.5 rounded-2xl border-2 border-line px-4 py-3 text-sm font-medium transition has-[:checked]:border-espresso has-[:checked]:bg-espresso has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-espresso"
                    >
                        <input
                            type="radio"
                            name="method"
                            value={value}
                            checked={method === value}
                            onChange={() => setMethod(value)}
                            className="sr-only"
                        />
                        <Icon className="h-6 w-6" />
                        {label}
                    </label>
                ))}
            </div>

            <label className="mt-4 flex min-h-9 items-center gap-2.5 text-xs text-muted">
                <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="h-4 w-4 accent-espresso"
                />
                Giả lập thanh toán lỗi (chỉ để demo)
            </label>

            {error && (
                <p role="alert" className="mt-3 rounded-xl bg-chili-soft px-3 py-2.5 text-sm text-chili">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={handlePay}
                disabled={loading}
                className="mt-4 flex h-14 w-full items-center justify-between rounded-full bg-espresso px-6 font-semibold text-white transition hover:bg-roast active:scale-[0.99] disabled:opacity-60"
            >
                <span>{loading ? 'Đang xử lý...' : 'Thanh toán'}</span>
                <span className="tabular-nums">{formatPrice(total)}</span>
            </button>
        </section>
    );
}
