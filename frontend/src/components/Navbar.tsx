import Link from 'next/link';
import CartBadge from '@/features/cart/CartBadge';
import AuthNav from '@/features/auth/AuthNav';

export default function Navbar() {
    return (
        <header className="border-b bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
                <Link href="/" className="text-xl font-bold text-amber-700">
                    BrewLite
                </Link>
                <div className="flex items-center gap-3">
                    <AuthNav />
                    <CartBadge />
                </div>
            </div>
        </header>
    );
}