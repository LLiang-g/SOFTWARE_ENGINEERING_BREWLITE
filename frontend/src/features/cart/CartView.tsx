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
import { IconMinus, IconPlus, IconTag, IconTrash } from '@/components/icons';
import DrinkArt, { DRINK_TINT, drinkKindFor } from '@/features/catalog/DrinkArt';

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
            <div className="space-y-3" aria-busy="true">
                {[0, 1].map((i) => (
                    <div key={i} className="h-28 rounded-[22px] bg-line motion-safe:animate-pulse" />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center py-14 text-center">
                <DrinkArt kind="cup" className="h-32 w-auto" />
                <h2 className="mt-4 font-display text-xl font-bold">Giỏ hàng đang trống</h2>
                <p className="mt-1 text-muted">Chọn một ly để bắt đầu đơn của bạn.</p>
                <Link
                    href="/"
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-espresso px-6 font-semibold text-white hover:bg-roast"
                >
                    Chọn món
                </Link>
            </div>
        );
    }

    return (
        <div>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.key} className="rounded-[22px] border border-line bg-paper p-3.5">
                        <div className="flex gap-3">
                            <div
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
                                style={{ backgroundColor: DRINK_TINT[drinkKindFor(item.name)] }}
                            >
                                <DrinkArt kind={drinkKindFor(item.name)} className="h-12 w-auto" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="leading-snug font-semibold">{item.name}</p>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.key)}
                                        aria-label={`Xóa ${item.name} khỏi giỏ`}
                                        className="-mt-1.5 -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-chili-soft hover:text-chili"
                                    >
                                        <IconTrash className="h-5 w-5" />
                                    </button>
                                </div>
                                <p className="text-sm text-muted">Size {item.size}</p>
                                {item.toppingNames.length > 0 && (
                                    <p className="text-sm text-muted">{item.toppingNames.join(', ')}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                            <div className="flex h-11 items-center rounded-full border-2 border-line">
                                <button
                                    type="button"
                                    onClick={() => setQty(item.key, item.qty - 1)}
                                    className="flex h-full w-11 items-center justify-center rounded-full"
                                    aria-label="Giảm số lượng"
                                >
                                    <IconMinus className="h-5 w-5" />
                                </button>
                                <span className="min-w-7 text-center font-semibold tabular-nums">{item.qty}</span>
                                <button
                                    type="button"
                                    onClick={() => setQty(item.key, item.qty + 1)}
                                    className="flex h-full w-11 items-center justify-center rounded-full"
                                    aria-label="Tăng số lượng"
                                >
                                    <IconPlus className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold tabular-nums">{formatPrice(item.unitPrice * item.qty)}</p>
                                {item.qty > 1 && (
                                    <p className="text-xs text-muted tabular-nums">{formatPrice(item.unitPrice)} / ly</p>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <section className="mt-4 rounded-[22px] border border-line bg-paper p-4" aria-labelledby="voucher-title">
                <h2 id="voucher-title" className="flex items-center gap-2 font-semibold">
                    <IconTag className="h-5 w-5 text-muted" />
                    Mã giảm giá
                </h2>
                {voucher ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-pandan-soft px-4 py-3 text-sm font-medium text-pandan">
                        <span>
                            Mã {voucher.code}: giảm {voucher.discountPercent}%
                        </span>
                        <button
                            type="button"
                            onClick={() => setVoucher(null)}
                            className="min-h-9 font-semibold underline underline-offset-2"
                        >
                            Bỏ mã
                        </button>
                    </div>
                ) : (
                    <div className="mt-3">
                        <div className="flex gap-2">
                            <input
                                value={voucherInput}
                                onChange={(e) => setVoucherInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApplyVoucher();
                                }}
                                placeholder="Nhập mã giảm giá"
                                aria-label="Mã giảm giá"
                                autoCapitalize="characters"
                                autoComplete="off"
                                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 text-base outline-none placeholder:text-muted/70 focus:border-espresso focus:ring-2 focus:ring-espresso/15"
                            />
                            <button
                                type="button"
                                onClick={handleApplyVoucher}
                                disabled={applying || !voucherInput.trim()}
                                className="h-12 shrink-0 rounded-xl border-2 border-espresso px-4 text-sm font-semibold hover:bg-espresso hover:text-white disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
                            >
                                {applying ? 'Đang kiểm tra...' : 'Áp dụng'}
                            </button>
                        </div>
                        {voucherError && (
                            <p role="alert" className="mt-2 text-sm text-chili">{voucherError}</p>
                        )}
                    </div>
                )}
            </section>

            <section className="mt-4 rounded-[22px] border border-line bg-paper p-4" aria-label="Tổng thanh toán">
                <div className="space-y-2 text-[15px]">
                    <div className="flex justify-between">
                        <span className="text-muted">Tạm tính</span>
                        <span className="tabular-nums">{formatPrice(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-pandan">
                            <span>Giảm giá</span>
                            <span className="tabular-nums">-{formatPrice(discount)}</span>
                        </div>
                    )}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                    <span className="font-semibold">Tổng</span>
                    <span className="font-display text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
                </div>
                {error && <p role="alert" className="mt-3 rounded-xl bg-chili-soft px-3 py-2 text-sm text-chili">{error}</p>}
            </section>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_24px_-14px_rgba(43,26,18,0.3)] md:static md:z-auto md:mt-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
                <div className="mx-auto max-w-3xl">
                    <button
                        type="button"
                        onClick={handlePlaceOrder}
                        disabled={placing}
                        className="flex h-14 w-full items-center justify-between rounded-full bg-espresso px-6 text-base font-semibold text-white transition hover:bg-roast active:scale-[0.99] disabled:opacity-60"
                    >
                        <span>{placing ? 'Đang đặt...' : token ? 'Đặt hàng' : 'Đăng nhập để đặt hàng'}</span>
                        <span className="tabular-nums">{formatPrice(total)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
