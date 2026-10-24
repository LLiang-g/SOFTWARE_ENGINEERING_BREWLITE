// not-found.tsx
import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="mx-auto max-w-3xl p-6 text-center">
            <p className="py-12 text-gray-600">Không tìm thấy sản phẩm.</p>
            <Link href="/" className="text-amber-700 underline">
                Về menu
            </Link>
        </main>
    );
}