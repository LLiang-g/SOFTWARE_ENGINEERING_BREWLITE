import { API_URL, readError } from '@/lib/api';
import { ApiError } from '@/lib/orders-api';
import { useAuthStore } from '@/features/auth/auth.store';
import type { OrderView } from '@/lib/types';

export type NextStaffStatus = 'PREPARING' | 'READY' | 'COMPLETED';

async function staffRequest<T>(path: string, options: RequestInit): Promise<T> {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_URL}/staff/orders${path}`, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
    if (!response.ok) {
        throw new ApiError(await readError(response, 'Yêu cầu thất bại.'), response.status);
    }
    return response.json();
}

export function getStaffOrders(signal?: AbortSignal) {
    return staffRequest<OrderView[]>('', { cache: 'no-store', signal });
}

export function updateStaffOrder(id: number, status: NextStaffStatus) {
    return staffRequest<OrderView>(`/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
}
