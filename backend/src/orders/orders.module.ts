import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StaffOrdersController } from './staff-orders.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ProductsModule, PromotionsModule, RealtimeModule],
  controllers: [OrdersController, StaffOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
