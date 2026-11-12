'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { formatPrice } from '@/lib/format';
import { attemptLabels, paymentFetch, type StaffAttempt } from '@/features/payments/vnpay-api';

export default function StaffPayments() {
    const [rows, setRows] = useState<StaffAttempt[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [notes, setNotes] = useState<Record<number, string>>({});
    const lock = useRef(false);
    const token = useAuthStore((state) => state.token);
    const load = useCallback(async (signal?: AbortSignal) => {
        const data = await paymentFetch<StaffAttempt[]>('/staff/payments', { signal });
        if (!signal?.aborted && useAuthStore.getState().token === token) setRows(data);
    }, [token]);
    useEffect(() => {
        const controller = new AbortController();
        queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal).catch(() => {
            if (!controller.signal.aborted) setError('Không tải được giao dịch, hãy thử Tải lại.');
        }); });
        return () => controller.abort();
    }, [load]);
    async function act(id?: number, note = false) {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(null);
        try {
            if (id) await paymentFetch(`/staff/payments/${id}/${note ? 'notes' : 'check'}`, {
                method: 'POST', ...(note ? { body: JSON.stringify({ note: notes[id]?.trim() }) } : {}),
            });
            await load();
            if (note && id) setNotes((old) => ({ ...old, [id]: '' }));
        } catch (err) { setError(err instanceof Error ? err.message : 'Không xử lý được giao dịch'); }
        finally { lock.current = false; setBusy(false); }
    }
    return <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold">Thanh toán tại quầy</h1>
            <button type="button" disabled={busy} onClick={() => void act()} className="rounded-full border px-4 py-2">Tải lại</button></div>
        <p className="mt-2 text-sm text-muted">100 giao dịch gần nhất. Tra cứu VNPay và ghi lại hướng xử lý. Không tự xác nhận đã thu/hoàn tiền khi chưa có bằng chứng.</p>
        {error && <p role="alert" className="mt-3 text-chili">{error}</p>}
        {!rows.length && <p className="py-8">Chưa có giao dịch VNPay.</p>}
        <div className="mt-4 space-y-4">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="font-bold">Đơn #{row.orderId} — {formatPrice(row.amount)}</h2>
            <p>{attemptLabels[row.status]} · Đơn: {row.orderStatus}</p>
            <p className="break-all text-sm">Mã tra cứu: {row.txnRef}</p>
            <p className="text-sm">Mã VNPay: {row.providerTxnNo ?? 'Chưa có'} · Mã kết quả: {row.responseCode ?? 'Chưa có'}</p>
            {row.reviewReason && <p className="mt-2 font-semibold text-chili">Cần đối soát: {row.reviewReason === 'DUPLICATE_PAYMENT' ? 'Có khoản thu thêm cho đơn đã trả tiền' : row.reviewReason === 'PAID_WITHOUT_ACTIVE_ORDER' ? 'Tiền về khi đơn không còn giữ hàng hợp lệ' : 'Kết quả chưa xác định'}</p>}
            <button type="button" disabled={busy} onClick={() => void act(row.id)} className="mt-3 rounded-full border px-4 py-2 disabled:opacity-50">Tra cứu VNPay</button>
            <details className="mt-3"><summary className="cursor-pointer">Lịch sử xử lý</summary><ul className="mt-2 space-y-2 text-sm">{row.audits.map((audit) => <li key={audit.id}>
                {new Date(audit.createdAt).toLocaleString('vi-VN')} · {audit.actorId ? `NV/khách #${audit.actorId}` : 'Hệ thống'} · {audit.note}
            </li>)}</ul></details>
            <label className="mt-3 block text-sm">Ghi chú đối soát (không nhập thông tin thẻ hoặc secret)
                <textarea maxLength={1000} disabled={busy} value={notes[row.id] ?? ''} onChange={(e) => setNotes((old) => ({ ...old, [row.id]: e.target.value }))}
                    className="mt-1 block w-full rounded-xl border bg-transparent p-2" /></label>
            <button type="button" disabled={busy || (notes[row.id]?.trim().length ?? 0) < 3} onClick={() => void act(row.id, true)} className="mt-2 rounded-full border px-4 py-2 disabled:opacity-50">Lưu ghi chú</button>
        </article>)}</div>
    </main>;
}
