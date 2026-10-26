import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SizeCode } from '@/lib/types';

export type CartItem = {
    key: string;
    productId: number;
    name: string;
    size: SizeCode;
    toppings: string[];
    toppingNames: string[];
    unitPrice: number;
    qty: number;
};

type NewCartItem = Omit<CartItem, 'key' | 'qty'>;

type CartState = {
    items: CartItem[];
    addItem: (item: NewCartItem, qty?: number) => void;
    setQty: (key: string, qty: number) => void;
    removeItem: (key: string) => void;
    clear: () => void;
};

const MAX_QTY = 99;

function makeKey(item: NewCartItem): string {
    return `${item.productId}|${item.size}|${[...item.toppings].sort().join(',')}`;
}

export const useCartStore = create<CartState>()(
    persist(
        (set) => ({
            items: [],

            addItem: (item, qty = 1) =>
                set((state) => {
                    const key = makeKey(item);
                    const existing = state.items.find((i) => i.key === key);
                    if (existing) {
                        return {
                            items: state.items.map((i) =>
                                i.key === key
                                    ? { ...i, qty: Math.min(i.qty + qty, MAX_QTY) }
                                    : i,
                            ),
                        };
                    }
                    return { items: [...state.items, { ...item, key, qty }] };
                }),

            setQty: (key, qty) =>
                set((state) => ({
                    items:
                        qty <= 0
                            ? state.items.filter((i) => i.key !== key)
                            : state.items.map((i) =>
                                i.key === key ? { ...i, qty: Math.min(qty, MAX_QTY) } : i,
                            ),
                })),

            removeItem: (key) =>
                set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

            clear: () => set({ items: [] }),
        }),
        { name: 'brewlite-cart' },
    ),
);

export const selectTotal = (state: CartState) =>
    state.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

export const selectCount = (state: CartState) =>
    state.items.reduce((sum, i) => sum + i.qty, 0);