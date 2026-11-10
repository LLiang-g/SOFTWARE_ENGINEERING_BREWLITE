import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api';
import ProductDetail from '@/features/catalog/ProductDetail';

export default async function ProductPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
        notFound();
    }

    let product;
    try {
        product = await getProduct(productId);
    } catch {
        return (
            <main className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6">
                <div role="alert" className="rounded-[22px] bg-chili-soft px-5 py-8 text-center text-chili">
                    <p className="font-semibold">Không kết nối được máy chủ</p>
                    <p className="mt-1 text-sm">Hãy kiểm tra backend đã chạy chưa, rồi tải lại trang.</p>
                </div>
            </main>
        );
    }

    if (!product) {
        notFound();
    }

    return (
        <main className="mx-auto w-full max-w-5xl pb-cta md:px-6 md:pt-8">
            <ProductDetail product={product} />
        </main>
    );
}
