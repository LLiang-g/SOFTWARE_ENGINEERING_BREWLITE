import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { LoyaltyService } from './loyalty/loyalty.service';

@Module({
  providers: [PromotionsService, LoyaltyService]
})
export class PromotionsModule {}
