import Link from 'next/link';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import ProductImage from './ProductImage';

export default function ProductCard({ product }: { product: Product }) {
    return (
        <Link
            href={`/products/${product.id}`}
            className="block overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
        >
            <div className="flex h-40 items-center justify-center bg-amber-50">
                <ProductImage src={product.imageUrl} alt={product.name} />
            </div>
            <div className="p-3">
                <h3 className="font-medium text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600">{formatPrice(product.price)}</p>
            </div>
        </Link>
    );
}