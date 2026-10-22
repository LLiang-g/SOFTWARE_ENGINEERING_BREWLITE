'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';

export default function ProductCard({ product }: { product: Product }) {
    const [imageFailed, setImageFailed] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth === 0) {
            setImageFailed(true);
        }
    }, []);

    return (
        <Link
            href={`/products/${product.id}`}
            className="block overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
        >
            <div className="flex h-40 items-center justify-center bg-amber-50">
                {imageFailed ? (
                    <span className="text-5xl">☕</span>
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        ref={imgRef}
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={() => setImageFailed(true)}
                    />
                )}
            </div>
            <div className="p-3">
                <h3 className="font-medium text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600">{formatPrice(product.price)}</p>
            </div>
        </Link>
    );
}