'use client';
import { useEffect, useState } from 'react';
import { paymentFetch } from './vnpay-api';
import { formatPrice } from '@/lib/format';
type Refund = { id: number; amount: number; status: string; completedAt: string | null; attempt: { orderId: number } };
const labels: Record<string,string> = { OPEN:'Chờ quầy xử lý', PROCESSING:'Quầy đang xử lý', COMPLETED:'Quầy đã xác nhận hoàn thủ công' };
export default function RefundStatus({ orderId }: { orderId: number }) {
    const [rows,setRows] = useState<Refund[]>([]);
    const [error,setError] = useState('');
    async function load() {
        try { setRows(await paymentFetch<Refund[]>('/orders/payment-refunds/mine')); setError(''); }
        catch { setError('Chưa tải được trạng thái khoản thu dư.'); }
    }
    useEffect(() => {
        let active = true;
        void paymentFetch<Refund[]>('/orders/payment-refunds/mine').then(data => { if (active) setRows(data); })
            .catch(() => { if (active) setError('Chưa tải được trạng thái khoản thu dư.'); });
        return () => { active = false; };
    },[orderId]);
    const own = rows.filter(row => row.attempt.orderId === orderId);
    return <div className="space-y-2 text-sm">
        {own.map(row => <p key={row.id}>Khoản thu cần hoàn #{row.id}: {formatPrice(row.amount)} — {labels[row.status] ?? row.status}{row.completedAt ? ` (${new Date(row.completedAt).toLocaleString('vi-VN')})` : ''}.</p>)}
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={() => void load()} className="underline">Kiểm tra khoản thu dư</button>
    </div>;
}
