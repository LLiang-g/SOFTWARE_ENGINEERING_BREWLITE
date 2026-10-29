import { ConflictException } from '@nestjs/common';
import type { OrderStatus } from '../generated/prisma/client';

export const ORDER_TRANSITIONS: Readonly<
    Record<OrderStatus, readonly OrderStatus[]>
> = {
    PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
    PAYMENT_FAILED: ['PENDING', 'PAID', 'CANCELLED'],
    PAID: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return ORDER_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
    return ORDER_TRANSITIONS[status].length === 0;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!canTransition(from, to)) {
        throw new ConflictException(`Không thể chuyển đơn từ ${from} sang ${to}`);
    }
}