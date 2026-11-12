import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<PrismaService, 'voucher'>;

@Injectable()
export class PromotionsService {
    constructor(private readonly prisma: PrismaService) {}

    async findValid(code: string, db: Db = this.prisma, now = new Date()) {
        const normalized = code.trim().toUpperCase();
        const voucher = await db.voucher.findUnique({
            where: { code: normalized },
        });
        if (!voucher) {
            throw new BadRequestException('Mã giảm giá không tồn tại');
        }
        if (!voucher.active) {
            throw new BadRequestException('Mã giảm giá đã ngừng áp dụng');
        }
        if (voucher.expiresAt <= now) {
            throw new BadRequestException('Mã giảm giá đã hết hạn');
        }
        return voucher;
    }
}