import Link from 'next/link';
import { IconPlus } from '@/components/icons';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { DRINK_TINT, drinkKindFor } from './DrinkArt';
import ProductImage from './ProductImage';

export default function ProductCard({ product }: { product: Product }) {
    const tint = DRINK_TINT[drinkKindFor(product.name)];
    const soldOut = product.available <= 0;

    return (
        <Link href={`/products/${product.id}`} className="group block rounded-[22px]">
            <div
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[22px]"
                style={{ backgroundColor: tint }}
            >
                <div
                    className={`flex h-full w-full items-center justify-center ${
                        soldOut ? 'opacity-55 grayscale' : ''
                    }`}
                >
                    <ProductImage src={product.imageUrl} alt={product.name} />
                </div>
                {soldOut ? (
                    <span className="absolute top-2.5 left-2.5 rounded-full bg-espresso px-3 py-1 text-xs font-semibold text-white">
                        Hết hàng
                    </span>
                ) : (
                    <span
                        aria-hidden="true"
                        className="absolute right-2.5 bottom-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-espresso text-white transition group-hover:scale-105 group-active:scale-95"
                    >
                        <IconPlus className="h-5 w-5" />
                    </span>
                )}
            </div>
            <h3 className={`mt-3 leading-snug font-semibold ${soldOut ? 'text-muted' : ''}`}>{product.name}</h3>
            <p className="mt-0.5 text-[15px] text-muted tabular-nums">{formatPrice(product.price)}</p>
        </Link>
    );
}
