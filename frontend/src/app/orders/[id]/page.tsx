import { notFound } from 'next/navigation';
import OrderConfirmation from '@/features/orders/OrderConfirmation';

export default async function OrderPage({
                                            params,
                                        }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
        notFound();
    }

    return (
        <main className="p-6">
            <OrderConfirmation id={orderId} />
        </main>
    );
}