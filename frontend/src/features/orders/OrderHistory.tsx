'use client';

import { useEffect, useState } from 'react';
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

    useEffect(() => {
        if (!hydrated || !token) return;
        let cancelled = false;
        getMyOrders()
            .then((data) => {
                if (!cancelled) setOrders(data);
            })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof ApiError && err.status === 401) {
                    useAuthStore.getState().logout();
                    router.push('/login?next=/orders');
                    return;
                }
                setError(
                    'Không tải được lịch sử đơn hàng. Hãy kiểm tra backend đã chạy chưa.',
                );
            });
        return () => {
            cancelled = true;
        };
    }, [hydrated, token, router]);

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

    if (error) {
        return <p className="py-12 text-center text-red-600">{error}</p>;
    }

    if (!orders) {
        return <p className="py-12 text-center text-gray-500">Đang tải đơn hàng...</p>;
    }

    if (orders.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Bạn chưa có đơn hàng nào.</p>
                <Link href="/" className="mt-3 inline-block text-amber-500 underline">
                    Về menu để chọn món
                </Link>
            </div>
        );
    }

    return (
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
    );
}