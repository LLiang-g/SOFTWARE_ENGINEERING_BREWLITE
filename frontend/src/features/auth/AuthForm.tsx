'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconCup, IconEye, IconEyeOff } from '@/components/icons';
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
    const [showPassword, setShowPassword] = useState(false);
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
        'mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-4 text-base outline-none placeholder:text-muted/70 focus:border-espresso focus:ring-2 focus:ring-espresso/15';

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full rounded-[24px] border border-line bg-paper p-5 sm:p-7"
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-espresso text-crema">
                <IconCup className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
                {isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </h1>
            <p className="mt-1 text-sm text-muted">
                {isLogin
                    ? 'Đăng nhập để đặt hàng và tích điểm.'
                    : 'Tạo tài khoản để đặt hàng và tích điểm sau mỗi đơn.'}
            </p>

            <div className="mt-6 space-y-4">
                <label className="block text-sm font-medium">
                    Email
                    <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                    />
                </label>

                <div>
                    <label className="block text-sm font-medium">
                        Mật khẩu
                        <span className="relative block">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={isLogin ? undefined : 6}
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${inputClass} pr-12`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                className="absolute top-1.5 right-1 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-espresso"
                            >
                                {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                            </button>
                        </span>
                    </label>
                    {!isLogin && <p className="mt-1.5 text-xs text-muted">Ít nhất 6 ký tự.</p>}
                </div>

                {!isLogin && (
                    <label className="block text-sm font-medium">
                        Nhập lại mật khẩu
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className={inputClass}
                        />
                    </label>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-4 rounded-xl bg-chili-soft px-3 py-2.5 text-sm text-chili">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={loading}
                className="mt-6 h-12 w-full rounded-full bg-espresso font-semibold text-white transition hover:bg-roast disabled:opacity-60"
            >
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </button>

            <p className="mt-5 text-center text-sm text-muted">
                {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
                <Link href={otherHref} className="font-semibold text-espresso underline underline-offset-2">
                    {isLogin ? 'Đăng ký' : 'Đăng nhập'}
                </Link>
            </p>
        </form>
    );
}
