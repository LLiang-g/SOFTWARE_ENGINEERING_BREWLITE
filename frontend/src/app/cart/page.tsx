import CartView from '@/features/cart/CartView';

export default function CartPage() {
    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Giỏ hàng</h1>
            <CartView />
        </main>
    );
}