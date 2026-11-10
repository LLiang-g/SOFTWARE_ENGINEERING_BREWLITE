import BackLink from '@/components/BackLink';
import CartView from '@/features/cart/CartView';

export default function CartPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 pt-3 pb-cta md:px-6 md:pt-6">
            <BackLink href="/" label="Về menu" />
            <h1 className="mt-1 mb-5 font-display text-[1.75rem] leading-tight font-bold tracking-tight md:text-4xl">
                Giỏ hàng
            </h1>
            <CartView />
        </main>
    );
}
