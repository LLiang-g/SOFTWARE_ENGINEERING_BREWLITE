'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';
import { ApiError, getOrder } from '@/lib/orders-api';
import { ORDER_STATUS_LABEL, formatPrice } from '@/lib/format';
import { OrderView } from '@/lib/types';

const SUCCESS_STATUSES = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];

export default function OrderConfirmation({ id }: { id: number }) {
    const hydrated = useHydrated();
    const token = useAuthStore((s) => s.token);
    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hydrated || !token) return;
        let cancelled = false;
        getOrder(id)
            .then((o) => {
                if (!cancelled) setOrder(o);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(
                    err instanceof ApiError && err.status === 404
                        ? 'Không tìm thấy đơn hàng.'
                        : 'Không tải được đơn hàng. Hãy kiểm tra backend đã chạy chưa.',
                );
            });
        return () => {
            cancelled = true;
        };
    }, [hydrated, token, id]);

    if (!hydrated) {
        return <p className="py-12 text-center text-gray-500">Đang tải...</p>;
    }

    if (!token) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Bạn cần đăng nhập để xem đơn hàng.</p>
                <Link
                    href={`/login?next=/orders/${id}`}
                    className="mt-3 inline-block text-amber-500 underline"
                >
                    Đăng nhập
                </Link>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-600">{error}</p>
                <Link href="/" className="mt-3 inline-block text-amber-500 underline">
                    Về trang chủ
                </Link>
            </div>
        );
    }

    if (!order) {
        return <p className="py-12 text-center text-gray-500">Đang tải đơn hàng...</p>;
    }

    const success = SUCCESS_STATUSES.includes(order.status);

    return (
        <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center text-gray-900 shadow-sm">
            <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-3xl ${
                    success ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                }`}
            >
                {success ? '✓' : '!'}
            </div>

            <h1 className="mt-3 text-xl font-bold">
                {success ? 'Đặt hàng thành công' : 'Đơn hàng chưa hoàn tất thanh toán'}
            </h1>
            <p className="mt-1 text-lg font-semibold">Mã đơn: #{order.id}</p>
            <p className="text-sm text-gray-600">
                Trạng thái: {order.status} ({ORDER_STATUS_LABEL[order.status]})
            </p>

            <ul className="mt-4 space-y-1 border-t pt-4 text-left text-sm">
                {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
            <span>
              {item.name} ({item.size}
                {item.toppingNames.length > 0 &&
                    `, ${item.toppingNames.join(', ')}`}
                ) × {item.qty}
            </span>
                        <span>{formatPrice(item.lineTotal)}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-3 border-t pt-3 text-right font-semibold">
                Tổng: {formatPrice(order.total)}
            </p>

            {success ? (
                <p className="mt-4 text-sm text-gray-700">Mời tới quầy lấy nước</p>
            ) : (
                <Link
                    href="/checkout"
                    className="mt-4 inline-block text-sm text-amber-700 underline"
                >
                    Thanh toán lại
                </Link>
            )}

            <Link
                href="/"
                className="mt-5 block rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-700"
            >
                Về trang chủ
            </Link>
        </div>
    );
}