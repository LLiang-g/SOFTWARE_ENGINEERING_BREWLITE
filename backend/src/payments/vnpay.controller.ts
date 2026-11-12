import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { VnpayGateway } from './vnpay.gateway';
import { VnpayService } from './vnpay.service';

export class StartVnpayDto {
    @IsInt() @Min(1) @Max(2147483647) orderId: number;
}
export class PaymentNoteDto {
    @IsString() @MinLength(3) @MaxLength(1000) note: string;
}

@Controller(['payments/vnpay', 'api/payments/vnpay'])
export class VnpayController {
    constructor(private readonly service: VnpayService, private readonly gateway: VnpayGateway) {}
    @Get('config') config() { return { enabled: this.gateway.enabled(),
        mockEnabled: !this.gateway.enabled() && process.env.PAYMENT_MOCK_ENABLED === 'true' }; }
    @Get('ipn') ipn(@Query() query: Record<string, unknown>) { return this.service.ipn(query); }
    @Get('return') async returned(@Query() query: Record<string, unknown>, @Res() res: Response) {
        res.redirect(303, await this.service.returnUrl(query));
    }
    @Post('start') @UseGuards(JwtAuthGuard)
    start(@CurrentUser() user: AuthUser, @Body() dto: StartVnpayDto,
        @Headers('idempotency-key') key: string | undefined, @Req() req: Request) {
        const normalized = key?.trim();
        if (!normalized || !/^[A-Za-z0-9_-]{8,100}$/.test(normalized)) throw new BadRequestException('Idempotency-Key không hợp lệ');
        return this.service.start(dto.orderId, user.id, normalized, req.ip || '127.0.0.1');
    }
    @Get('orders/:id') @UseGuards(JwtAuthGuard)
    customer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.service.customer(id, user.id); }
    @Post('attempts/:id/check') @HttpCode(200) @UseGuards(JwtAuthGuard)
    check(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.service.check(id, user.id, false); }
}

@Controller('staff/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BARISTA')
export class StaffPaymentsController {
    constructor(private readonly service: VnpayService) {}
    @Get() list() { return this.service.staffList(); }
    @Post(':id/check') @HttpCode(200)
    check(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.service.check(id, user.id, true); }
    @Post(':id/notes')
    note(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser, @Body() dto: PaymentNoteDto) {
        const note = dto.note.trim();
        if (note.length < 3) throw new BadRequestException('Ghi chú cần ít nhất 3 ký tự');
        return this.service.note(id, user.id, note);
    }
}
