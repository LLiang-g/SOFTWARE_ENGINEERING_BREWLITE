import { IsIn } from 'class-validator';

export class UpdateStaffOrderStatusDto {
    @IsIn(['PREPARING', 'READY', 'COMPLETED'], {
        message: 'Trạng thái phải là PREPARING, READY hoặc COMPLETED',
    })
    status: 'PREPARING' | 'READY' | 'COMPLETED';
}
