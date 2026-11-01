import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { ValidateVoucherDto } from './dto/validate-voucher.dto';

@Controller('promotions')
export class PromotionsController {
    constructor(private readonly promotions: PromotionsService) {}

    @Post('validate')
    @HttpCode(200)
    async validate(@Body() dto: ValidateVoucherDto) {
        const voucher = await this.promotions.findValid(dto.code);
        return {
            code: voucher.code,
            discountPercent: voucher.discountPercent,
            expiresAt: voucher.expiresAt,
        };
    }
}