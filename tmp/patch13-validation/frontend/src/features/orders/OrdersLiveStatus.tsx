import { IconRefresh } from '@/components/icons';

export default function OrdersLiveStatus({
    connected, busy, refresh, showRefresh = true,
}: {
    connected: boolean;
    busy: boolean;
    refresh: () => void;
    // Trang khách chỉ cần nút tải lại khi mất kết nối hoặc tải lỗi; trang barista luôn hiện.
    showRefresh?: boolean;
}) {
    return (
        <div className="my-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p role="status" className={`flex items-center gap-2 ${connected ? 'text-pandan' : 'text-muted'}`}>
                <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${connected ? 'bg-pandan' : 'bg-crema'}`}
                />
                {connected ? 'Đang cập nhật trực tiếp' : 'Chưa kết nối cập nhật trực tiếp'}
            </p>
            {showRefresh && (
                <button
                    type="button"
                    onClick={refresh}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center gap-1.5 font-medium text-espresso underline-offset-2 hover:underline disabled:opacity-50"
                >
                    <IconRefresh className={`h-4 w-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
                    {busy ? 'Đang tải...' : 'Tải lại'}
                </button>
            )}
        </div>
    );
}
