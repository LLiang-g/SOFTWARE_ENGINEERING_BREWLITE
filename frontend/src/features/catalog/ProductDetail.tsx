'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductDetail as ProductDetailType, SizeCode } from '@/lib/types';
import { calcUnitPrice } from '@/lib/pricing';
import { formatPrice } from '@/lib/format';
import ProductImage from './ProductImage';

export default function ProductDetail({
                                          product,
                                      }: {
    product: ProductDetailType;
}) {
    const [size, setSize] = useState<SizeCode>('M');
    const [toppings, setToppings] = useState<string[]>([]);

    const unitPrice = calcUnitPrice(
        product.price,
        size,
        toppings,
        product.options,
    );

    function toggleTopping(code: string) {
        setToppings((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
        );
    }

    function handleAddToCart() {
        // Chặng 3 sẽ nối vào giỏ hàng. Tạm thời chỉ in ra console để kiểm tra.
        console.log({ productId: product.id, size, toppings, unitPrice });
    }

    return (
        <div>
            <Link href="/" className="text-sm text-gray-500 hover:underline">
                ← Quay lại menu
            </Link>

            <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl bg-amber-50">
                    <ProductImage src={product.imageUrl} alt={product.name} />
                </div>

                <div>
                    <h1 className="text-2xl font-bold">{product.name}</h1>
                    <p className="mt-1 text-gray-500">
                        Giá gốc: {formatPrice(product.price)}
                    </p>

                    <h2 className="mt-6 font-medium">Size</h2>
                    <div className="mt-2 flex gap-2">
                        {product.options.sizes.map((s) => (
                            <button
                                key={s.code}
                                type="button"
                                onClick={() => setSize(s.code)}
                                className={`rounded-lg border px-4 py-2 text-sm ${
                                    size === s.code
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-gray-300 hover:border-amber-600'
                                }`}
                            >
                                {s.code}
                                {s.extra > 0 && ` (+${formatPrice(s.extra)})`}
                            </button>
                        ))}
                    </div>

                    <h2 className="mt-6 font-medium">Topping</h2>
                    <div className="mt-2 space-y-2">
                        {product.options.toppings.map((t) => (
                            <label key={t.code} className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={toppings.includes(t.code)}
                                    onChange={() => toggleTopping(t.code)}
                                />
                                {t.name} (+{formatPrice(t.price)})
                            </label>
                        ))}
                    </div>

                    <p className="mt-6 text-xl font-semibold">
                        Thành tiền: {formatPrice(unitPrice)}
                    </p>

                    <button
                        type="button"
                        onClick={handleAddToCart}
                        className="mt-4 w-full rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-700"
                    >
                        Thêm vào giỏ
                    </button>
                </div>
            </div>
        </div>
    );
}