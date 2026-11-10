'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthNav from '@/features/auth/AuthNav';
import CartBadge from '@/features/cart/CartBadge';
import { selectCount, useCartStore } from '@/features/cart/cart.store';
import { useHydrated } from '@/features/cart/useHydrated';
import { IconCart, IconCup, IconReceipt } from './icons';

// Các trang có thanh hành động riêng ở đáy (thêm vào giỏ, đặt hàng, form đăng nhập)
// thì ẩn thanh tab để hai thanh không chồng lên nhau.
const HIDE_TABS = [/^\/products(\/|$)/, /^\/cart(\/|$)/, /^\/login(\/|$)/, /^\/register(\/|$)/];

export default function Navbar() {
    const pathname = usePathname();
    const hydrated = useHydrated();
    const cartCount = useCartStore(selectCount);

    if (pathname === '/barista') {
        return (
            <header className="border-b border-amber-100 bg-white text-gray-900">
                <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6" aria-label="Điều hướng nhân viên">
                    <div className="flex items-center gap-3">
                        <Link href="/barista" className="text-xl font-bold text-amber-700">
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

    const showTabs = !HIDE_TABS.some((pattern) => pattern.test(pathname));
    const tabs = [
        { href: '/', label: 'Menu', Icon: IconCup, active: pathname === '/' || pathname.startsWith('/products') },
        { href: '/cart', label: 'Giỏ hàng', Icon: IconCart, active: pathname.startsWith('/cart'), badge: hydrated ? cartCount : 0 },
        { href: '/orders', label: 'Đơn hàng', Icon: IconReceipt, active: pathname.startsWith('/orders') },
    ];

    return (
        <>
            <header className="sticky top-0 z-30 border-b border-line bg-foam/90 pt-[env(safe-area-inset-top)] backdrop-blur">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:px-6">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
                            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-espresso text-crema">
                                <IconCup className="h-5 w-5" />
                            </span>
                            BrewLite
                        </Link>
                        <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
                            <Link href="/" className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-espresso">
                                Menu
                            </Link>
                            <Link href="/orders" className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-espresso">
                                Đơn hàng
                            </Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-2">
                        <AuthNav />
                        <div className="hidden md:block">
                            <CartBadge />
                        </div>
                    </div>
                </div>
            </header>

            {showTabs && (
                <nav
                    aria-label="Điều hướng nhanh"
                    className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
                >
                    <ul className="mx-auto grid max-w-md grid-cols-3">
                        {tabs.map(({ href, label, Icon, active, badge }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                                        active ? 'text-espresso' : 'text-muted'
                                    }`}
                                >
                                    <span className="relative">
                                        <Icon className="h-6 w-6" />
                                        {badge ? (
                                            <span className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-crema px-1 text-[11px] font-bold text-espresso">
                                                {badge}
                                            </span>
                                        ) : null}
                                    </span>
                                    {label}
                                    {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-espresso" />}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </>
    );
}
