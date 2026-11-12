'use client';
import { useEffect, useState } from 'react';
import MockPaymentPanel from './MockPaymentPanel';
import VnpayPanel from './VnpayPanel';
import { paymentFetch } from './vnpay-api';

export default function PaymentPanel(props: { orderId: number; total: number; onResult: () => Promise<void>; readOnly?: boolean }) {
    const [config, setConfig] = useState<{ enabled: boolean; mockEnabled: boolean } | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void paymentFetch<{ enabled: boolean; mockEnabled: boolean }>('/payments/vnpay/config', { signal: controller.signal })
            .then((value) => { if (!controller.signal.aborted) setConfig(value); })
            .catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, []);
    if (error) return <p role="alert" className="mt-4 text-chili">Không tải được phương thức thanh toán. Hãy tải lại trang.</p>;
    if (!config) return <p className="mt-4" role="status">Đang tải phương thức thanh toán...</p>;
    if (config.enabled) return <VnpayPanel {...props} />;
    if (props.readOnly) return null;
    if (config.mockEnabled) return <MockPaymentPanel {...props} />;
    return <p className="mt-4" role="status">Thanh toán hiện chưa khả dụng. Vui lòng liên hệ quầy.</p>;
}
