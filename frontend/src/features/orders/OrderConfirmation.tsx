'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';
import PaymentPanel from '@/features/payments/PaymentPanel';
import { ApiError, cancelOrder, getMe, getOrder } from '@/lib/orders-api';
import { ORDER_STATUS_LABEL, formatPrice } from '@/lib/format';
import { OrderStatus, OrderView } from '@/lib/types';

const HEADINGS: Record<OrderStatus, string> = {
    PENDING: 'Đơn hàng đã được tạo',
    PAID: 'Đặt hàng thành công',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    PREPARING: 'Đơn hàng đang được pha chế',
    READY: 'Đồ uống đã sẵn sàng',
    COMPLETED: 'Đơn hàng đã hoàn tất',
    CANCELLED: 'Đơn hàng đã hủy',
};

const SUCCESS_STATUSES: OrderStatus[] = [
    'PAID',
    'PREPARING',
    'READY',
    'COMPLETED',
];
const PAYABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];
const CANCELLABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];

export default function OrderConfirmation({ id }: { id: number }) {
    const hydrated = useHydrated();
    const token = useAuthStore((s) => s.token);
    const updateUser = useAuthStore((s) => s.updateUser);
    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setOrder(await getOrder(id));
        try {
            updateUser(await getMe());
        } catch {
            // Không lấy được số điểm mới thì bỏ qua, đơn hàng vẫn hiển thị bình thường.
        }
    }, [id, updateUser]);

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
        return (
            <p className="py-12 text-center text-gray-500">Đang tải đơn hàng...</p>
        );
    }

    async function handleCancel() {
        if (!order || !window.confirm('Bạn chắc chắn muốn hủy đơn này?')) return;
        setCancelling(true);
        setCancelError(null);
        try {
            setOrder(await cancelOrder(order.id));
        } catch (err) {
            setCancelError(
                err instanceof ApiError
                    ? err.message
                    : 'Không hủy được đơn. Hãy kiểm tra backend đã chạy chưa.',
            );
        } finally {
            setCancelling(false);
        }
    }

    const success = SUCCESS_STATUSES.includes(order.status);
    const cancelled = order.status === 'CANCELLED';
    const payable = PAYABLE_STATUSES.includes(order.status);
    const canCancel = CANCELLABLE_STATUSES.includes(order.status);

    const iconStyle = success
        ? 'bg-green-100 text-green-600'
        : cancelled
            ? 'bg-gray-200 text-gray-600'
            : 'bg-amber-100 text-amber-600';
    const icon = success ? '✓' : cancelled ? '✕' : '!';

    return (
        <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center text-gray-900 shadow-sm">
            <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-3xl ${iconStyle}`}
            >
                {icon}
            </div>

            <h1 className="mt-3 text-xl font-bold">{HEADINGS[order.status]}</h1>
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

            <div className="mt-3 space-y-1 border-t pt-3 text-right text-sm">
                {order.discount > 0 && (
                    <>
                        <p className="text-gray-600">
                            Tạm tính: {formatPrice(order.total + order.discount)}
                        </p>
                        <p className="text-green-700">
                            Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}: -
                            {formatPrice(order.discount)}
                        </p>
                    </>
                )}
                <p className="text-base font-semibold">
                    Tổng: {formatPrice(order.total)}
                </p>
            </div>

            {success && (
                <p className="mt-4 text-sm text-gray-700">Mời tới quầy lấy nước</p>
            )}

            {success && order.pointsEarned > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                    Bạn được cộng {order.pointsEarned} điểm tích lũy
                </p>
            )}

            {payable && (
                <PaymentPanel
                    orderId={order.id}
                    total={order.total}
                    onResult={reload}
                />
            )}

            {canCancel && (
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="mt-4 block w-full rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                    {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                </button>
            )}
            {cancelError && (
                <p className="mt-2 text-sm text-red-600">{cancelError}</p>
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