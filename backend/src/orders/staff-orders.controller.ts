import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateStaffOrderStatusDto } from './dto/update-staff-order-status.dto';

// API quầy của bản demo chưa có đăng nhập nhân viên, theo phạm vi mở rộng.
@Controller('staff/orders')
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
