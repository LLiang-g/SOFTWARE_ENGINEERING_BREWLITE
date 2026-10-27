import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_FIELDS = { id: true, email: true, loyaltyPoints: true } as const;

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    findById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            select: PUBLIC_FIELDS,
        });
    }

    create(email: string, passwordHash: string) {
        return this.prisma.user.create({
            data: { email, passwordHash },
            select: PUBLIC_FIELDS,
        });
    }
}