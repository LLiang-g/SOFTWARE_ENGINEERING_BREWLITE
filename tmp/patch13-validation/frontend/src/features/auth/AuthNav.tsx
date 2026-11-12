'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconLogout, IconStar } from '@/components/icons';
import { useAuthStore } from './auth.store';
import { useHydrated } from '@/features/cart/useHydrated';

export default function AuthNav() {
    const hydrated = useHydrated();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const router = useRouter();

    // Giữ chỗ để thanh trên không nhảy khi trang vừa tải xong.
    if (!hydrated) return <span className="block h-10 w-24" />;

    if (!user) {
        return (
            <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full bg-espresso px-5 text-sm font-semibold text-white hover:bg-roast"
            >
                Đăng nhập
            </Link>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted lg:inline">{user.email}</span>
            {user.role === 'BARISTA' ? (
                <Link
                    href="/barista"
                    className="inline-flex h-10 items-center rounded-full bg-crema-soft px-4 text-sm font-semibold hover:bg-crema/40"
                >
                    Quầy barista
                </Link>
            ) : (
                <span
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-crema-soft px-3.5 text-sm font-semibold tabular-nums"
                    aria-label={`${user.loyaltyPoints} điểm tích lũy`}
                >
                    <IconStar className="h-4 w-4 text-crema" />
                    {user.loyaltyPoints}
                </span>
            )}
            <button
                type="button"
                onClick={() => {
                    logout();
                    router.push('/');
                }}
                aria-label="Đăng xuất"
                title="Đăng xuất"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-muted hover:text-chili"
            >
                <IconLogout className="h-5 w-5" />
            </button>
        </div>
    );
}
