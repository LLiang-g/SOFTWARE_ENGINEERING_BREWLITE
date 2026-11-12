import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentMethod } from '../generated/prisma/client';

export type ChargeResult = {
    success: boolean;
    reference?: string;
    message?: string;
};

@Injectable()
export class MockGatewayService {
    charge(input: {
        amount: number;
        method: PaymentMethod;
        simulateFailure?: boolean;
    }): Promise<ChargeResult> {
        if (input.simulateFailure || input.amount <= 0) {
            return Promise.resolve({
                success: false,
                message: 'Cổng thanh toán từ chối giao dịch (giả lập)',
            });
        }
        return Promise.resolve({
            success: true,
            reference: `MOCK-${input.method}-${randomUUID()}`,
        });
    }
}