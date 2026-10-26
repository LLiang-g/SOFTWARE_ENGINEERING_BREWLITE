'use client';

import Link from 'next/link';
import { useCartStore, selectCount } from './cart.store';
import { useHydrated } from './useHydrated';

export default function CartBadge() {
    const hydrated = useHydrated();
    const count = useCartStore(selectCount);

    return (
        <Link
            href="/cart"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:border-amber-600"
        >
            <span>🛒 Giỏ hàng</span>
            {hydrated && count > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">
          {count}
        </span>
            )}
        </Link>
    );
}