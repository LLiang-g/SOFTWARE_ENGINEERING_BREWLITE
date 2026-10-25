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