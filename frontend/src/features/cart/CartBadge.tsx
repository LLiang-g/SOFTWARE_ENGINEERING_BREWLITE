'use client';

import Link from 'next/link';
import { IconCart } from '@/components/icons';
import { useCartStore, selectCount } from './cart.store';
import { useHydrated } from './useHydrated';

// Nút giỏ hàng ở thanh trên (màn hình rộng). Điện thoại dùng thanh tab ở đáy.
export default function CartBadge() {
    const hydrated = useHydrated();
    const count = useCartStore(selectCount);

    return (
        <Link
            href="/cart"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium hover:border-espresso"
        >
            <IconCart className="h-5 w-5" />
            Giỏ hàng
            {hydrated && count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-crema px-1.5 text-xs font-bold">
                    {count}
                </span>
            )}
        </Link>
    );
}
