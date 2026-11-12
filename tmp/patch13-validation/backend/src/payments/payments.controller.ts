import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) {}

    @Post()
    pay(
        @CurrentUser() user: AuthUser,
        @Headers('idempotency-key') idempotencyKey: string | undefined,
        @Body() dto: CreatePaymentDto,
    ) {
        const key = idempotencyKey?.trim();
        if (!key || key.length < 8 || key.length > 100) {
            throw new BadRequestException(
                'Thiếu hoặc sai header Idempotency-Key (8 đến 100 ký tự)',
            );
        }
        return this.payments.pay(user.id, key, dto);
    }
}