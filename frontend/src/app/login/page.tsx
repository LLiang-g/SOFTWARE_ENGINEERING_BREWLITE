import { Suspense } from 'react';
import BackLink from '@/components/BackLink';
import AuthForm from '@/features/auth/AuthForm';

export default function LoginPage() {
    return (
        <main className="mx-auto w-full max-w-md px-4 pt-3 pb-10">
            <BackLink href="/" label="Về menu" />
            <div className="mt-2">
                <Suspense>
                    <AuthForm mode="login" />
                </Suspense>
            </div>
        </main>
    );
}
