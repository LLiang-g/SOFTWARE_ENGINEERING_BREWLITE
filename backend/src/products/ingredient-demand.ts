import { ConflictException } from '@nestjs/common';
import type { SizeCode } from '../common/pricing';

// Chính sách mặc định: lượng size S là cơ sở; làm tròn LÊN theo từng ly.
export const SIZE_PERCENT: Record<SizeCode, number> = { S: 100, M: 125, L: 150 };
export type InventoryItem = { productId: number; size: SizeCode; qty: number; toppings?: string[] };
export type IngredientLine = { ingredientId: number; quantity: number; scalesWithSize: boolean };
export type ToppingLine = { toppingCode: string; ingredientId: number; quantity: number };

export function ingredientDemand(
    items: InventoryItem[],
    products: { id: number; name: string; recipes: IngredientLine[] }[],
    toppingRecipes: ToppingLine[],
): Map<number, number> {
    const result = new Map<number, number>();
    const add = (id: number, quantity: number) => {
        const total = (result.get(id) ?? 0) + quantity;
        if (!Number.isSafeInteger(total) || quantity <= 0 || total > 2147483647)
            throw new ConflictException('Định lượng nguyên liệu không hợp lệ hoặc quá lớn');
        result.set(id, total);
    };
    for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product?.recipes.length)
            throw new ConflictException(`${product?.name ?? 'Món'} chưa có công thức nên chưa bán được`);
        if (!SIZE_PERCENT[item.size] || !Number.isInteger(item.qty) || item.qty < 1)
            throw new ConflictException('Lựa chọn món không hợp lệ');
        for (const line of product.recipes) {
            const perCup = line.scalesWithSize
                ? Math.ceil(line.quantity * SIZE_PERCENT[item.size] / 100) : line.quantity;
            add(line.ingredientId, perCup * item.qty);
        }
        for (const code of new Set(item.toppings ?? [])) {
            const recipe = toppingRecipes.filter((line) => line.toppingCode === code);
            if (!recipe.length) throw new ConflictException(`Topping ${code} chưa có công thức, vui lòng bỏ chọn`);
            // Một phần topping trên mỗi ly, không nhân thêm theo size.
            for (const line of recipe) add(line.ingredientId, line.quantity * item.qty);
        }
    }
    return result;
}

export function availableFor(demand: Map<number, number>, stocks: Map<number, number>): number {
    return demand.size ? Math.min(...[...demand].map(([id, qty]) =>
        Math.max(0, Math.floor((stocks.get(id) ?? 0) / qty)))) : 0;
}
