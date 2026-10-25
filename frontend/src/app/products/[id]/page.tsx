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
            <main className="mx-auto max-w-3xl p-6">
                <p className="py-12 text-center text-red-600">
                    Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.
                </p>
            </main>
        );
    }

    if (!product) {
        notFound();
    }

    return (
        <main className="mx-auto max-w-3xl p-6">
            <ProductDetail product={product} />
        </main>
    );
}