import { getProducts } from '@/lib/api';
import ProductGrid from '@/features/catalog/ProductGrid';

export default async function MenuPage() {
    let products;
    try {
        products = await getProducts();
    } catch {
        return (
            <main className="mx-auto max-w-5xl p-6">
                <p className="py-12 text-center text-red-600">
                    Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-5xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Menu</h1>
            <ProductGrid products={products} />
        </main>
    );
}