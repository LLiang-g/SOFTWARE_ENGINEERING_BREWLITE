import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import type { OrderStatus } from '../generated/prisma/client';
import { assertTransition, canTransition } from './order-state-machine';

const ALL: OrderStatus[] = [
    'PENDING',
    'PAID',
    'PAYMENT_FAILED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED',
];

describe('Order state machine', () => {
    it('cho phép luồng thành công PENDING → PAID → PREPARING → READY → COMPLETED', () => {
        const path: OrderStatus[] = [
            'PENDING',
            'PAID',
            'PREPARING',
            'READY',
            'COMPLETED',
        ];
        for (let i = 0; i < path.length - 1; i++) {
            expect(() => assertTransition(path[i], path[i + 1])).not.toThrow();
        }
    });

    it('cho phép thanh toán lỗi rồi thử lại', () => {
        expect(() => assertTransition('PENDING', 'PAYMENT_FAILED')).not.toThrow();
        expect(() => assertTransition('PAYMENT_FAILED', 'PENDING')).not.toThrow();
        expect(() => assertTransition('PAYMENT_FAILED', 'PAID')).not.toThrow();
    });

    it.each<[OrderStatus, OrderStatus]>([
        ['PENDING', 'READY'],
        ['PENDING', 'COMPLETED'],
        ['PENDING', 'PREPARING'],
        ['PAID', 'READY'],
        ['PAID', 'COMPLETED'],
        ['PREPARING', 'PAID'],
        ['READY', 'PREPARING'],
        ['PAID', 'PENDING'],
    ])('chặn chuyển trạng thái sai %s → %s', (from, to) => {
        expect(() => assertTransition(from, to)).toThrow(ConflictException);
    });

    it('COMPLETED và CANCELLED là trạng thái kết thúc, không đi tiếp được', () => {
        for (const to of ALL) {
            expect(canTransition('COMPLETED', to)).toBe(false);
            expect(canTransition('CANCELLED', to)).toBe(false);
        }
    });

    it('chỉ có đúng 10 chuyển tiếp hợp lệ', () => {
        const allowed = ALL.flatMap((from) =>
            ALL.filter((to) => canTransition(from, to)).map((to) => `${from}->${to}`),
        );
        expect(allowed.sort()).toEqual(
            [
                'PENDING->PAID',
                'PENDING->PAYMENT_FAILED',
                'PENDING->CANCELLED',
                'PAYMENT_FAILED->PENDING',
                'PAYMENT_FAILED->PAID',
                'PAYMENT_FAILED->CANCELLED',
                'PAID->PREPARING',
                'PAID->CANCELLED',
                'PREPARING->READY',
                'READY->COMPLETED',
            ].sort(),
        );
    });
});