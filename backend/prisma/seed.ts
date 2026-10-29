import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const products = [
        { id: 1, name: 'Cà phê sữa', price: 35000, imageUrl: '/images/ca-phe-sua.jpg', stock: 50 },
        { id: 2, name: 'Americano', price: 40000, imageUrl: '/images/americano.jpg', stock: 50 },
        { id: 3, name: 'Cappuccino', price: 45000, imageUrl: '/images/cappuccino.jpg', stock: 50 },
        { id: 4, name: 'Trà đào', price: 39000, imageUrl: '/images/tra-dao.jpg', stock: 50 },
    ];

    for (const p of products) {
        await prisma.product.upsert({
            where: { id: p.id },
            update: p,
            create: p,
        });
    }

    // Đưa bộ đếm id về sau id lớn nhất, vì seed chèn id gõ tay.
    await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "Product"))`;

    await prisma.voucher.upsert({
        where: { code: 'BREW10' },
        update: {},
        create: {
            code: 'BREW10',
            discountPercent: 10,
            expiresAt: new Date('2030-12-31'),
        },
    });

    console.log('Seed xong: 4 sản phẩm, 1 voucher BREW10');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());