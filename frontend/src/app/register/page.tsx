import { Suspense } from 'react';
import AuthForm from '@/features/auth/AuthForm';

export default function RegisterPage() {
    return (
        <main className="p-6">
            <Suspense>
                <AuthForm mode="register" />
            </Suspense>
        </main>
    );
}