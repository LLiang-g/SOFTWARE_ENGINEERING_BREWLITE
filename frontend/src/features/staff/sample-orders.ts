import type { OrderView } from '@/lib/types';

export const SAMPLE_ORDERS: OrderView[] = [
    {
        id: 104,
        status: 'PAID',
        createdAt: '2026-11-05T09:18:00+07:00',
        total: 80000,
        discount: 0,
        voucherCode: null,
        pointsEarned: 0,
        items: [
            { id: 1, productId: 1, name: 'Cà phê sữa', size: 'M', toppings: ['JELLY'], toppingNames: ['Thạch cà phê'], qty: 2, lineTotal: 80000 },
        ],
    },
    {
        id: 103,
        status: 'PREPARING',
        createdAt: '2026-11-05T09:15:00+07:00',
        total: 45000,
        discount: 0,
        voucherCode: null,
        pointsEarned: 0,
        items: [
            { id: 2, productId: 3, name: 'Cappuccino', size: 'S', toppings: [], toppingNames: [], qty: 1, lineTotal: 45000 },
        ],
    },
    {
        id: 102,
        status: 'READY',
        createdAt: '2026-11-05T09:12:00+07:00',
        total: 79000,
        discount: 0,
        voucherCode: null,
        pointsEarned: 0,
        items: [
            { id: 3, productId: 2, name: 'Americano', size: 'S', toppings: [], toppingNames: [], qty: 1, lineTotal: 40000 },
            { id: 4, productId: 4, name: 'Trà đào', size: 'S', toppings: [], toppingNames: [], qty: 1, lineTotal: 39000 },
        ],
    },
    {
        id: 101,
        status: 'COMPLETED',
        createdAt: '2026-11-05T09:08:00+07:00',
        total: 39000,
        discount: 0,
        voucherCode: null,
        pointsEarned: 0,
        items: [
            { id: 5, productId: 4, name: 'Trà đào', size: 'S', toppings: [], toppingNames: [], qty: 1, lineTotal: 39000 },
        ],
    },
];
