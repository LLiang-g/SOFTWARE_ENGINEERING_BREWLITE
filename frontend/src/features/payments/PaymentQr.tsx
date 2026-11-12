'use client';
import { useMemo } from 'react';
import qrcode from './vendor/qrcode';
export default function PaymentQr({ url }: { url: string }) {
    const image = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(url); qr.make();
        const count = qr.getModuleCount();
        let path = '';
        for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
            if (qr.isDark(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
        }
        return { path, size: count + 8 };
    }, [url]);
    return <div className="mt-4 text-center">
        <svg role="img" aria-label="Quét để mở trang thanh toán VNPay" viewBox={`0 0 ${image.size} ${image.size}`}
            className="mx-auto h-auto w-full max-w-96" shapeRendering="crispEdges">
            <rect width="100%" height="100%" fill="white" /><path d={image.path} fill="black" />
        </svg>
        <p className="mt-2 text-sm">Dùng camera điện thoại để mở trang VNPay. Đây không phải QR chuyển khoản trong ứng dụng ngân hàng.</p>
        <a href={url} className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-espresso px-4 font-semibold text-white">Chuyển đến trang thanh toán VNPay</a>
    </div>;
}
