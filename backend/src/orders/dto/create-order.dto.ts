import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Size } from '../../generated/prisma/client';

export class OrderItemDto {
    @IsInt({ message: 'productId không hợp lệ' })
    @Min(1, { message: 'productId không hợp lệ' })
    productId: number;

    @IsEnum(Size, { message: 'Size phải là S, M hoặc L' })
    size: Size;

    @IsOptional()
    @IsArray()
    @ArrayUnique({ message: 'Topping bị trùng' })
    @IsString({ each: true })
    toppings?: string[];

    @IsInt({ message: 'Số lượng phải là số nguyên' })
    @Min(1, { message: 'Số lượng tối thiểu là 1' })
    @Max(99, { message: 'Số lượng tối đa là 99' })
    qty: number;
}

export class CreateOrderDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Giỏ hàng đang trống' })
    @ArrayMaxSize(50, { message: 'Đơn có quá nhiều dòng' })
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @IsOptional()
    @IsString({ message: 'Mã giảm giá không hợp lệ' })
    @MaxLength(50, { message: 'Mã giảm giá quá dài' })
    voucherCode?: string;
}