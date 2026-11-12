'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';
import DrinkArt from '@/features/catalog/DrinkArt';
import { ApiError, getMyOrders } from '@/lib/orders-api';
import { formatDateTime, formatPrice } from '@/lib/format';
import { OrderView } from '@/lib/types';
import OrdersLiveStatus from './OrdersLiveStatus';
import StatusChip from './StatusChip';
import { useOrdersLive } from './useOrdersLive';

const GROUPS = [
    { title: 'Cần thanh toán', statuses: ['PENDING', 'PAYMENT_FAILED'] },
    { title: 'Đang xử lý', statuses: ['PAID', 'PREPARING', 'READY'] },
    { title: 'Lịch sử', statuses: ['COMPLETED', 'CANCELLED'] },
] as const;

function OrderCard({ order }: { order: OrderView }) {
    const ready = order.status === 'READY';
    const exchanged = order.creditApplied > 0;
    const payable = order.status === 'PENDING' || order.status === 'PAYMENT_FAILED';
    const paid = ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(order.status);
    return (
        <Link
            href={`/orders/${order.id}`}
            className={`block rounded-[22px] border p-4 transition hover:border-espresso ${
                ready ? 'border-pandan bg-pandan-soft' : 'border-line bg-paper'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-display text-2xl leading-none font-bold tabular-nums">#{order.id}</p>
                    <p className="mt-1.5 text-xs text-muted">{formatDateTime(order.createdAt)}</p>
                </div>
                <StatusChip status={order.status} />
            </div>
            <p className="mt-3 line-clamp-2 text-[15px]">
                {order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
            </p>
            {exchanged ? (
                <div className="mt-3 space-y-1 text-right">
                    <p className="text-xs text-muted">
                        Tổng món {formatPrice(order.total)} · Đã chuyển {formatPrice(order.creditApplied)}
                    </p>
                    <p className="text-sm text-muted">
                        {payable ? 'Cần thanh toán thêm' : paid ? 'Chênh lệch đã thanh toán' : 'Chênh lệch của lần đổi'}
                    </p>
                    <p className="font-semibold tabular-nums">{formatPrice(order.amountDue)}</p>
                </div>
            ) : (
                <p className="mt-3 text-right font-semibold tabular-nums">{formatPrice(order.total)}</p>
            )}
        </Link>
    );
}

export default function OrderHistory() {
    const router = useRouter();
    const hydrated = useHydrated();
    const token = useAuthStore((s) => s.token);
    const [orders, setOrders] = useState<OrderView[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadOrders = useCallback(async (signal: AbortSignal) => {
        try {
            const data = await getMyOrders(signal);
            if (signal.aborted || useAuthStore.getState().token !== token) return;
            setOrders(data);
            setError(null);
        } catch (err) {
            if (signal.aborted || useAuthStore.getState().token !== token) return;
            if (err instanceof ApiError && err.status === 401) {
                useAuthStore.getState().logout();
                router.push('/login?next=/orders');
                return;
            }
            setError('Không tải được lịch sử đơn hàng. Hãy thử tải lại.');
        }
    }, [router, token]);
    const { connected, isLoading, refresh } = useOrdersLive(hydrated && Boolean(token), loadOrders);

    if (!hydrated) {
        return (
            <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-32 rounded-[22px] bg-line motion-safe:animate-pulse" />
                ))}
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex flex-col items-center py-14 text-center">
                <DrinkArt kind="cup" className="h-28 w-auto" />
                <h2 className="mt-4 font-display text-xl font-bold">Đăng nhập để xem đơn hàng</h2>
                <p className="mt-1 text-muted">Đơn của bạn sẽ hiện ở đây và tự cập nhật khi quầy pha xong.</p>
                <Link
                    href="/login?next=/orders"
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-espresso px-6 font-semibold text-white hover:bg-roast"
                >
                    Đăng nhập
                </Link>
            </div>
        );
    }

    const liveStatus = <OrdersLiveStatus connected={connected} busy={isLoading} refresh={refresh} showRefresh={!connected || Boolean(error)} />;

    if (!orders) {
        return (
            <>
                {liveStatus}
                {error ? (
                    <p role="alert" className="rounded-2xl bg-chili-soft px-4 py-3 text-sm text-chili">{error}</p>
                ) : (
                    <div className="space-y-3" aria-busy="true">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-32 rounded-[22px] bg-line motion-safe:animate-pulse" />
                        ))}
                    </div>
                )}
            </>
        );
    }

    if (orders.length === 0) {
        return (
            <>
                {liveStatus}
                {error && <p role="alert" className="rounded-2xl bg-chili-soft px-4 py-3 text-sm text-chili">{error}</p>}
                <div className="flex flex-col items-center py-12 text-center">
                    <DrinkArt kind="cup" className="h-28 w-auto" />
                    <h2 className="mt-4 font-display text-xl font-bold">Bạn chưa có đơn hàng nào</h2>
                    <p className="mt-1 text-muted">Chọn món từ menu và đơn đầu tiên sẽ hiện ở đây.</p>
                    <Link
                        href="/"
                        className="mt-6 inline-flex h-12 items-center rounded-full bg-espresso px-6 font-semibold text-white hover:bg-roast"
                    >
                        Chọn món
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            {liveStatus}
            {error && <p role="alert" className="mb-3 rounded-2xl bg-chili-soft px-4 py-3 text-sm text-chili">{error}</p>}
            <div className="space-y-7">
                {GROUPS.map(({ title, statuses }) => {
                    const group = orders.filter((o) => (statuses as readonly string[]).includes(o.status));
                    if (group.length === 0) return null;
                    return (
                        <section key={title} aria-labelledby={`group-${title}`}>
                            <h2 id={`group-${title}`} className="mb-3 font-display text-lg font-bold">
                                {title}
                            </h2>
                            <ul className="space-y-3">
                                {group.map((order) => (
                                    <li key={order.id}>
                                        <OrderCard order={order} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </>
    );
}
