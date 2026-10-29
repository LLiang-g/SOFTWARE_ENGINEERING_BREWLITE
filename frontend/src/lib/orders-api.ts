import { API_URL, readError } from './api';
import { useAuthStore } from '@/features/auth/auth.store';
import { OrderView, PayResult, PaymentMethod, SizeCode } from './types';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    });
    if (!res.ok) {
        throw new ApiError(
            await readError(res, 'Có lỗi xảy ra, vui lòng thử lại'),
            res.status,
        );
    }
    return res.json();
}

export type NewOrderItem = {
    productId: number;
    size: SizeCode;
    toppings: string[];
    qty: number;
};

export function createOrder(items: NewOrderItem[]) {
    return authFetch<OrderView>('/orders', {
        method: 'POST',
        body: JSON.stringify({ items }),
    });
}

export function getOrder(id: number) {
    return authFetch<OrderView>(`/orders/${id}`, { cache: 'no-store' });
}

export function payOrder(input: {
    orderId: number;
    method: PaymentMethod;
    simulateFailure: boolean;
    idempotencyKey: string;
}) {
    return authFetch<PayResult>('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': input.idempotencyKey },
        body: JSON.stringify({
            orderId: input.orderId,
            method: input.method,
            simulateFailure: input.simulateFailure,
        }),
    });
}

export function getMyOrders() {
    return authFetch<OrderView[]>('/orders/me', { cache: 'no-store' });
}