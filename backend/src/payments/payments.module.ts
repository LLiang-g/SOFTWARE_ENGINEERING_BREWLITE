import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockGatewayService } from './mock-gateway.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockGatewayService],
})
export class PaymentsModule {}