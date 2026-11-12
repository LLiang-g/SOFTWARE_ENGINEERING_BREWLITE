'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';

// Cổng vào quầy: chưa đăng nhập thì chuyển sang trang đăng nhập, không phải barista thì báo không có quyền.
export default function StaffGate({ children }: { children: ReactNode }) {
    const router = useRouter();
    const hydrated = useHydrated();
    const token = useAuthStore((s) => s.token);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    useEffect(() => {
        if (hydrated && !token) router.replace('/login?next=/barista');
    }, [hydrated, token, router]);

    if (!hydrated || !token) {
        return (
            <main className="flex-1 bg-stone-50 text-gray-900">
                <p className="px-4 py-10 text-center text-sm text-gray-600">Đang kiểm tra đăng nhập...</p>
            </main>
        );
    }

    if (user?.role !== 'BARISTA') {
        return (
            <main className="flex-1 bg-stone-50 text-gray-900">
                <div className="mx-auto max-w-md px-4 py-12 text-center">
                    <h1 className="text-xl font-bold">Tài khoản này không có quyền vào quầy</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Hãy đăng nhập bằng tài khoản barista để xem và cập nhật đơn.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                logout();
                                router.replace('/login?next=/barista');
                            }}
                            className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
                        >
                            Đăng nhập tài khoản khác
                        </button>
                        <Link
                            href="/"
                            className="rounded-lg px-4 py-2 text-sm font-medium text-amber-800 hover:underline"
                        >
                            Về trang khách hàng
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return <>{children}</>;
}
