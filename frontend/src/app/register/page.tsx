import { Suspense } from 'react';
import BackLink from '@/components/BackLink';
import AuthForm from '@/features/auth/AuthForm';

export default function RegisterPage() {
    return (
        <main className="mx-auto w-full max-w-md px-4 pt-3 pb-10">
            <BackLink href="/" label="Về menu" />
            <div className="mt-2">
                <Suspense>
                    <AuthForm mode="register" />
                </Suspense>
            </div>
        </main>
    );
}
