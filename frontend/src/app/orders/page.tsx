import OrderHistory from '@/features/orders/OrderHistory';

export default function OrdersPage() {
    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Đơn hàng của tôi</h1>
            <OrderHistory />
        </main>
    );
}