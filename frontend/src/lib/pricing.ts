import { ProductOptions, SizeCode } from './types';

export function calcUnitPrice(
    basePrice: number,
    size: SizeCode,
    toppingCodes: string[],
    options: ProductOptions,
): number {
    const sizeExtra = options.sizes.find((s) => s.code === size)?.extra ?? 0;
    const toppingsTotal = toppingCodes.reduce(
        (sum, code) =>
            sum + (options.toppings.find((t) => t.code === code)?.price ?? 0),
        0,
    );
    return basePrice + sizeExtra + toppingsTotal;
}