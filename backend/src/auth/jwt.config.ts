export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('Thiếu JWT_SECRET trong file .env');
    }
    return secret;
}