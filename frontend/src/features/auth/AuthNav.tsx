'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './auth.store';
import { useHydrated } from '@/features/cart/useHydrated';

export default function AuthNav() {
    const hydrated = useHydrated();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const router = useRouter();

    if (!hydrated) return null;

    if (!user) {
        return (
            <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm text-gray-800 hover:underline"
            >
                Đăng nhập
            </Link>
        );
    }

    return (
        <div className="flex items-center gap-3 text-sm text-gray-800">
            <span className="hidden sm:inline">{user.email}</span>
            <button
                type="button"
                onClick={() => {
                    logout();
                    router.push('/');
                }}
                className="text-red-600 hover:underline"
            >
                Đăng xuất
            </button>
            <Link href="/orders" className="hover:underline">
                Đơn hàng
            </Link>
        </div>
    );
}