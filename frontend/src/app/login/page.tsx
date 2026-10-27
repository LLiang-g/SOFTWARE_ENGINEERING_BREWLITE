import { Suspense } from 'react';
import AuthForm from '@/features/auth/AuthForm';

export default function LoginPage() {
    return (
        <main className="p-6">
            <Suspense>
                <AuthForm mode="login" />
            </Suspense>
        </main>
    );
}