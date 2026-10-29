'use client';

import Link from 'next/link';
import { useCartStore, selectTotal } from './cart.store';
import { useHydrated } from './useHydrated';
import { formatPrice } from '@/lib/format';

export default function CartView() {
    const hydrated = useHydrated();
    const items = useCartStore((s) => s.items);
    const total = useCartStore(selectTotal);
    const setQty = useCartStore((s) => s.setQty);
    const removeItem = useCartStore((s) => s.removeItem);

    if (!hydrated) {
        return <p className="py-12 text-center text-gray-500">Đang tải giỏ hàng...</p>;
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

            <div className="mt-6 flex items-center justify-between rounded-xl bg-white p-4 text-gray-900 shadow-sm">
                <p className="text-lg font-semibold">Tổng: {formatPrice(total)}</p>
                <Link
                    href="/checkout"
                    className="rounded-lg bg-amber-600 px-6 py-3 font-medium text-white hover:bg-amber-700"
                >
                    Thanh toán
                </Link>
            </div>
        </div>
    );
}