'use client';
import { useState } from 'react';
import StaffBoard from './StaffBoard';
import StaffPayments from './StaffPayments';
export default function StaffWorkspace() {
    const [tab, setTab] = useState<'orders' | 'payments'>('orders');
    return <>
        <nav aria-label="Khu vực barista" className="flex justify-center gap-3 border-b border-line p-3">
            <button type="button" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')} className="rounded-full border px-4 py-2">Đơn hàng</button>
            <button type="button" aria-pressed={tab === 'payments'} onClick={() => setTab('payments')} className="rounded-full border px-4 py-2">Thanh toán</button>
        </nav>
        {tab === 'orders' ? <StaffBoard /> : <StaffPayments />}
    </>;
}
