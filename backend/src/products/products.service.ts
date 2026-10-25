import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SIZE_EXTRA, TOPPINGS } from '../common/pricing';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.product.findMany({
            select: { id: true, name: true, price: true, imageUrl: true },
            orderBy: { id: 'asc' },
        });
    }

    async findOne(id: number) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            select: { id: true, name: true, price: true, imageUrl: true },
        });
        if (!product) {
            throw new NotFoundException('Không tìm thấy sản phẩm');
        }

        return {
            ...product,
            options: {
                sizes: Object.entries(SIZE_EXTRA).map(([code, extra]) => ({
                    code,
                    extra,
                })),
                toppings: TOPPINGS,
            },
        };
    }
}