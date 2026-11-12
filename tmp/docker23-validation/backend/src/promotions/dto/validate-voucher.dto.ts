import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateVoucherDto {
    @IsString({ message: 'Mã giảm giá không hợp lệ' })
    @IsNotEmpty({ message: 'Vui lòng nhập mã giảm giá' })
    @MaxLength(50, { message: 'Mã giảm giá quá dài' })
    code: string;
}