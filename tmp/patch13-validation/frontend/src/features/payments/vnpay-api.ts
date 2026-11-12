import { API_URL, readError } from '@/lib/api';
import { useAuthStore } from '@/features/auth/auth.store';

export type Attempt = {
    id: number; orderId: number; txnRef: string; amount: number;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'REVIEW';
    expiresAt: string; paidAt: string | null; paymentUrl: string | null;
    responseCode: string | null; reviewReason: string | null; createdAt: string;
};
export type StaffAttempt = Attempt & {
    providerTxnNo: string | null; orderStatus: string;
    audits: { id: number; actorId: number | null; action: string; note: string; createdAt: string }[];
};
export async function paymentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_URL}${path}`, { ...init, cache: 'no-store', headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers,
    } });
    if (!response.ok) throw new Error(await readError(response, 'Không xử lý được thanh toán. Hãy thử kiểm tra lại.'));
    return response.json();
}
export const attemptLabels: Record<Attempt['status'], string> = {
    PENDING: 'Chờ thanh toán / xác nhận', SUCCEEDED: 'Đã thanh toán', FAILED: 'Không thành công',
    EXPIRED: 'Lần thanh toán đã hết hạn', REVIEW: 'Cần quầy đối soát',
};
