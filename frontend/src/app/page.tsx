import Link from 'next/link';
import { getProducts } from '@/lib/api';
import ProductGrid from '@/features/catalog/ProductGrid';

export default async function MenuPage() {
    let products;
    try {
        products = await getProducts();
    } catch {
        return (
            <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-tabs md:px-6">
                <div role="alert" className="rounded-[22px] bg-chili-soft px-5 py-8 text-center text-chili">
                    <p className="font-semibold">Không kết nối được máy chủ</p>
                    <p className="mt-1 text-sm">Hãy kiểm tra backend đã chạy chưa, rồi tải lại trang.</p>
                    <Link
                        href="/"
                        className="mt-4 inline-flex h-11 items-center rounded-full bg-chili px-5 text-sm font-semibold text-white"
                    >
                        Tải lại
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-tabs md:px-6 md:pt-10">
            <h1 className="font-display text-[1.9rem] leading-tight font-bold tracking-tight md:text-5xl">
                Hôm nay uống gì?
            </h1>
            <p className="mt-2 max-w-md text-balance text-muted">
                Đặt trước, trả không tiền mặt, ghé quầy lấy nước.
            </p>
            <div className="mt-7">
                <ProductGrid products={products} />
            </div>
        </main>
    );
}
