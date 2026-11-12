import { Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockGatewayService } from './mock-gateway.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { VnpayController, StaffPaymentsController } from './vnpay.controller';
import { VnpayGateway } from './vnpay.gateway';
import { VnpayService } from './vnpay.service';

@Module({
  imports: [PromotionsModule, RealtimeModule],
  controllers: [PaymentsController, VnpayController, StaffPaymentsController],
  providers: [PaymentsService, MockGatewayService, VnpayGateway, VnpayService],
})
export class PaymentsModule {}
