import Link from 'next/link';
import DrinkArt from '@/features/catalog/DrinkArt';

export default function NotFound() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <DrinkArt kind="cup" className="h-32 w-auto" />
            <h1 className="mt-4 font-display text-2xl font-bold">Không tìm thấy trang này</h1>
            <p className="mt-1 text-muted">Đường dẫn có thể đã đổi hoặc bị gõ sai.</p>
            <Link
                href="/"
                className="mt-6 inline-flex h-12 items-center rounded-full bg-espresso px-6 font-semibold text-white hover:bg-roast"
            >
                Về menu
            </Link>
        </main>
    );
}
