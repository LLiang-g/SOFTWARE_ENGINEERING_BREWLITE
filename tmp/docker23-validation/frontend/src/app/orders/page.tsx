import OrderHistory from '@/features/orders/OrderHistory';

export default function OrdersPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-tabs md:px-6 md:pt-10">
            <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight md:text-4xl">
                Đơn hàng của tôi
            </h1>
            <OrderHistory />
        </main>
    );
}
