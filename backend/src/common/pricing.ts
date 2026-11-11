import { BadRequestException } from '@nestjs/common';

export type SizeCode = 'S' | 'M' | 'L';

export const SIZE_EXTRA: Record<SizeCode, number> = {
    S: 0,
    M: 5000,
    L: 10000,
};

// Hệ số nguyên liệu theo size, tính bằng phần trăm so với size S (nhân xong làm tròn lên).
export const SIZE_FACTOR_PERCENT: Record<SizeCode, number> = {
    S: 100,
    M: 125,
    L: 150,
};

export const TOPPINGS = [
    { code: 'TRAN_CHAU', name: 'Trân châu', price: 5000 },
    { code: 'KEM', name: 'Kem', price: 5000 },
];

export function calcUnitPrice(
    basePrice: number,
    size: SizeCode,
    toppingCodes: string[],
): number {
    const sizeExtra = SIZE_EXTRA[size];
    if (sizeExtra === undefined) {
        throw new BadRequestException(`Size không hợp lệ: ${size}`);
    }

    let toppingsTotal = 0;
    for (const code of toppingCodes) {
        const topping = TOPPINGS.find((t) => t.code === code);
        if (!topping) {
            throw new BadRequestException(`Topping không hợp lệ: ${code}`);
        }
        toppingsTotal += topping.price;
    }

    return basePrice + sizeExtra + toppingsTotal;
}