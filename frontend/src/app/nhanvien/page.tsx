import type { Metadata } from 'next';
import { SAMPLE_ORDERS } from '@/features/staff/sample-orders';
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/lib/format';

export const metadata: Metadata = { title: 'Nhân viên | BrewLite' };

const COLUMNS = [
    { status: 'PAID', title: 'Chờ duyệt', action: 'Duyệt đơn' },
    { status: 'PREPARING', title: ORDER_STATUS_LABEL.PREPARING, action: 'Pha xong' },
    { status: 'READY', title: ORDER_STATUS_LABEL.READY, action: 'Đã giao khách' },
    { status: 'COMPLETED', title: ORDER_STATUS_LABEL.COMPLETED, action: null },
];

export default function StaffPage() {
    return (
        <main className="flex-1 bg-stone-50 text-gray-900">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <h1 className="text-2xl font-bold sm:text-3xl">Đơn hàng tại quầy</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Dữ liệu mẫu để xem giao diện. Các nút sẽ hoạt động khi kết nối API.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {COLUMNS.map(({ status, title, action }) => {
                        const orders = SAMPLE_ORDERS.filter((order) => order.status === status);

                        return (
                            <section key={status} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                                    <h2 className="font-semibold">{title}</h2>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
                                        {orders.length}
                                    </span>
                                </div>

                                {orders.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-amber-200 px-3 py-4 text-sm text-gray-600">
                                        Chưa có đơn trong cột này.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {orders.map((order) => (
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

                                                {action && (
                                                    <button type="button" disabled className="mt-3 w-full rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 disabled:cursor-not-allowed">
                                                        {action}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
