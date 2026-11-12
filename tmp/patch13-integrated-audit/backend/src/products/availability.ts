export type RecipeLine = { quantity: number; stock: number };

/**
 * Số ly tối đa pha được từ kho nguyên liệu hiện tại.
 * Mỗi dòng công thức giới hạn một mức, nguyên liệu khan hiếm nhất quyết định kết quả.
 * Món chưa có công thức thì chưa pha được nên trả 0.
 */
export function calcServings(lines: RecipeLine[]): number {
    if (lines.length === 0) return 0;
    return Math.min(
        ...lines.map((line) => Math.max(0, Math.floor(line.stock / line.quantity))),
    );
}
