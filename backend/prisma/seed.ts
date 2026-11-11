import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const products = [
        { id: 1, name: 'Cà phê sữa', price: 35000, imageUrl: '/images/ca-phe-sua.jpg' },
        { id: 2, name: 'Americano', price: 40000, imageUrl: '/images/americano.jpg' },
        { id: 3, name: 'Cappuccino', price: 45000, imageUrl: '/images/cappuccino.jpg' },
        { id: 4, name: 'Trà đào', price: 39000, imageUrl: '/images/tra-dao.jpg' },
    ];

    for (const p of products) {
        await prisma.product.upsert({
            where: { id: p.id },
            update: p,
            create: p,
        });
    }

    // Nguyên liệu và công thức. Số ly mỗi món còn lại được tính từ kho nguyên liệu, không lưu riêng.
    // Chạy lại seed sẽ đặt kho nguyên liệu về mức ban đầu.
    const ingredients = [
        { name: 'Cà phê rang xay', unit: 'g', stock: 2800 },
        { name: 'Sữa đặc', unit: 'ml', stock: 1500 },
        { name: 'Sữa tươi', unit: 'ml', stock: 7500 },
        { name: 'Trà đen', unit: 'g', stock: 500 },
        { name: 'Syrup đào', unit: 'ml', stock: 1500 },
        { name: 'Đào ngâm', unit: 'miếng', stock: 100 },
        { name: 'Ly nhựa', unit: 'cái', stock: 200 },
        { name: 'Trân châu', unit: 'g', stock: 2500 },
        { name: 'Kem sữa', unit: 'ml', stock: 1500 },
    ];
    const ingredientId = new Map<string, number>();
    for (const i of ingredients) {
        const row = await prisma.ingredient.upsert({
            where: { name: i.name },
            update: { unit: i.unit, stock: i.stock },
            create: i,
        });
        ingredientId.set(i.name, row.id);
    }

    // productId -> [tên nguyên liệu, lượng dùng cho một ly ở size S, có nhân theo size không].
    // Lượng dùng nhân theo hệ số size (SIZE_FACTOR_PERCENT), trừ nguyên liệu như ly nhựa.
    const recipes: Record<number, [string, number, boolean?][]> = {
        1: [['Cà phê rang xay', 20], ['Sữa đặc', 30], ['Ly nhựa', 1, false]],
        2: [['Cà phê rang xay', 18], ['Ly nhựa', 1, false]],
        3: [['Cà phê rang xay', 18], ['Sữa tươi', 150], ['Ly nhựa', 1, false]],
        4: [['Trà đen', 10], ['Syrup đào', 30], ['Đào ngâm', 2], ['Ly nhựa', 1, false]],
    };
    for (const [productId, lines] of Object.entries(recipes)) {
        for (const [name, quantity, scales] of lines) {
            const scalesWithSize = scales ?? true;
            const key = {
                productId: Number(productId),
                ingredientId: ingredientId.get(name) as number,
            };
            await prisma.recipe.upsert({
                where: { productId_ingredientId: key },
                update: { quantity, scalesWithSize },
                create: { ...key, quantity, scalesWithSize },
            });
        }
    }

    // toppingCode (trong TOPPINGS) -> [tên nguyên liệu, lượng dùng cho một ly]. Không nhân theo size.
    const toppingRecipes: Record<string, [string, number][]> = {
        TRAN_CHAU: [['Trân châu', 50]],
        KEM: [['Kem sữa', 30]],
    };
    for (const [toppingCode, lines] of Object.entries(toppingRecipes)) {
        for (const [name, quantity] of lines) {
            const key = { toppingCode, ingredientId: ingredientId.get(name) as number };
            await prisma.toppingRecipe.upsert({
                where: { toppingCode_ingredientId: key },
                update: { quantity },
                create: { ...key, quantity },
            });
        }
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

    // Tài khoản barista cho quầy. Đổi mật khẩu bằng BARISTA_PASSWORD khi triển khai thật.
    const baristaEmail = (process.env.BARISTA_EMAIL ?? 'barista@brewlite.local').toLowerCase();
    const baristaPassword = process.env.BARISTA_PASSWORD ?? 'barista123';
    await prisma.user.upsert({
        where: { email: baristaEmail },
        update: { role: 'BARISTA' },
        create: {
            email: baristaEmail,
            passwordHash: await hash(baristaPassword, 10),
            role: 'BARISTA',
        },
    });

    console.log(`Seed xong: 4 sản phẩm, ${ingredients.length} nguyên liệu, công thức 4 món và 2 topping, 1 voucher BREW10, tài khoản barista ${baristaEmail}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());