import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { InventoryService } from './inventory/inventory.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, InventoryService]
})
export class ProductsModule {}
