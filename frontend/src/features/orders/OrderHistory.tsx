'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';
import { ApiError, getMyOrders } from '@/lib/orders-api';
import {
    ORDER_STATUS_LABEL,
    formatDateTime,
    formatPrice,
} from '@/lib/format';
import { OrderStatus, OrderView } from '@/lib/types';
import OrdersLiveStatus from './OrdersLiveStatus';
import { useOrdersLive } from './useOrdersLive';

const STATUS_STYLE: Record<OrderStatus, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    PAID: 'bg-green-100 text-green-700',
    PAYMENT_FAILED: 'bg-red-100 text-red-700',
    PREPARING: 'bg-blue-100 text-blue-700',
    READY: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-200 text-gray-600',
};

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
        return <p className="py-12 text-center text-gray-500">Đang tải...</p>;
    }

    if (!token) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Bạn cần đăng nhập để xem lịch sử đơn hàng.</p>
                <Link
                    href="/login?next=/orders"
                    className="mt-3 inline-block rounded-lg bg-amber-600 px-5 py-2.5 font-medium text-white hover:bg-amber-700"
                >
                    Đăng nhập
                </Link>
            </div>
        );
    }

    const liveStatus = <OrdersLiveStatus connected={connected} busy={isLoading} refresh={refresh} />;

    if (!orders) {
        return (
            <>
                {liveStatus}
                {error && <p role="alert" className="text-center text-red-600">{error}</p>}
            </>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="py-12 text-center">
                {liveStatus}
                {error && <p role="alert" className="text-red-600">{error}</p>}
                <p className="text-gray-500">Bạn chưa có đơn hàng nào.</p>
                <Link href="/" className="mt-3 inline-block text-amber-500 underline">
                    Về menu để chọn món
                </Link>
            </div>
        );
    }

    return (
        <>
        {liveStatus}
        {error && <p role="alert" className="mb-3 text-red-600">{error}</p>}
        <ul className="space-y-3">
            {orders.map((order) => (
                <li key={order.id}>
                    <Link
                        href={`/orders/${order.id}`}
                        className="block rounded-xl bg-white p-4 text-gray-900 shadow-sm transition hover:shadow-md"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">Đơn #{order.id}</p>
                            <span
                                className={`rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status]}`}
                            >
                {ORDER_STATUS_LABEL[order.status]}
              </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            {formatDateTime(order.createdAt)}
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                            {order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                        </p>
                        <p className="mt-2 text-right font-semibold">
                            {formatPrice(order.total)}
                        </p>
                    </Link>
                </li>
            ))}
        </ul>
        </>
    );
}
