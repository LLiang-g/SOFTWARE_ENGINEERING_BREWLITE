'use client';

import { useEffect, useState } from 'react';
import { SAMPLE_ORDERS } from '@/features/staff/sample-orders';
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/lib/format';
import { ApiError } from '@/lib/orders-api';
import type { OrderView } from '@/lib/types';
import { getStaffOrders, updateStaffOrder, type NextStaffStatus } from './staff-api';

const USE_DEMO = process.env.NEXT_PUBLIC_STAFF_API_ENABLED !== 'true';
const LOAD_ERROR = 'Không tải được đơn hàng. Bạn hãy thử tải lại.';

const COLUMNS = [
    { status: 'PAID', title: 'Chờ duyệt', action: 'Duyệt đơn', nextStatus: 'PREPARING' },
    { status: 'PREPARING', title: ORDER_STATUS_LABEL.PREPARING, action: 'Pha xong', nextStatus: 'READY' },
    { status: 'READY', title: ORDER_STATUS_LABEL.READY, action: 'Đã giao khách', nextStatus: 'COMPLETED' },
    { status: 'COMPLETED', title: ORDER_STATUS_LABEL.COMPLETED, action: null, nextStatus: null },
] as const;

export default function StaffBoard() {
    const [orders, setOrders] = useState<OrderView[] | null>(USE_DEMO ? SAMPLE_ORDERS : null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(!USE_DEMO);

    async function loadOrders() {
        try {
            setOrders(await getStaffOrders());
            setLoadError(null);
        } catch {
            setLoadError(LOAD_ERROR);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        if (USE_DEMO) return;
        const controller = new AbortController();
        void getStaffOrders(controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setOrders(data);
            })
            .catch(() => {
                if (!controller.signal.aborted) setLoadError(LOAD_ERROR);
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, []);

    function reloadOrders() {
        setIsLoading(true);
        setActionError(null);
        void loadOrders();
    }

    async function changeStatus(order: OrderView, status: NextStaffStatus) {
        if (isLoading || sendingId !== null || loadError) return;

        setSendingId(order.id);
        setActionError(null);
        try {
            if (USE_DEMO) {
                setOrders((current) => current?.map((item) =>
                    item.id === order.id ? { ...item, status } : item,
                ) ?? null);
            } else {
                await updateStaffOrder(order.id, status);
                await loadOrders();
            }
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setActionError('Đơn đã thay đổi. Hãy kiểm tra trạng thái sau khi tải lại.');
                await loadOrders();
            } else {
                setActionError(error instanceof ApiError
                    ? error.message
                    : 'Không kết nối được máy chủ. Bạn hãy thử lại.');
            }
        } finally {
            setSendingId(null);
        }
    }

    return (
        <main className="flex-1 bg-stone-50 text-gray-900">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <h1 className="text-2xl font-bold sm:text-3xl">Đơn hàng tại quầy</h1>
                {USE_DEMO && (
                    <p className="mt-2 text-sm text-gray-600">
                        Đang dùng đơn mẫu. Thay đổi sẽ mất khi tải lại trang.
                    </p>
                )}
                {isLoading && <p role="status" className="mt-4 text-sm">Đang tải đơn hàng...</p>}
                {loadError && (
                    <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                        <p role="alert">{loadError}</p>
                        <button type="button" onClick={reloadOrders} disabled={isLoading || sendingId !== null}
                            className="mt-2 font-semibold underline disabled:opacity-50">
                            Tải lại
                        </button>
                    </div>
                )}
                {actionError && <p role="alert" className="mt-4 text-sm text-red-800">{actionError}</p>}

                {orders && <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {COLUMNS.map(({ status, title, action, nextStatus }) => {
                        const columnOrders = orders.filter((order) => order.status === status);

                        return (
                            <section key={status} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                                    <h2 className="font-semibold">{title}</h2>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
                                        {columnOrders.length}
                                    </span>
                                </div>

                                {columnOrders.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-amber-200 px-3 py-4 text-sm text-gray-600">
                                        Chưa có đơn trong cột này.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {columnOrders.map((order) => (
                                            <li key={order.id} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                                                <h3 className="font-semibold">Đơn #{order.id}</h3>
                                                <time dateTime={order.createdAt} className="mt-1 block text-xs text-gray-600">
                                                    {formatDateTime(order.createdAt)}
                                                </time>

                                                <ul className="my-3 space-y-2 border-y border-gray-100 py-3 text-sm">
                                                    {order.items.map((item) => (
                                                        <li key={item.id}>
                                                            <p className="font-medium">{item.name} × {item.qty}</p>
                                                            <p className="text-gray-600">
                                                                Size {item.size} · {item.toppingNames.join(', ') || 'Không topping'}
                                                            </p>
                                                        </li>
                                                    ))}
                                                </ul>

                                                <p className="flex justify-between gap-2 text-sm font-semibold">
                                                    <span>Tổng tiền</span>
                                                    <span>{formatPrice(order.total)}</span>
                                                </p>

                                                {nextStatus && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void changeStatus(order, nextStatus)}
                                                        disabled={isLoading || sendingId !== null || Boolean(loadError)}
                                                        className="mt-3 w-full rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {sendingId === order.id ? 'Đang cập nhật...' : action}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>}
            </div>
        </main>
    );
}
