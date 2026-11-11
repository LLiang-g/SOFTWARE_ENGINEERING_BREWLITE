import { describe, expect, it } from 'vitest';
import { calcServings } from './availability';

describe('calcServings', () => {
    it('món chưa có công thức thì chưa pha được', () => {
        expect(calcServings([])).toBe(0);
    });

    it('một nguyên liệu: lấy phần nguyên của kho chia lượng dùng', () => {
        expect(calcServings([{ quantity: 20, stock: 100 }])).toBe(5);
        expect(calcServings([{ quantity: 20, stock: 119 }])).toBe(5);
    });

    it('nhiều nguyên liệu: nguyên liệu khan hiếm nhất quyết định', () => {
        expect(
            calcServings([
                { quantity: 20, stock: 2000 },
                { quantity: 30, stock: 90 },
                { quantity: 1, stock: 50 },
            ]),
        ).toBe(3);
    });

    it('thiếu một nguyên liệu thì không pha được, kể cả khi các nguyên liệu khác còn nhiều', () => {
        expect(
            calcServings([
                { quantity: 10, stock: 1000 },
                { quantity: 10, stock: 9 },
            ]),
        ).toBe(0);
    });

    it('kho âm không cho ra số ly âm', () => {
        expect(calcServings([{ quantity: 10, stock: -5 }])).toBe(0);
    });
});
