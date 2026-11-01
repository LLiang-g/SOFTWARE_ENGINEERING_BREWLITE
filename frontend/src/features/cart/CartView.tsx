'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore, selectTotal } from './cart.store';
import { useHydrated } from './useHydrated';
import { useAuthStore } from '@/features/auth/auth.store';
import { ApiError, createOrder } from '@/lib/orders-api';
import { validateVoucher } from '@/lib/api';
import { calcDiscount } from '@/lib/pricing';
import { formatPrice } from '@/lib/format';
import { VoucherInfo } from '@/lib/types';

export default function CartView() {
    const router = useRouter();
    const hydrated = useHydrated();
    const items = useCartStore((s) => s.items);
    const subtotal = useCartStore(selectTotal);
    const setQty = useCartStore((s) => s.setQty);
    const removeItem = useCartStore((s) => s.removeItem);
    const clearCart = useCartStore((s) => s.clear);
    const token = useAuthStore((s) => s.token);

    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [voucherInput, setVoucherInput] = useState('');
    const [voucher, setVoucher] = useState<VoucherInfo | null>(null);
    const [voucherError, setVoucherError] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);

    const discount = voucher
        ? calcDiscount(subtotal, voucher.discountPercent)
        : 0;
    const total = subtotal - discount;

    async function handleApplyVoucher() {
        const code = voucherInput.trim();
        if (!code) return;
        setApplying(true);
        setVoucherError(null);
        try {
            setVoucher(await validateVoucher(code));
            setVoucherInput('');
        } catch (err) {
            setVoucher(null);
            setVoucherError(
                err instanceof TypeError
                    ? 'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.'
                    : (err as Error).message,
            );
        } finally {
            setApplying(false);
        }
    }

    async function handlePlaceOrder() {
        if (!token) {
            router.push('/login?next=/cart');
            return;
        }
        setError(null);
        setPlacing(true);
        try {
            const order = await createOrder(
                items.map((i) => ({
                    productId: i.productId,
                    size: i.size,
                    toppings: i.toppings,
                    qty: i.qty,
                })),
                voucher?.code,
            );
            clearCart();
            router.push(`/orders/${order.id}`);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 401) {
                    useAuthStore.getState().logout();
                    router.push('/login?next=/cart');
                    return;
                }
                setError(err.message);
            } else {
                setError(
                    'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.',
                );
            }
            setPlacing(false);
        }
    }

    if (!hydrated) {
        return (
            <p className="py-12 text-center text-gray-500">Đang tải giỏ hàng...</p>
        );
    }

    if (items.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Giỏ hàng đang trống.</p>
                <Link href="/" className="mt-3 inline-block text-amber-500 underline">
                    Về menu để chọn món
                </Link>
            </div>
        );
    }

    return (
        <div>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li
                        key={item.key}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 text-gray-900 shadow-sm"
                    >
                        <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">
                                Size {item.size}
                                {item.toppingNames.length > 0 &&
                                    ` · ${item.toppingNames.join(', ')}`}
                            </p>
                            <p className="text-sm text-gray-600">
                                {formatPrice(item.unitPrice)} / ly
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-lg border border-gray-300">
                                <button
                                    type="button"
                                    onClick={() => setQty(item.key, item.qty - 1)}
                                    className="px-3 py-1 hover:bg-gray-100"
                                    aria-label="Giảm số lượng"
                                >
                                    −
                                </button>
                                <span className="min-w-8 text-center">{item.qty}</span>
                                <button
                                    type="button"
                                    onClick={() => setQty(item.key, item.qty + 1)}
                                    className="px-3 py-1 hover:bg-gray-100"
                                    aria-label="Tăng số lượng"
                                >
                                    +
                                </button>
                            </div>

                            <p className="w-24 text-right font-medium">
                                {formatPrice(item.unitPrice * item.qty)}
                            </p>

                            <button
                                type="button"
                                onClick={() => removeItem(item.key)}
                                className="text-sm text-red-600 hover:underline"
                            >
                                Xóa
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            <div className="mt-6 space-y-3 rounded-xl bg-white p-4 text-gray-900 shadow-sm">
                {voucher ? (
                    <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <span>
              Mã {voucher.code}: giảm {voucher.discountPercent}%
            </span>
                        <button
                            type="button"
                            onClick={() => setVoucher(null)}
                            className="underline"
                        >
                            Bỏ mã
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="flex gap-2">
                            <input
                                value={voucherInput}
                                onChange={(e) => setVoucherInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApplyVoucher();
                                }}
                                placeholder="Nhập mã giảm giá"
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            />
                            <button
                                type="button"
                                onClick={handleApplyVoucher}
                                disabled={applying || !voucherInput.trim()}
                                className="rounded-lg border border-amber-600 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                            >
                                {applying ? 'Đang kiểm tra...' : 'Áp dụng'}
                            </button>
                        </div>
                        {voucherError && (
                            <p className="mt-2 text-sm text-red-600">{voucherError}</p>
                        )}
                    </div>
                )}

                <div className="space-y-1 border-t pt-3 text-sm">
                    <div className="flex justify-between">
                        <span>Tạm tính</span>
                        <span>{formatPrice(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-green-700">
                            <span>Giảm giá</span>
                            <span>-{formatPrice(discount)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">Tổng: {formatPrice(total)}</p>
                    <button
                        type="button"
                        onClick={handlePlaceOrder}
                        disabled={placing}
                        className="rounded-lg bg-amber-600 px-6 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                        {placing ? 'Đang đặt...' : 'Đặt hàng'}
                    </button>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </div>
    );
}