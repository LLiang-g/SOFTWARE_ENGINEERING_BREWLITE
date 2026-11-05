import { API_URL, readError } from '@/lib/api';
import { ApiError } from '@/lib/orders-api';
import type { OrderView } from '@/lib/types';

export type NextStaffStatus = 'PREPARING' | 'READY' | 'COMPLETED';

async function staffRequest<T>(path: string, options: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}/staff/orders${path}`, options);
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
