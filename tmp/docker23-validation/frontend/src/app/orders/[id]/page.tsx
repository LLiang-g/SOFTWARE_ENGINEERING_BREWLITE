import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import BackLink from '@/components/BackLink';
import OrderConfirmation from '@/features/orders/OrderConfirmation';

// Đọc params (dữ liệu URL) phải nằm trong Suspense khi bật cacheComponents.
async function OrderContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
        notFound();
    }
    return <OrderConfirmation id={orderId} />;
}

export default function OrderPage({
                                      params,
                                  }: {
    params: Promise<{ id: string }>;
}) {
    return (
        <main className="mx-auto w-full max-w-md px-4 pt-3 pb-tabs">
            <BackLink href="/orders" label="Đơn hàng của tôi" />
            <Suspense
                fallback={<div className="mt-3 h-96 rounded-[24px] bg-line motion-safe:animate-pulse" aria-busy="true" />}
            >
                <OrderContent params={params} />
            </Suspense>
        </main>
    );
}
