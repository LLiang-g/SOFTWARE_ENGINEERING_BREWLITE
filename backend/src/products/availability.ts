import { SIZE_FACTOR_PERCENT, type SizeCode } from '../common/pricing';

export type RecipeLine = {
    quantity: number;
    stock: number;
    /** Mặc định true: lượng dùng nhân theo hệ số size. Topping và ly nhựa đặt false. */
    scalesWithSize?: boolean;
};

/** Lượng nguyên liệu dùng cho một ly ở size đã chọn, làm tròn lên để không trừ thiếu. */
export function usagePerServing(
    quantity: number,
    scalesWithSize: boolean,
    size: SizeCode = 'S',
): number {
    if (!scalesWithSize) return quantity;
    return Math.ceil((quantity * SIZE_FACTOR_PERCENT[size]) / 100);
}

/**
 * Số ly tối đa pha được từ kho nguyên liệu hiện tại ở một size.
 * Mỗi dòng công thức giới hạn một mức, nguyên liệu khan hiếm nhất quyết định kết quả.
 * Món chưa có công thức thì chưa pha được nên trả 0.
 */
export function calcServings(lines: RecipeLine[], size: SizeCode = 'S'): number {
    if (lines.length === 0) return 0;
    return Math.min(
        ...lines.map((line) =>
            Math.max(
                0,
                Math.floor(
                    line.stock /
                        usagePerServing(line.quantity, line.scalesWithSize ?? true, size),
                ),
            ),
        ),
    );
}

/** Số ly còn lại theo từng size. Size S dùng ít nhất nên luôn là số lớn nhất. */
export function calcServingsBySize(lines: RecipeLine[]): Record<SizeCode, number> {
    return {
        S: calcServings(lines, 'S'),
        M: calcServings(lines, 'M'),
        L: calcServings(lines, 'L'),
    };
}
