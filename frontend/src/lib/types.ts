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

export type OrderStatus =
    | 'PENDING'
    | 'PAID'
    | 'PAYMENT_FAILED'
    | 'PREPARING'
    | 'READY'
    | 'COMPLETED'
    | 'CANCELLED';

export type PaymentMethod = 'WALLET' | 'CARD';

export type OrderItemView = {
    id: number;
    productId: number;
    name: string;
    size: SizeCode;
    toppings: string[];
    toppingNames: string[];
    qty: number;
    lineTotal: number;
};

export type OrderView = {
    id: number;
    status: OrderStatus;
    total: number;
    discount: number;
    createdAt: string;
    items: OrderItemView[];
    voucherCode: string | null;
    pointsEarned: number;
};

export type PayResult = {
    orderId: number;
    status: 'PAID' | 'PAYMENT_FAILED';
    paymentId?: number;
    message?: string;
};

export type VoucherInfo = {
    code: string;
    discountPercent: number;
    expiresAt: string;
};