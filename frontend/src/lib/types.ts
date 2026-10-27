export type Product = {
    id: number;
    name: string;
    price: number;
    imageUrl: string;
};

export type SizeCode = 'S' | 'M' | 'L';
export type SizeOption = { code: SizeCode; extra: number };
export type ToppingOption = { code: string; name: string; price: number };
export type ProductOptions = {
    sizes: SizeOption[];
    toppings: ToppingOption[];
};

export type ProductDetail = Product & { options: ProductOptions };

export type AuthUser = {
    id: number;
    email: string;
    loyaltyPoints: number;
};

export type AuthResponse = {
    accessToken: string;
    user: AuthUser;
};