import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.product.findMany({
            select: { id: true, name: true, price: true, imageUrl: true },
            orderBy: { id: 'asc' },
        });
    }
}