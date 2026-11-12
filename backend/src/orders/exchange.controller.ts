import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ExchangeService } from './exchange.service';

class ExchangeDto extends CreateOrderDto {
    @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
class DecisionDto {
    @IsInt() @Min(0) @Max(2147483647) version: number;
    @IsBoolean() approve: boolean;
    @IsString() @MinLength(3) @MaxLength(1000) note: string;
}
class RefundDto {
    @IsInt() @Min(0) @Max(2147483647) version: number;
    @IsIn(['PROCESSING', 'COMPLETED']) status: 'PROCESSING' | 'COMPLETED';
    @IsString() @MaxLength(200) reference: string;
    @IsString() @MinLength(3) @MaxLength(1000) note: string;
}
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
    constructor(private readonly service: ExchangeService) {}
    @Get(':id/exchanges') list(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
        return this.service.list(user.id, id);
    }
    @Post(':id/exchanges') request(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser,
        @Headers('idempotency-key') key: string | undefined, @Body() dto: ExchangeDto) {
        if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new BadRequestException('Idempotency-Key không hợp lệ');
        if (!dto.reason.trim() || dto.voucherCode) throw new BadRequestException('Cần lý do đổi; không áp dụng voucher mới');
        return this.service.request(id, user.id, key, dto.items, dto.reason.trim());
    }
    @Get('payment-refunds/mine') refunds(@CurrentUser() user: AuthUser) { return this.service.refunds(user.id); }
}
@Controller('staff/exchanges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BARISTA')
export class StaffExchangeController {
    constructor(private readonly service: ExchangeService) {}
    @Get() list() { return this.service.list(); }
    @Post(':id/decision') decide(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser, @Body() dto: DecisionDto) {
        return this.service.decide(id, user.id, dto.version, dto.approve, dto.note);
    }
}
@Controller('staff/payment-refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BARISTA')
export class StaffRefundController {
    constructor(private readonly service: ExchangeService) {}
    @Get() list() { return this.service.refunds(); }
    @Post(':id/status') update(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser, @Body() dto: RefundDto) {
        return this.service.updateRefund(id, user.id, dto.version, dto.status, dto.reference, dto.note);
    }
}
