import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateStaffOrderStatusDto } from './dto/update-staff-order-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

// API quầy chỉ dành cho tài khoản barista: thiếu token trả 401, khách thường trả 403.
@Controller('staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BARISTA')
export class StaffOrdersController {
    constructor(private readonly orders: OrdersService) {}

    @Get()
    findAll() {
        return this.orders.findForStaff();
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateStaffOrderStatusDto,
    ) {
        return this.orders.updateStaffStatus(id, dto.status);
    }
}
