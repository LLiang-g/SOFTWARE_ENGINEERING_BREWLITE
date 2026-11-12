import { describe, expect, it } from 'vitest';
import { ingredientDemand, availableFor } from '../src/products/ingredient-demand';

const products = [{ id: 1, name: 'Coffee', recipes: [
    { ingredientId: 1, quantity: 18, scalesWithSize: true },
    { ingredientId: 2, quantity: 1, scalesWithSize: false },
] }];
describe('Định lượng theo lựa chọn', () => {
    it.each([['S',18], ['M',23], ['L',27]] as const)('size %s trừ %i g và một ly', (size, expected) => {
        const demand = ingredientDemand([{ productId: 1, size, qty: 1 }], products, []);
        expect([...demand]).toEqual([[1, expected], [2, 1]]);
    });
    it('gộp nguyên liệu món và topping dùng chung; làm tròn từng ly trước khi nhân số lượng', () => {
        const demand = ingredientDemand([{ productId: 1, size: 'M', qty: 2, toppings: ['KEM'] }], products,
            [{ toppingCode: 'KEM', ingredientId: 1, quantity: 5 }]);
        expect(demand.get(1)).toBe(56);
        expect(demand.get(2)).toBe(2);
        expect(availableFor(demand, new Map([[1,55],[2,10]]))).toBe(0);
    });
    it('thiếu công thức topping phải chặn bán', () => {
        expect(() => ingredientDemand([{ productId: 1, size: 'S', qty: 1, toppings: ['KEM'] }], products, [])).toThrow('chưa có công thức');
    });
});
