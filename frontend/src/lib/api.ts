import { Product } from './types';

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/products`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error('Không tải được danh sách sản phẩm');
    }
    return res.json();
}