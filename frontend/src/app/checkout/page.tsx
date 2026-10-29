import CheckoutView from '@/features/payments/CheckoutView';

export default function CheckoutPage() {
    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Thanh toán</h1>
            <CheckoutView />
        </main>
    );
}