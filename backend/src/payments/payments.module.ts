import { Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockGatewayService } from './mock-gateway.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [PromotionsModule, RealtimeModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MockGatewayService],
})
export class PaymentsModule {}
