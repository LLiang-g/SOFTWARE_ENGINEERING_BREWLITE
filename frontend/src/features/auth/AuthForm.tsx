'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, register } from '@/lib/api';
import { useAuthStore } from './auth.store';

function safeNext(next: string | null): string {
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawNext = searchParams.get('next');
    const next = safeNext(rawNext);
    const setAuth = useAuthStore((s) => s.setAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const isLogin = mode === 'login';
    const otherHref = `${isLogin ? '/register' : '/login'}${
        rawNext ? `?next=${encodeURIComponent(rawNext)}` : ''
    }`;

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);

        if (!isLogin && password !== confirm) {
            setError('Mật khẩu nhập lại không khớp');
            return;
        }

        setLoading(true);
        try {
            const data = isLogin
                ? await login(email, password)
                : await register(email, password);
            setAuth(data.accessToken, data.user);
            router.push(next);
        } catch (err) {
            setError(
                err instanceof TypeError
                    ? 'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.'
                    : (err as Error).message,
            );
        } finally {
            setLoading(false);
        }
    }

    const inputClass =
        'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900';

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-sm space-y-4 rounded-xl bg-white p-6 text-gray-900 shadow-sm"
        >
            <h1 className="text-xl font-bold">
                {isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </h1>

            <label className="block text-sm">
                Email
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                />
            </label>

            <label className="block text-sm">
                Mật khẩu
                <input
                    type="password"
                    required
                    minLength={isLogin ? undefined : 6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                />
            </label>

            {!isLogin && (
                <label className="block text-sm">
                    Nhập lại mật khẩu
                    <input
                        type="password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={inputClass}
                    />
                </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </button>

            <p className="text-center text-sm text-gray-600">
                {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
                <Link href={otherHref} className="text-amber-700 underline">
                    {isLogin ? 'Đăng ký' : 'Đăng nhập'}
                </Link>
            </p>
        </form>
    );
}