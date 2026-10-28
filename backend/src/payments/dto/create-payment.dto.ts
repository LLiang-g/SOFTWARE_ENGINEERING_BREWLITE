import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreatePaymentDto {
    @IsInt({ message: 'orderId không hợp lệ' })
    @Min(1, { message: 'orderId không hợp lệ' })
    orderId: number;

    @IsEnum(PaymentMethod, {
        message: 'Phương thức phải là WALLET hoặc CARD',
    })
    method: PaymentMethod;

    @IsOptional()
    @IsBoolean()
    simulateFailure?: boolean;
}