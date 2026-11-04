export default function OrdersLiveStatus({
    connected, busy, refresh,
}: {
    connected: boolean;
    busy: boolean;
    refresh: () => void;
}) {
    return (
        <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p role="status" className={connected ? 'text-green-700' : 'text-amber-800'}>
                {connected ? 'Đang cập nhật trực tiếp' : 'Chưa kết nối cập nhật trực tiếp'}
            </p>
            <button type="button" onClick={refresh} disabled={busy}
                className="font-semibold text-amber-800 underline disabled:opacity-50">
                {busy ? 'Đang tải...' : 'Tải lại'}
            </button>
        </div>
    );
}
