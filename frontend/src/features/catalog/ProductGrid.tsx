import { Product } from "@/lib/types";
import ProductCard from "./ProductCard";

export default function ProductGrid({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect?: (id: number) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-line px-4 py-14 text-center">
        <p className="font-semibold">Menu đang được cập nhật</p>
        <p className="mt-1 text-sm text-muted">
          Chưa có sản phẩm nào, bạn quay lại sau nhé.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelect} />
      ))}
    </div>
  );
}
