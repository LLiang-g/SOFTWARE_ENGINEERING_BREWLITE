import { describe, expect, it } from 'vitest';
import { calcDiscount, calcPoints } from './discount';

describe('calcDiscount', () => {
    it('giảm 10% của 120.000đ là 12.000đ', () => {
        expect(calcDiscount(120000, 10)).toBe(12000);
    });

    it('làm tròn xuống đến đồng', () => {
        expect(calcDiscount(45555, 10)).toBe(4555);
    });

    it('không giảm quá tổng tiền', () => {
        expect(calcDiscount(50000, 150)).toBe(50000);
    });

    it('phần trăm bằng 0 hoặc âm thì không giảm', () => {
        expect(calcDiscount(50000, 0)).toBe(0);
        expect(calcDiscount(50000, -5)).toBe(0);
    });
});

describe('calcPoints', () => {
    it('dưới 10.000đ thì chưa được điểm', () => {
        expect(calcPoints(9999)).toBe(0);
        expect(calcPoints(0)).toBe(0);
    });

    it('mỗi 10.000đ được 1 điểm', () => {
        expect(calcPoints(10000)).toBe(1);
        expect(calcPoints(19999)).toBe(1);
    });

    it('108.000đ được 10 điểm', () => {
        expect(calcPoints(108000)).toBe(10);
    });
});