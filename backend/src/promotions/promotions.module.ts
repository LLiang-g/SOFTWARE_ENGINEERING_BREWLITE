import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { LoyaltyService } from './loyalty.service';

@Module({
  controllers: [PromotionsController],
  providers: [PromotionsService, LoyaltyService],
  exports: [PromotionsService, LoyaltyService],
})
export class PromotionsModule {}