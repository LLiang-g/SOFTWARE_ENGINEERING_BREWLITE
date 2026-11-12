"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "../auth/auth.store";
import { useHydrated } from "../cart/useHydrated";
import type { CartItem } from "../cart/cart.store";
import ProductGrid from "../catalog/ProductGrid";
import ProductDetail from "../catalog/ProductDetail";
import { getProduct, getProducts } from "@/lib/api";
import { getOrder, type NewOrderItem } from "@/lib/orders-api";
import type { OrderView, Product, ProductDetail as Detail } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { paymentFetch } from "../payments/vnpay-api";
import {
  exchangeLabels,
  getExchanges,
  getQuote,
  type Exchange,
  type Quote,
} from "./exchange-api";

type Intent = { key: string; body: string };
type Draft = { items: CartItem[]; reason: string; intent: Intent | null };
const empty: Draft = { items: [], reason: "", intent: null };
function payload(items: CartItem[]): NewOrderItem[] {
  return items.map(({ productId, size, toppings, qty }) => ({
    productId,
    size,
    toppings,
    qty,
  }));
}
export default function ExchangeWorkspace({ orderId }: { orderId: number }) {
  const hydrated = useHydrated(),
    token = useAuthStore((s) => s.token),
    userId = useAuthStore((s) => s.user?.id);
  const [order, setOrder] = useState<OrderView | null>(null),
    [rows, setRows] = useState<Exchange[]>([]),
    [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft>(empty),
    [ready, setReady] = useState(false),
    [step, setStep] = useState<"menu" | "cart">("menu");
  const [selected, setSelected] = useState<Detail | null>(null),
    [search, setSearch] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState(""),
    [quoteError, setQuoteError] = useState(""),
    [busy, setBusy] = useState(false),
    [quoting, setQuoting] = useState(false);
  const [ack, setAck] = useState(false),
    [refreshKey, setRefreshKey] = useState(0);
  const lock = useRef(false),
    productRequest = useRef<AbortController | null>(null);
  const storage = `brewlite-exchange-v2:${userId}:${orderId}`;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [o, r] = await Promise.all([
        getOrder(orderId, signal),
        getExchanges(orderId, signal),
      ]);
      if (signal?.aborted || useAuthStore.getState().token !== token) return;
      setOrder(o);
      setRows(r);
      return r;
    },
    [orderId, token],
  );
  const awaiting = rows.some((row) => row.status === "REQUESTED");
  useEffect(() => {
    if (!awaiting) return;
    const c = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh(c.signal).catch(() => {});
    }, 15000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [awaiting, refresh]);
  useEffect(() => {
    if (!hydrated || !token || !userId) return;
    const c = new AbortController();
    void Promise.all([
      getOrder(orderId, c.signal),
      getExchanges(orderId, c.signal),
      getProducts(),
    ])
      .then(([o, r, menu]) => {
        if (c.signal.aborted || useAuthStore.getState().token !== token) return;
        let initial: Draft = empty;
        try {
          const saved = sessionStorage.getItem(storage);
          if (saved) {
            const d = JSON.parse(saved) as Draft;
            if (
              Array.isArray(d.items) &&
              d.items.length <= 50 &&
              typeof d.reason === "string"
            )
              initial = d;
          }
        } catch {
          setError("Không khôi phục được bản nháp. Bạn có thể chọn lại món.");
        }
        setOrder(o);
        setRows(r);
        setProducts(menu);
        setDraft(initial);
        setReady(true);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Không mở được đơn");
      });
    return () => {
      c.abort();
      productRequest.current?.abort();
    };
  }, [hydrated, token, userId, orderId, storage]);
  useEffect(() => {
    if (ready && token && useAuthStore.getState().token === token) {
      try {
        sessionStorage.setItem(storage, JSON.stringify(draft));
      } catch {
        /* Submission checks storage before sending. */
      }
    }
  }, [draft, ready, storage, token]);
  useEffect(() => {
    if (!ready || !draft.items.length) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      setQuoting(true);
      setQuoteError("");
      setQuote(null);
      void getQuote(orderId, payload(draft.items), c.signal)
        .then((q) => {
          if (!c.signal.aborted && useAuthStore.getState().token === token)
            setQuote(q);
        })
        .catch((e) => {
          if (!c.signal.aborted)
            setQuoteError(
              e instanceof Error ? e.message : "Chưa lấy được báo giá",
            );
        })
        .finally(() => {
          if (!c.signal.aborted) setQuoting(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [draft.items, ready, orderId, token, refreshKey]);
  function changeItems(fn: (items: CartItem[]) => CartItem[]) {
    setQuote(null);
    setAck(false);
    setDraft((d) => ({ ...d, items: fn(d.items) }));
  }
  async function choose(id: number) {
    productRequest.current?.abort();
    const c = new AbortController();
    productRequest.current = c;
    setError("");
    setBusy(true);
    try {
      const p = await getProduct(id);
      if (!c.signal.aborted && useAuthStore.getState().token === token) {
        if (!p) throw new Error("Món đã ngừng bán");
        setSelected(p);
      }
    } catch (e) {
      if (!c.signal.aborted) setError(String(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  function add(item: Omit<CartItem, "key" | "qty">, qty: number) {
    if (draft.intent || lock.current) return;
    const key = `${item.productId}|${item.size}|${[...item.toppings].sort().join(",")}`;
    changeItems((items) => {
      const old = items.find((i) => i.key === key);
      if (old)
        return items.map((i) =>
          i.key === key ? { ...i, qty: Math.min(99, i.qty + qty) } : i,
        );
      return items.length < 50 ? [...items, { ...item, key, qty }] : items;
    });
  }
  async function submit() {
    if (
      lock.current ||
      (!draft.intent &&
        (!quote?.allowed || !ack || draft.reason.trim().length < 3))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const intent = draft.intent ?? {
        key: crypto.randomUUID(),
        body: JSON.stringify({
          items: payload(draft.items),
          reason: draft.reason.trim(),
          expectedQuote: quote!.fingerprint,
        }),
      };
      const saved = { ...draft, intent };
      sessionStorage.setItem(storage, JSON.stringify(saved));
      setDraft(saved);
      await paymentFetch(`/orders/${orderId}/exchanges`, {
        method: "POST",
        headers: { "Idempotency-Key": intent.key },
        body: intent.body,
      });
      if (useAuthStore.getState().token !== token) return;
      sessionStorage.removeItem(storage);
      setDraft(empty);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa rõ kết quả gửi. Kiểm tra yêu cầu hoặc gửi lại cùng nội dung.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function checkResult() {
    setError("");
    try {
      const result = await refresh();
      if (!result) return;
      // No pending record means a definitive validation rejection can be corrected.
      if (!result.some((r) => r.status === "REQUESTED") && draft.intent) {
        setDraft((d) => ({ ...d, intent: null }));
        setQuote(null);
        setAck(false);
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      setError(String(e));
    }
  }
  if (!hydrated)
    return (
      <p role="status" className="py-12">
        Đang tải…
      </p>
    );
  if (!token)
    return (
      <div className="py-12">
        <h1 className="text-xl font-bold">Đăng nhập để xem đơn</h1>
        <Link
          href={`/login?next=/orders/${orderId}/exchange`}
          className="mt-4 inline-block underline"
        >
          Đăng nhập
        </Link>
      </div>
    );
  if (!ready || !order)
    return (
      <div className="py-12">
        <p role={error ? "alert" : "status"}>
          {error || "Đang mở đơn và menu…"}
        </p>
        <Link
          href={`/orders/${orderId}`}
          className="mt-4 inline-block underline"
        >
          Quay lại đơn
        </Link>
      </div>
    );
  const pending = rows.find((r) => r.status === "REQUESTED"),
    approved = rows.find((r) => r.status === "APPROVED");
  const blocked = Boolean(pending || approved || order.status !== "PAID");
  return (
    <div className="space-y-6">
      <Link
        href={`/orders/${orderId}`}
        className="inline-flex min-h-11 items-center text-sm text-muted hover:text-espresso"
      >
        ← Quay lại đơn #{orderId}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Hỗ trợ đơn hàng
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            Chọn món thay thế
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Yêu cầu chỉ được thực hiện khi quầy duyệt và đơn chưa pha. Đơn ban
            đầu vẫn được giữ trong lúc bạn chọn món.
          </p>
        </div>
        {!blocked && (
          <button
            onClick={() => {
              setStep(step === "menu" ? "cart" : "menu");
              setSelected(null);
            }}
            className="min-h-11 rounded-full border border-line bg-paper px-5 text-sm font-semibold"
          >
            {step === "menu"
              ? `Giỏ đổi món (${draft.items.reduce((n, i) => n + i.qty, 0)})`
              : "← Chọn thêm món"}
          </button>
        )}
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-chili-soft p-4 text-sm text-chili"
        >
          {error}
          <button onClick={() => void checkResult()} className="ml-3 underline">
            Kiểm tra yêu cầu và cập nhật giá
          </button>
        </div>
      )}
      {blocked ? (
        <section className="rounded-3xl border border-line bg-paper p-6">
          <h2 className="font-display text-xl font-bold">
            {pending
              ? "Yêu cầu đã gửi đến quầy"
              : approved
                ? "Yêu cầu đã được duyệt"
                : "Đơn không còn đủ điều kiện đổi"}
          </h2>
          <p className="mt-2 text-muted">
            {pending
              ? "Quầy sẽ kiểm tra món và nguyên liệu trước khi duyệt. Bạn chưa cần thanh toán thêm."
              : approved?.decisionNote ||
                "Đơn có thể đã bắt đầu pha. Vui lòng liên hệ quầy nếu cần hỗ trợ."}
          </p>
          {approved?.replacementOrderId && (
            <Link
              href={`/orders/${approved.replacementOrderId}`}
              className="mt-5 inline-flex min-h-12 items-center rounded-full bg-espresso px-5 font-semibold text-white"
            >
              Xem đơn thay thế / thanh toán chênh lệch
            </Link>
          )}
          {rows.map((row) => (
            <p key={row.id} className="mt-3 text-sm">
              {exchangeLabels[row.status]} — {row.reason}
            </p>
          ))}
        </section>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-crema-soft p-4 text-sm">
            <strong>
              Tiền đã trả cho đơn #{orderId}: {formatPrice(order.total)}
            </strong>
            <p className="mt-1">
              Chọn lại toàn bộ món muốn nhận. Tiền cũ sẽ chuyển sang đơn thay
              thế khi quầy duyệt. Giỏ mua mới của bạn không thay đổi.
            </p>
          </div>
          {step === "menu" ? (
            selected ? (
              <ProductDetail
                product={selected}
                onAdd={add}
                menuHref={`/orders/${orderId}/exchange`}
                cartHref={`/orders/${orderId}/exchange`}
                onBack={() => setSelected(null)}
                onCart={() => {
                  setSelected(null);
                  setStep("cart");
                }}
              />
            ) : (
              <>
                <label className="block max-w-md text-sm font-medium">
                  Tìm món
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tên món bạn muốn chọn"
                    className="mt-2 h-12 w-full rounded-2xl border border-line bg-paper px-4"
                  />
                </label>
                {busy && (
                  <p role="status" className="text-sm text-muted">
                    Đang mở món…
                  </p>
                )}
                {draft.intent ? (
                  <p className="rounded-2xl border p-4">
                    Yêu cầu trước chưa rõ kết quả. Mở giỏ đổi món để kiểm tra
                    hoặc gửi lại cùng yêu cầu.
                  </p>
                ) : (
                  <ProductGrid
                    products={products.filter((p) =>
                      p.name
                        .toLocaleLowerCase("vi")
                        .includes(search.toLocaleLowerCase("vi")),
                    )}
                    onSelect={(id) => void choose(id)}
                  />
                )}
              </>
            )
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
              <section className="space-y-3" aria-label="Giỏ đổi món">
                <h2 className="font-display text-xl font-bold">Món thay thế</h2>
                {!draft.items.length && (
                  <div className="rounded-3xl border border-dashed border-line p-10 text-center">
                    <p>Giỏ đổi món chưa có món nào.</p>
                    <button
                      onClick={() => setStep("menu")}
                      className="mt-4 underline"
                    >
                      Mở menu chọn món
                    </button>
                  </div>
                )}
                {draft.items.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-2xl border border-line bg-paper p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="mt-1 text-sm text-muted">
                          Size {item.size}
                          {item.toppingNames.length
                            ? ` · ${item.toppingNames.join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <button
                        disabled={busy || !!draft.intent}
                        onClick={() =>
                          changeItems((items) =>
                            items.filter((i) => i.key !== item.key),
                          )
                        }
                        className="min-h-11 px-2 text-sm text-muted underline"
                      >
                        Xóa
                      </button>
                    </div>
                    <label className="mt-3 flex items-center gap-3 text-sm">
                      Số lượng
                      <input
                        aria-label={`Số lượng ${item.name}`}
                        type="number"
                        min={1}
                        max={99}
                        value={item.qty}
                        disabled={busy || !!draft.intent}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          if (Number.isInteger(qty) && qty >= 1 && qty <= 99)
                            changeItems((items) =>
                              items.map((i) =>
                                i.key === item.key ? { ...i, qty } : i,
                              ),
                            );
                        }}
                        className="h-11 w-20 rounded-xl border border-line px-3"
                      />
                    </label>
                  </article>
                ))}
                <label className="block rounded-2xl border border-line bg-paper p-4">
                  <span className="font-semibold">Lý do cần đổi món</span>
                  <textarea
                    value={draft.reason}
                    disabled={busy || !!draft.intent}
                    maxLength={1000}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, reason: e.target.value }))
                    }
                    placeholder="Mô tả để quầy hỗ trợ bạn"
                    className="mt-3 min-h-28 w-full rounded-xl border border-line p-3 text-sm"
                  />
                </label>
              </section>
              <aside className="rounded-3xl border border-line bg-paper p-5 lg:sticky lg:top-24">
                <h2 className="font-display text-xl font-bold">
                  Xác nhận yêu cầu
                </h2>
                {quoting ? (
                  <p role="status" className="mt-4 text-sm">
                    Đang kiểm tra giá và nguyên liệu…
                  </p>
                ) : quote ? (
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt>Tổng món thay thế</dt>
                      <dd>{formatPrice(quote.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Tiền chuyển từ đơn cũ</dt>
                      <dd>−{formatPrice(quote.credit)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-4 text-base font-bold">
                      <dt>Cần trả thêm sau duyệt</dt>
                      <dd>{formatPrice(Math.max(0, quote.difference))}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-muted">
                    Chọn món để nhận báo giá từ cửa hàng.
                  </p>
                )}
                {(quoteError || quote?.message) && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-chili-soft p-3 text-sm text-chili"
                  >
                    {quoteError || quote?.message}
                  </p>
                )}
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Không áp dụng thêm voucher. Món mới cần có giá trị bằng hoặc
                  cao hơn tiền cũ; chênh lệch dương qua VNPay từ 5.000đ. Chưa
                  trừ thêm tiền ở bước gửi yêu cầu.
                </p>
                <label className="mt-5 flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={busy || !!draft.intent}
                    onChange={(e) => setAck(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    Tôi đã kiểm tra món, đồng ý giá trên và hiểu quầy cần duyệt
                    trước khi đổi.
                  </span>
                </label>
                <button
                  disabled={
                    busy ||
                    (!draft.intent &&
                      (!quote?.allowed ||
                        !ack ||
                        draft.reason.trim().length < 3 ||
                        quoting))
                  }
                  onClick={() => void submit()}
                  className="mt-5 min-h-12 w-full rounded-full bg-espresso px-4 font-semibold text-white disabled:opacity-40"
                >
                  {busy
                    ? "Đang gửi…"
                    : draft.intent
                      ? "Gửi lại cùng yêu cầu"
                      : "Gửi yêu cầu cho quầy"}
                </button>
                <button
                  onClick={() => void checkResult()}
                  disabled={busy}
                  className="mt-2 min-h-11 w-full text-sm text-muted underline"
                >
                  Kiểm tra kết quả / cập nhật báo giá
                </button>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
