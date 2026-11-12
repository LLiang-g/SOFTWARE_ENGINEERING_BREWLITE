'use client';

import ExchangePanel from './ExchangePanel';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { IconCheck } from '@/components/icons';
import { useAuthStore } from '@/features/auth/auth.store';
import { useHydrated } from '@/features/cart/useHydrated';
import PaymentPanel from '@/features/payments/PaymentPanel';
import { ApiError, cancelOrder, getMe, getOrder } from '@/lib/orders-api';
import { ORDER_STATUS_LABEL, formatPrice } from '@/lib/format';
import { OrderStatus, OrderView } from '@/lib/types';
import OrdersLiveStatus from './OrdersLiveStatus';
import { useOrdersLive } from './useOrdersLive';

const HEADINGS: Record<OrderStatus, string> = {
    PENDING: 'Đơn hàng đã được tạo',
    PAID: 'Đặt hàng thành công',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    PREPARING: 'Đơn hàng đang được pha chế',
    READY: 'Đồ uống đã sẵn sàng',
    COMPLETED: 'Đơn hàng đã hoàn tất',
    CANCELLED: 'Đơn hàng đã hủy',
};

const MESSAGES: Record<OrderStatus, string> = {
    PENDING: 'Thanh toán để gửi đơn tới quầy.',
    PAID: 'Quầy sẽ sớm tiếp nhận đơn của bạn.',
    PAYMENT_FAILED: 'Đơn vẫn được giữ, bạn có thể thanh toán lại.',
    PREPARING: 'Nhân viên đang pha chế đồ uống của bạn.',
    READY: 'Mời tới quầy và đọc mã đơn để nhận nước.',
    COMPLETED: 'Đã giao đồ uống. Cảm ơn bạn đã chọn BrewLite!',
    CANCELLED: '',
};

// Màu phần đầu vé theo trạng thái: đang làm là nâu đậm, sẵn sàng là xanh, kết thúc là xám.
const BAND: Record<OrderStatus, string> = {
    PENDING: 'bg-crema-soft text-espresso',
    PAID: 'bg-espresso text-white',
    PAYMENT_FAILED: 'bg-chili-soft text-chili',
    PREPARING: 'bg-espresso text-white',
    READY: 'bg-pandan text-white',
    COMPLETED: 'bg-line text-espresso',
    CANCELLED: 'bg-line text-espresso',
};

const STEPS: OrderStatus[] = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];
const PAYABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];
const CANCELLABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];

function Progress({ status }: { status: OrderStatus }) {
    const current = STEPS.indexOf(status);
    const allDone = status === 'COMPLETED';
    return (
        <ol aria-label="Tiến trình đơn hàng" className="grid grid-cols-4">
            {STEPS.map((step, i) => {
                const done = allDone || i < current;
                const isCurrent = !allDone && i === current;
                const ready = isCurrent && status === 'READY';
                return (
                    <li
                        key={step}
                        aria-current={isCurrent ? 'step' : undefined}
                        className="relative flex flex-col items-center text-center"
                    >
                        {i < STEPS.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={`absolute top-3.5 left-1/2 h-0.5 w-full ${i < current || allDone ? 'bg-espresso' : 'bg-line'}`}
                            />
                        )}
                        <span className="relative z-10 flex h-7 w-7 items-center justify-center">
                            {ready && (
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-full bg-pandan/40 motion-safe:animate-ping"
                                />
                            )}
                            <span
                                className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                                    done
                                        ? 'border-espresso bg-espresso text-white'
                                        : ready
                                            ? 'border-pandan bg-pandan text-white'
                                            : isCurrent
                                                ? 'border-crema bg-crema'
                                                : 'border-line bg-paper'
                                }`}
                            >
                                {(done || ready) && <IconCheck className="h-4 w-4" />}
                            </span>
                        </span>
                        <span
                            className={`mt-2 px-0.5 text-xs leading-tight ${
                                isCurrent ? 'font-semibold text-espresso' : 'text-muted'
                            }`}
                        >
                            {ORDER_STATUS_LABEL[step]}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export default function OrderConfirmation({ id }: { id: number }) {
    const hydrated = useHydrated();
    const token = useAuthStore((s) => s.token);
    const updateUser = useAuthStore((s) => s.updateUser);
    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const loadOrder = useCallback(async (signal: AbortSignal) => {
        try {
            const data = await getOrder(id, signal);
            if (signal.aborted || useAuthStore.getState().token !== token) return;
            setOrder(data);
            setError(null);
        } catch (err) {
            if (signal.aborted || useAuthStore.getState().token !== token) return;
            setError(
                err instanceof ApiError && err.status === 404
                    ? 'Không tìm thấy đơn hàng.'
                    : 'Không tải được đơn hàng. Hãy thử tải lại.',
            );
        }
    }, [id, token]);
    const { connected, isLoading, refresh } = useOrdersLive(hydrated && Boolean(token), loadOrder);

    async function reloadAfterPayment() {
        await refresh();
        try {
            const user = await getMe();
            if (useAuthStore.getState().token === token) updateUser(user);
        } catch {
            // Không lấy được số điểm mới thì bỏ qua, đơn hàng vẫn hiển thị bình thường.
        }
    }

    if (!hydrated) {
        return <div className="mt-6 h-96 rounded-[24px] bg-line motion-safe:animate-pulse" aria-busy="true" />;
    }

    if (!token) {
        return (
            <div className="py-14 text-center">
                <h1 className="font-display text-xl font-bold">Đăng nhập để xem đơn hàng</h1>
                <p className="mt-1 text-muted">Bạn cần đăng nhập đúng tài khoản đã đặt đơn này.</p>
                <Link
                    href={`/login?next=/orders/${id}`}
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-espresso px-6 font-semibold text-white hover:bg-roast"
                >
                    Đăng nhập
                </Link>
            </div>
        );
    }

    const liveStatus = <OrdersLiveStatus connected={connected} busy={isLoading} refresh={refresh} showRefresh={!connected || Boolean(error)} />;

    if (error && !order) {
        return (
            <div className="py-10 text-center">
                <p role="alert" className="rounded-2xl bg-chili-soft px-4 py-3 text-chili">{error}</p>
                <div className="flex justify-center">{liveStatus}</div>
                <Link href="/" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                    Về trang chủ
                </Link>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="py-4" aria-busy="true">
                {liveStatus}
                <div className="h-96 rounded-[24px] bg-line motion-safe:animate-pulse" />
            </div>
        );
    }

    async function handleCancel() {
        if (!order || !window.confirm('Bạn chắc chắn muốn hủy đơn này?')) return;
        setCancelling(true);
        setCancelError(null);
        try {
            await cancelOrder(order.id);
            await refresh();
        } catch (err) {
            setCancelError(
                err instanceof ApiError
                    ? err.message
                    : 'Không hủy được đơn. Hãy kiểm tra backend đã chạy chưa.',
            );
        } finally {
            setCancelling(false);
        }
    }

    const showProgress = STEPS.includes(order.status);
    const payable = PAYABLE_STATUSES.includes(order.status);
    const canCancel = CANCELLABLE_STATUSES.includes(order.status);
    const success = showProgress;
    const message = MESSAGES[order.status];

    return (
        <div>
            {liveStatus}

            <article className="rounded-[24px] bg-paper shadow-[0_14px_34px_-16px_rgba(43,26,18,0.35)]">
                <header className={`rounded-t-[24px] px-5 pt-6 pb-7 ${BAND[order.status]}`}>
                    <h1 className="font-display text-[1.4rem] leading-snug font-bold tracking-tight">
                        {HEADINGS[order.status]}
                    </h1>
                    {message && <p className="mt-1 text-[15px] opacity-90">{message}</p>}
                    <p className="mt-6 text-sm opacity-80">Mã đơn</p>
                    <p className="font-display text-6xl leading-none font-extrabold tracking-tight tabular-nums">
                        #{order.id}
                    </p>
                </header>

                <div className="ticket-cut" />

                <div className="px-5 pt-6 pb-5">
                    {showProgress && <Progress status={order.status} />}

                    <ul className={showProgress ? 'mt-6' : ''}>
                        {order.items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-start justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-b-0"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {item.qty} × {item.name}
                                    </p>
                                    <p className="text-sm text-muted">
                                        Size {item.size}
                                        {item.toppingNames.length > 0 && `, ${item.toppingNames.join(', ')}`}
                                    </p>
                                </div>
                                <p className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</p>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-2 space-y-1.5 border-t border-line pt-4 text-[15px]">
                        {order.discount > 0 && (
                            <>
                                <p className="flex justify-between text-muted">
                                    <span>Tạm tính</span>
                                    <span className="tabular-nums">{formatPrice(order.total + order.discount)}</span>
                                </p>
                                <p className="flex justify-between text-pandan">
                                    <span>Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}</span>
                                    <span className="tabular-nums">-{formatPrice(order.discount)}</span>
                                </p>
                            </>
                        )}
                        {order.creditApplied > 0 ? (
                            <>
                                <p className="flex justify-between text-muted">
                                    <span>Tổng tiền món</span>
                                    <span className="tabular-nums">{formatPrice(order.total)}</span>
                                </p>
                                <p className="flex justify-between gap-3 text-pandan">
                                    <span>Tiền chuyển từ đơn cũ</span>
                                    <span className="shrink-0 tabular-nums">−{formatPrice(order.creditApplied)}</span>
                                </p>
                                <p className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                                    <span className="font-semibold">{payable ? 'Cần thanh toán thêm' : success ? 'Chênh lệch đã thanh toán' : 'Chênh lệch của lần đổi'}</span>
                                    <span className="shrink-0 font-display text-2xl font-bold tabular-nums">{formatPrice(order.amountDue)}</span>
                                </p>
                            </>
                        ) : (
                            <p className="flex items-baseline justify-between pt-1">
                                <span className="font-semibold">Tổng</span>
                                <span className="font-display text-2xl font-bold tabular-nums">{formatPrice(order.total)}</span>
                            </p>
                        )}
                    </div>

                    {success && order.pointsEarned > 0 && (
                        <p className="mt-4 rounded-xl bg-crema-soft px-3.5 py-2.5 text-sm font-medium">
                            Bạn được cộng {order.pointsEarned} điểm tích lũy
                        </p>
                    )}
                </div>
            </article>

            {error && <p role="alert" className="mt-3 rounded-2xl bg-chili-soft px-4 py-3 text-sm text-chili">{error}</p>}

            {(
                <PaymentPanel
                    orderId={order.id}
                    total={order.amountDue ?? order.total}
                    onResult={reloadAfterPayment}
                    readOnly={!payable}
                />
            )}

            <ExchangePanel orderId={order.id} canRequest={order.status === 'PAID'} />

            {canCancel && !(order.creditApplied > 0) && (
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="mt-4 h-12 w-full rounded-full border-2 border-chili/40 font-semibold text-chili hover:bg-chili-soft disabled:opacity-60"
                >
                    {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                </button>
            )}
            {cancelError && (
                <p role="alert" className="mt-2 text-sm text-chili">{cancelError}</p>
            )}

            <Link
                href="/"
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full border-2 border-line bg-paper font-semibold hover:border-espresso"
            >
                Về trang chủ
            </Link>
        </div>
    );
}
