import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly orders: OrdersService) {}

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
        return this.orders.create(user.id, dto);
    }

    @Get('me')
    findMine(@CurrentUser() user: AuthUser) {
        return this.orders.findByUser(user.id);
    }

    @Get(':id')
    findOne(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.orders.findOne(user.id, id);
    }

    @Post(':id/cancel')
    @HttpCode(200)
    cancel(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.orders.cancel(user.id, id);
    }
}