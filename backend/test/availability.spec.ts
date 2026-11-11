import { describe, expect, it } from 'vitest';
import { calcServings, calcServingsBySize, usagePerServing } from './availability';

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

    it('theo size: size lớn dùng nhiều nguyên liệu hơn nên ra ít ly hơn', () => {
        const lines = [{ quantity: 100, stock: 1000 }];
        expect(calcServings(lines, 'S')).toBe(10);
        expect(calcServings(lines, 'M')).toBe(8);
        expect(calcServings(lines, 'L')).toBe(6);
    });

    it('nguyên liệu không nhân theo size (ly nhựa) giữ nguyên ở mọi size', () => {
        const lines = [{ quantity: 1, stock: 7, scalesWithSize: false }];
        expect(calcServingsBySize(lines)).toEqual({ S: 7, M: 7, L: 7 });
    });
});

describe('usagePerServing', () => {
    it('nhân hệ số size rồi làm tròn lên', () => {
        expect(usagePerServing(20, true, 'S')).toBe(20);
        expect(usagePerServing(18, true, 'M')).toBe(23);
        expect(usagePerServing(18, true, 'L')).toBe(27);
    });

    it('không nhân khi scalesWithSize là false', () => {
        expect(usagePerServing(1, false, 'L')).toBe(1);
    });
});

describe('calcServingsBySize', () => {
    it('size S luôn là số ly lớn nhất', () => {
        const by = calcServingsBySize([
            { quantity: 18, stock: 500 },
            { quantity: 1, stock: 40, scalesWithSize: false },
        ]);
        expect(by.S).toBeGreaterThanOrEqual(by.M);
        expect(by.M).toBeGreaterThanOrEqual(by.L);
    });
});
