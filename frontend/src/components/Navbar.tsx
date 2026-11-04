'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CartBadge from '@/features/cart/CartBadge';
import AuthNav from '@/features/auth/AuthNav';

export default function Navbar() {
    const isStaffPage = usePathname() === '/nhanvien';

    if (isStaffPage) {
        return (
            <header className="border-b border-amber-100 bg-white text-gray-900">
                <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6" aria-label="Điều hướng nhân viên">
                    <div className="flex items-center gap-3">
                        <Link href="/nhanvien" className="text-xl font-bold text-amber-700">
                            BrewLite
                        </Link>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                            Nhân viên
                        </span>
                    </div>
                    <Link href="/" className="text-sm font-medium text-amber-800 hover:underline">
                        Trang khách hàng
                    </Link>
                </nav>
            </header>
        );
    }

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
