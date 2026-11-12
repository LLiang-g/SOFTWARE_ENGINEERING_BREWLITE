"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductDetail as ProductDetailType, SizeCode } from "@/lib/types";
import { calcUnitPrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import {
  IconCheck,
  IconChevronLeft,
  IconMinus,
  IconPlus,
} from "@/components/icons";
import { DRINK_TINT, drinkKindFor } from "./DrinkArt";
import ProductImage from "./ProductImage";
import { useCartStore } from "@/features/cart/cart.store";

export default function ProductDetail({
  product,
  onAdd,
  menuHref = "/",
  cartHref = "/cart",
  onBack,
  onCart,
}: {
  product: ProductDetailType;
  onAdd?: (
    item: Omit<import("@/features/cart/cart.store").CartItem, "key" | "qty">,
    qty: number,
  ) => void;
  menuHref?: string;
  cartHref?: string;
  onBack?: () => void;
  onCart?: () => void;
}) {
  const [size, setSize] = useState<SizeCode>("S");
  const [toppings, setToppings] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const unitPrice = calcUnitPrice(
    product.price,
    size,
    toppings,
    product.options,
  );

  const availableForSelection = (selected: string[]) => product.availability?.find((row) =>
    row.size === size && [...row.toppings].sort().join('|') === [...selected].sort().join('|'))?.available ?? (product.availability ? 0 : 99);
  const available = availableForSelection(toppings);

  function toggleTopping(code: string) {
    setToppings((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function handleAddToCart() {
    if (qty > available) return;
    (onAdd ?? addItem)(
      {
        productId: product.id,
        name: product.name,
        size,
        toppings,
        toppingNames: product.options.toppings
          .filter((t) => toppings.includes(t.code))
          .map((t) => t.name),
        unitPrice,
      },
      qty,
    );
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2500);
  }

  const tint = DRINK_TINT[drinkKindFor(product.name)];

  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-10">
      <div className="relative md:sticky md:top-24">
        <div
          className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-b-[28px] md:aspect-square md:rounded-[28px]"
          style={{ backgroundColor: tint }}
        >
          <ProductImage src={product.imageUrl} alt={product.name} />
        </div>
        <Link
          href={menuHref}
          onClick={
            onBack
              ? (event) => {
                  event.preventDefault();
                  onBack();
                }
              : undefined
          }
          aria-label="Quay lại menu"
          className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-paper/90 shadow-sm md:hidden"
        >
          <IconChevronLeft className="h-6 w-6" />
        </Link>
      </div>

      <div className="px-4 pt-6 md:px-0 md:pt-0">
        <Link
          href={menuHref}
          onClick={
            onBack
              ? (event) => {
                  event.preventDefault();
                  onBack();
                }
              : undefined
          }
          className="-ml-2 mb-3 hidden min-h-11 items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-muted hover:text-espresso md:inline-flex"
        >
          <IconChevronLeft className="h-5 w-5" />
          Quay lại menu
        </Link>

        <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight md:text-4xl">
          {product.name}
        </h1>
        <p className="mt-1 text-muted tabular-nums">
          Giá gốc {formatPrice(product.price)}
        </p>

        <section className="mt-7" aria-labelledby="size-title">
          <h2 id="size-title" className="font-semibold">
            Chọn size
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="size-title"
            className="mt-3 grid grid-cols-3 gap-2.5"
          >
            {product.options.sizes.map((s) => {
              const selected = size === s.code;
              return (
                <button
                  key={s.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSize(s.code)}
                  className={`flex min-h-[68px] flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 transition ${
                    selected
                      ? "border-espresso bg-espresso text-white"
                      : "border-line bg-paper hover:border-roast"
                  }`}
                >
                  <span className="font-display text-xl leading-none font-bold">
                    {s.code}
                  </span>
                  <span
                    className={`mt-1 text-xs tabular-nums ${selected ? "text-white/80" : "text-muted"}`}
                  >
                    {s.extra > 0 ? `+${formatPrice(s.extra)}` : "Giá gốc"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {product.options.toppings.length > 0 && (
          <section className="mt-7" aria-labelledby="topping-title">
            <div className="flex items-baseline justify-between">
              <h2 id="topping-title" className="font-semibold">
                Thêm topping
              </h2>
              <span className="text-sm text-muted">Không bắt buộc</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {product.options.toppings.map((t) => (
                <label
                  key={t.code}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-paper px-4 transition has-[:checked]:border-espresso"
                >
                  <input
                    type="checkbox"
                    checked={toppings.includes(t.code)}
                    disabled={!toppings.includes(t.code) && availableForSelection([...toppings, t.code]) === 0}
                    onChange={() => toggleTopping(t.code)}
                    className="peer sr-only"
                  />
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line bg-paper text-transparent peer-checked:border-espresso peer-checked:bg-espresso peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-espresso">
                    <IconCheck className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{t.name}</span>
                  <span className="text-sm text-muted tabular-nums">
                    +{formatPrice(t.price)}
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        <p id="selection-stock" role="status" className="mt-5 text-sm text-muted">{available === 0 ? 'Lựa chọn này đã hết nguyên liệu. Hãy đổi size hoặc bỏ topping.' : `Hiện còn tối đa ${available} ly theo lựa chọn. Kho được kiểm tra lại khi đặt đơn.`}</p>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_24px_-14px_rgba(43,26,18,0.3)] md:static md:z-auto md:mt-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {added && (
            <p
              role="status"
              className="absolute right-4 bottom-full left-4 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-pandan px-4 py-3 text-sm font-medium text-white shadow-lg md:static md:mb-3"
            >
              <span className="flex items-center gap-2">
                <IconCheck className="h-5 w-5" />
                Đã thêm vào giỏ
              </span>
              <Link
                href={cartHref}
                onClick={
                  onCart
                    ? (event) => {
                        event.preventDefault();
                        onCart();
                      }
                    : undefined
                }
                className="font-semibold underline underline-offset-2"
              >
                Xem giỏ hàng
              </Link>
            </p>
          )}
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex h-12 items-center rounded-full border-2 border-line bg-paper">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Giảm số lượng"
                className="flex h-full w-11 items-center justify-center rounded-full disabled:opacity-35"
              >
                <IconMinus className="h-5 w-5" />
              </button>
              <span
                className="min-w-6 text-center font-semibold tabular-nums"
                aria-live="polite"
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                disabled={qty >= Math.min(99, available)}
                aria-label="Tăng số lượng"
                className="flex h-full w-11 items-center justify-center rounded-full disabled:opacity-35"
              >
                <IconPlus className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={qty > available}
              aria-describedby="selection-stock"
              className="flex h-12 flex-1 items-center justify-between rounded-full bg-espresso px-5 font-semibold text-white transition hover:bg-roast active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Thêm vào giỏ</span>
              <span className="tabular-nums">
                {formatPrice(unitPrice * qty)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
