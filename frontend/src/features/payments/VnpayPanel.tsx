'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PaymentQr from './PaymentQr';
import { useAuthStore } from '@/features/auth/auth.store';
import { formatPrice } from '@/lib/format';
import { attemptLabels, paymentFetch, type Attempt } from './vnpay-api';

export default function VnpayPanel({ orderId, total, onResult, readOnly = false }: {
    orderId: number; total: number; onResult: () => Promise<void>; readOnly?: boolean;
}) {
    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const lock = useRef(false);
    const token = useAuthStore((state) => state.token);
    const storageKey = `brewlite-vnpay:${useAuthStore((state) => state.user?.id)}:${orderId}`;

    const load = useCallback(async (signal?: AbortSignal) => {
        const data = await paymentFetch<{ orderStatus: string; attempts: Attempt[] }>(`/payments/vnpay/orders/${orderId}`, { signal });
        if (signal?.aborted || useAuthStore.getState().token !== token) return;
        const latest = data.attempts[0] ?? null;
        setAttempt(latest);
        if (latest && ['FAILED', 'EXPIRED'].includes(latest.status)) sessionStorage.removeItem(storageKey);
        return data.orderStatus;
    }, [orderId, storageKey, token]);

    useEffect(() => {
        const controller = new AbortController();
        queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal).then((status) => {
            if (!readOnly && status && !['PENDING', 'PAYMENT_FAILED'].includes(status)) void onResult();
        }).catch(() => {
            if (!controller.signal.aborted) setError('Chưa tải được giao dịch. Bấm Kiểm tra kết quả để thử lại.');
        }); });
        // Chỉ poll HTTP trạng thái local, không gọi querydr liên tục.
        let count = 0;
        const timer = setInterval(() => {
            setNow(Date.now());
            if (++count <= 12) void load(controller.signal).then((status) => {
                if (!readOnly && status && !['PENDING', 'PAYMENT_FAILED'].includes(status)) void onResult();
            }).catch(() => {});
            // Keep the display clock ticking after polling stops, so expired QR disappears.
        }, 5000);
        return () => { controller.abort(); clearInterval(timer); };
    }, [load, onResult, readOnly]);

    async function act(checkOnly: boolean) {
        if (lock.current) return;
        lock.current = true;
        setBusy(true); setError(null);
        const originalToken = useAuthStore.getState().token;
        try {
            let result: Attempt;
            if (checkOnly && attempt) {
                result = await paymentFetch<Attempt>(`/payments/vnpay/attempts/${attempt.id}/check`, { method: 'POST' });
            } else if (checkOnly) {
                await load(); await onResult(); return;
            } else {
                // Mã đã quá hạn là một lần thanh toán mới; server vẫn phải đối soát lần cũ.
                if (attempt && (['FAILED', 'EXPIRED'].includes(attempt.status)
                    || new Date(attempt.expiresAt).getTime() <= Date.now())) sessionStorage.removeItem(storageKey);
                let key = sessionStorage.getItem(storageKey);
                if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
                result = await paymentFetch<Attempt>('/payments/vnpay/start', { method: 'POST',
                    headers: { 'Idempotency-Key': key }, body: JSON.stringify({ orderId }) });
            }
            if (useAuthStore.getState().token !== originalToken) return;
            setAttempt(result);
            if (['FAILED', 'EXPIRED'].includes(result.status)) {
                sessionStorage.removeItem(storageKey);
                if (!checkOnly) setError('Lần thanh toán cũ đã kết thúc. Bấm Thanh toán để tạo mã mới.');
            }
            if (!checkOnly && result.paymentUrl) {
                const target = new URL(result.paymentUrl);
                if (target.origin !== 'https://sandbox.vnpayment.vn' || target.pathname !== '/paymentv2/vpcpay.html') throw new Error('URL thanh toán không hợp lệ');
                // Show local QR and an explicit link; never auto-navigate away.
                return;
            }
            await onResult();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Chưa xác nhận được kết quả, hãy kiểm tra lại hoặc liên hệ quầy.');
        } finally { lock.current = false; setBusy(false); }
    }

    const expired = attempt ? new Date(attempt.expiresAt).getTime() <= now : false;
    return (
        <section className="mt-4 rounded-3xl border border-line bg-paper p-5" aria-labelledby="vnpay-title">
            <h2 id="vnpay-title" className="text-lg font-bold">Thanh toán VNPay Sandbox</h2>
            <p className="mt-2 text-sm text-muted">Tạo mã để quét bằng camera hoặc mở trang VNPay bên dưới. Đây là môi trường thử nghiệm.</p>
            {expired && !readOnly && <p role="alert" className="mt-3 text-sm text-chili">Mã cũ đã hết thời hạn. Nếu tài khoản đã bị trừ tiền, hãy kiểm tra kết quả trước. Tạo mã mới có thể dẫn đến thu trùng; quầy sẽ xử lý hoàn khoản thu dư.</p>}
            {!readOnly && !expired && attempt?.paymentUrl && <PaymentQr url={attempt.paymentUrl} />}
            {attempt && <div className="mt-3 space-y-1 text-sm" role="status">
                <p>{attemptLabels[attempt.status]}{expired && attempt.status === 'PENDING' ? ' — mã đã quá thời hạn, cần kiểm tra kết quả' : ''}</p>
                <p className="break-all">Mã tra cứu: {attempt.txnRef}</p>
                <p>Thời hạn mã: {new Date(attempt.expiresAt).toLocaleString('vi-VN')}</p>
            </div>}
            {attempt?.paidAt && attempt.status === 'REVIEW' && <p role="alert" className="mt-3 text-sm text-chili">Đã ghi nhận khoản thanh toán cần quầy đối soát. Không thanh toán thêm cho đơn này.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-chili">{error}</p>}
            {!readOnly && <button type="button" disabled={busy} onClick={() => void act(false)}
                className="mt-4 h-12 w-full rounded-full bg-espresso px-4 font-semibold text-white disabled:opacity-50">
                {busy ? 'Đang xử lý...' : `Tạo / lấy mã thanh toán ${formatPrice(total)}`}
            </button>}
            <button type="button" disabled={busy} onClick={() => void act(true)} className="mt-2 h-11 w-full rounded-full border border-line disabled:opacity-50">Kiểm tra kết quả</button>
            <p className="mt-3 text-sm text-muted">Chưa rõ kết quả? Bạn có thể rời trang, <Link href="/orders" className="underline">xem lịch sử đơn</Link> hoặc liên hệ quầy kèm mã tra cứu. Không cần ở lại màn hình này.</p>
        </section>
    );
}
