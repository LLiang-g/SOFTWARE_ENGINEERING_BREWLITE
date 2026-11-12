import { ORDER_STATUS_LABEL } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

// Màu theo ý nghĩa: cần xử lý (vàng/đỏ), đang làm (nâu), sẵn sàng (xanh), đã xong (xám).
const CHIP_STYLE: Record<OrderStatus, string> = {
    PENDING: 'bg-crema-soft text-espresso',
    PAID: 'bg-espresso/10 text-espresso',
    PAYMENT_FAILED: 'bg-chili-soft text-chili',
    PREPARING: 'bg-espresso/10 text-espresso',
    READY: 'bg-pandan text-white',
    COMPLETED: 'bg-pandan-soft text-pandan',
    CANCELLED: 'bg-line text-muted',
};

export default function StatusChip({ status }: { status: OrderStatus }) {
    return (
        <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${CHIP_STYLE[status]}`}>
            {ORDER_STATUS_LABEL[status]}
        </span>
    );
}
