import { AuthResponse, Product, ProductDetail } from './types';

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/products`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error('Không tải được danh sách sản phẩm');
    }
    return res.json();
}

export async function getProduct(id: number): Promise<ProductDetail | null> {
    const res = await fetch(`${API_URL}/products/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error('Không tải được sản phẩm');
    }
    return res.json();
}

async function readError(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json();
        if (Array.isArray(data.message)) return data.message.join('. ');
        if (typeof data.message === 'string') return data.message;
    } catch {
        // Phản hồi không phải JSON, dùng thông báo mặc định.
    }
    return fallback;
}

async function postAuth(
    path: string,
    email: string,
    password: string,
): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        throw new Error(await readError(res, 'Có lỗi xảy ra, vui lòng thử lại'));
    }
    return res.json();
}

export function login(email: string, password: string) {
    return postAuth('/auth/login', email, password);
}

export function register(email: string, password: string) {
    return postAuth('/auth/register', email, password);
}