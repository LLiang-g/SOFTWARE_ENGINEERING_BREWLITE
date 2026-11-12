"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "../auth/auth.store";
import { paymentFetch } from "../payments/vnpay-api";
import {
  exchangeLabels,
  type Exchange,
  type QuoteLine,
} from "../orders/exchange-api";
import { formatPrice } from "@/lib/format";
type Refund = {
  id: number;
  amount: number;
  status: "OPEN" | "PROCESSING" | "COMPLETED";
  version: number;
  note: string | null;
  reference: string | null;
  createdAt: string;
  completedAt: string | null;
  handledBy: number | null;
  attempt: {
    orderId: number;
    txnRef: string;
    providerTxnNo: string | null;
    reviewReason: string | null;
    order: { user: { email: string } };
    audits: {
      id: number;
      action: string;
      note: string;
      createdAt: string;
      actor: { email: string } | null;
    }[];
  };
};
type Queue<T> = { rows: T[]; total: number; page: number; pages: number };
const refundLabels = {
  OPEN: "Chờ xử lý",
  PROCESSING: "Đang hoàn thủ công",
  COMPLETED: "Đã xác nhận hoàn",
};
const reasons: Record<string, string> = {
  DUPLICATE_PAYMENT: "Thanh toán trùng",
  ORDER_AMOUNT_CHANGED: "Khoản thu không khớp đơn",
  PAID_WITHOUT_ACTIVE_ORDER: "Tiền về khi đơn không còn phục vụ",
};
const date = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
function Lines({ lines }: { lines: QuoteLine[] }) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((line, index) => (
        <li key={index} className="flex justify-between gap-4 py-3 text-sm">
          <div>
            <p className="font-medium">
              {line.qty} × {line.name}
            </p>
            <p className="mt-1 text-muted">
              Size {line.size}
              {line.toppings.length
                ? ` · ${line.toppings.map((t) => (t === "KEM" ? "Kem" : t === "TRAN_CHAU" ? "Trân châu" : t)).join(", ")}`
                : ""}
            </p>
          </div>
          <span className="shrink-0 tabular-nums">
            {formatPrice(line.lineTotal)}
          </span>
        </li>
      ))}
    </ul>
  );
}
export default function StaffPaymentCases() {
  const [tab, setTab] = useState<"exchanges" | "refunds">("exchanges"),
    [status, setStatus] = useState("REQUESTED");
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState<Queue<Exchange | Refund>>({
    rows: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [selected, setSelected] = useState<Exchange | Refund | null>(null),
    [note, setNote] = useState(""),
    [reference, setReference] = useState(""),
    [checked, setChecked] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [action, setAction] = useState<
      "approve" | "reject" | "claim" | "complete" | null
    >(null),
    [refreshKey, setRefreshKey] = useState(0);
  const token = useAuthStore((s) => s.token),
    lock = useRef(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const base =
        tab === "exchanges"
          ? "/staff/exchanges/queue"
          : "/staff/payment-refunds/queue";
      const result = await paymentFetch<Queue<Exchange | Refund>>(
        `${base}?${new URLSearchParams({ status, page: String(page), search: query })}`,
        { signal },
      );
      if (!signal?.aborted && useAuthStore.getState().token === token) {
        setData(result);
        setSelected((current) =>
          current
            ? (result.rows.find((row) => row.id === current.id) ?? null)
            : null,
        );
      }
    },
    [tab, status, page, query, token],
  );
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (c.signal.aborted) return;
      setLoading(true);
      void load(c.signal)
        .catch((e) => {
          if (!c.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Không tải được hàng đợi",
            );
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    });
    return () => c.abort();
  }, [load, refreshKey]);
  function open(row: Exchange | Refund) {
    setSelected(row);
    setAction(null);
    setNote("");
    setReference("");
    setChecked(false);
    setError("");
    setNotice("");
  }
  function switchTab(next: "exchanges" | "refunds") {
    if (saving) return;
    setTab(next);
    setStatus(next === "exchanges" ? "REQUESTED" : "OPEN");
    setPage(1);
    setSelected(null);
    setData({ rows: [], total: 0, page: 1, pages: 1 });
    setError("");
    setNotice("");
    setSearch("");
    setQuery("");
  }
  async function save() {
    if (!selected || !action || lock.current || note.trim().length < 3) return;
    if (action === "complete" && (!checked || reference.trim().length < 5))
      return;
    lock.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const path =
        tab === "exchanges"
          ? `/staff/exchanges/${selected.id}/decision`
          : `/staff/payment-refunds/${selected.id}/status`;
      const body =
        tab === "exchanges"
          ? {
              version: selected.version,
              approve: action === "approve",
              note: note.trim(),
            }
          : {
              version: selected.version,
              status: action === "claim" ? "PROCESSING" : "COMPLETED",
              reference: reference.trim(),
              note: note.trim(),
            };
      await paymentFetch(path, { method: "POST", body: JSON.stringify(body) });
      if (useAuthStore.getState().token !== token) return;
      setNotice(
        tab === "exchanges"
          ? action === "approve"
            ? "Đã duyệt. Đơn thay thế đã được tạo, khách chỉ thanh toán thêm nếu có."
            : "Đã từ chối. Đơn ban đầu tiếp tục được phục vụ."
          : action === "claim"
            ? "Đã nhận xử lý. Chưa xác nhận tiền đã trả cho khách."
            : "Đã lưu xác nhận hoàn thủ công và chứng từ.",
      );
      setAction(null);
      setSelected(null);
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa xác nhận được kết quả. Cập nhật hồ sơ trước khi thử lại.",
      );
      setAction(null);
      await load().catch(() => {});
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const exchange = selected && "sourceOrderId" in selected ? selected : null;
  const refund = selected && "attempt" in selected ? selected : null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Hỗ trợ tại quầy
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            Đổi món & khoản thu dư
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Xem thông tin đơn, xác nhận với khách và theo dõi từng yêu cầu đến
            khi xử lý xong.
          </p>
        </div>
        <button
          disabled={loading || saving}
          onClick={() => {
            setError("");
            setRefreshKey((k) => k + 1);
          }}
          className="min-h-11 rounded-full border border-line bg-paper px-5 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? "Đang cập nhật…" : "Cập nhật hàng đợi"}
        </button>
      </header>
      <nav
        aria-label="Loại hồ sơ"
        className="mt-6 flex gap-2 border-b border-line"
      >
        {(["exchanges", "refunds"] as const).map((t) => (
          <button
            key={t}
            disabled={saving}
            aria-pressed={tab === t}
            onClick={() => switchTab(t)}
            className={`min-h-12 border-b-2 px-4 text-sm font-semibold ${tab === t ? "border-espresso" : "border-transparent text-muted"}`}
          >
            {t === "exchanges" ? "Yêu cầu đổi món" : "Khoản thu cần hoàn"}
          </button>
        ))}
      </nav>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-2xl bg-pandan-soft p-4 text-sm text-pandan"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-chili-soft p-4 text-sm text-chili"
        >
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Trạng thái
          <select
            value={status}
            disabled={saving}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setSelected(null);
            }}
            className="mt-1 block h-11 rounded-xl border border-line bg-paper px-3"
          >
            {(tab === "exchanges"
              ? [
                  ["REQUESTED", "Chờ duyệt"],
                  ["APPROVED", "Đã duyệt"],
                  ["REJECTED", "Từ chối"],
                  ["WITHDRAWN", "Khách đã rút"],
                  ["ALL", "Tất cả"],
                ]
              : [
                  ["OPEN", "Chờ xử lý"],
                  ["PROCESSING", "Đang hoàn"],
                  ["COMPLETED", "Đã hoàn"],
                  ["ALL", "Tất cả"],
                ]
            ).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
            setSelected(null);
          }}
          className="flex basis-full items-end gap-2 sm:basis-0 sm:flex-1"
        >
          <label className="min-w-0 flex-1 text-sm font-medium">
            Tìm hồ sơ
            <input
              maxLength={100}
              value={search}
              disabled={saving}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mã đơn, mã hồ sơ hoặc email khách"
              className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3"
            />
          </label>
          <button
            disabled={saving}
            className="h-11 rounded-xl border border-line px-4 text-sm font-semibold"
          >
            Tìm
          </button>
        </form>
      </div>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          aria-label="Danh sách hồ sơ"
          className={`overflow-hidden rounded-3xl border border-line bg-paper ${selected ? "hidden lg:block" : ""}`}
        >
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">
            {data.total} hồ sơ{" "}
            {loading && (
              <span className="font-normal text-muted">· đang tải</span>
            )}
          </div>
          {!loading && !data.rows.length && (
            <p className="px-5 py-10 text-sm text-muted">
              Không có hồ sơ phù hợp. Thử đổi bộ lọc hoặc tìm kiếm.
            </p>
          )}
          <div className="max-h-[65vh] overflow-y-auto">
            {data.rows.map((row) => {
              const isExchange = "sourceOrderId" in row;
              return (
                <button
                  key={`${tab}-${row.id}`}
                  disabled={saving || loading}
                  onClick={() => open(row)}
                  aria-pressed={selected?.id === row.id}
                  className={`block w-full border-b border-line px-4 py-4 text-left last:border-b-0 ${selected?.id === row.id ? "bg-crema-soft" : "hover:bg-crema-soft/40"}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">
                      Đơn #
                      {isExchange ? row.sourceOrderId : row.attempt.orderId}
                    </span>
                    <span className="text-xs text-muted">HS #{row.id}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {isExchange
                      ? row.sourceOrder.user.email
                      : row.attempt.order.user.email}
                  </p>
                  <p className="mt-3 text-sm">
                    {isExchange
                      ? exchangeLabels[row.status]
                      : refundLabels[row.status]}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {date(row.createdAt)}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {isExchange
                      ? row.quotedTotal !== null
                        ? `Trả thêm ${formatPrice(Math.max(0, row.quotedTotal - row.sourceOrder.total))}`
                        : "Cần khách chọn lại món"
                      : formatPrice(row.amount)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line p-3 text-sm">
            <button
              disabled={page <= 1 || loading || saving}
              onClick={() => {
                setPage((p) => p - 1);
                setSelected(null);
              }}
              className="min-h-10 px-2 disabled:opacity-30"
            >
              ← Trước
            </button>
            <span>
              {page} / {data.pages}
            </span>
            <button
              disabled={page >= data.pages || loading || saving}
              onClick={() => {
                setPage((p) => p + 1);
                setSelected(null);
              }}
              className="min-h-10 px-2 disabled:opacity-30"
            >
              Sau →
            </button>
          </div>
        </aside>
        <div
          className={`min-w-0 rounded-3xl border border-line bg-paper p-5 md:p-6 ${!selected ? "hidden lg:block" : ""}`}
        >
          {selected && (
            <button
              disabled={saving}
              onClick={() => {
                setSelected(null);
                setAction(null);
              }}
              className="mb-4 min-h-11 text-sm text-muted underline lg:hidden"
            >
              ← Trở lại danh sách hồ sơ
            </button>
          )}
          {!selected ? (
            <div className="py-20 text-center">
              <h2 className="font-display text-xl font-bold">
                Chọn hồ sơ để xem chi tiết
              </h2>
              <p className="mt-2 text-sm text-muted">
                Xem món cũ, món thay thế và khoản tiền trước khi xử lý.
              </p>
            </div>
          ) : (
            <>
              <header className="flex justify-between gap-3">
                <h2 className="font-display text-xl font-bold">
                  {exchange ? "Yêu cầu đổi món" : "Hồ sơ khoản thu dư"} #
                  {selected.id}
                </h2>
                <span className="text-xs text-muted">
                  {date(selected.createdAt)}
                </span>
              </header>
              {exchange && (
                <>
                  <p className="mt-2 text-sm text-muted">
                    {exchange.sourceOrder.user.email} · Đơn #
                    {exchange.sourceOrderId}
                  </p>
                  <blockquote className="mt-4 rounded-2xl bg-crema-soft p-4 text-sm">
                    <span className="block text-xs font-semibold text-muted">
                      Lý do khách gửi
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">
                      {exchange.reason}
                    </p>
                  </blockquote>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <section>
                      <h3 className="font-semibold">Món trong đơn cũ</h3>
                      <Lines
                        lines={exchange.sourceOrder.items.map((i) => ({
                          ...i,
                          name: i.product.name,
                        }))}
                      />
                    </section>
                    <section>
                      <h3 className="font-semibold">Món khách chọn thay thế</h3>
                      {exchange.quotedLines ? (
                        <Lines lines={exchange.quotedLines} />
                      ) : (
                        <p className="mt-3 text-sm text-chili">
                          Yêu cầu cũ thiếu báo giá. Từ chối và mời khách chọn
                          lại.
                        </p>
                      )}
                    </section>
                  </div>
                  <dl className="mt-5 space-y-3 rounded-2xl border border-line p-4 text-sm">
                    <div className="flex justify-between">
                      <dt>Giá trị món thay thế đã chốt với khách</dt>
                      <dd>
                        {exchange.quotedTotal === null
                          ? "Chưa có"
                          : formatPrice(exchange.quotedTotal)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Tiền chuyển từ đơn cũ</dt>
                      <dd>{formatPrice(exchange.sourceOrder.total)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-3 font-bold">
                      <dt>Khách thanh toán thêm sau duyệt</dt>
                      <dd>
                        {exchange.quotedTotal === null
                          ? "—"
                          : formatPrice(
                              Math.max(
                                0,
                                exchange.quotedTotal -
                                  exchange.sourceOrder.total,
                              ),
                            )}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-muted">
                    Duyệt sẽ chuyển tiền đã trả sang đơn thay thế và cập nhật
                    nguyên liệu. Khách chỉ trả thêm phần chênh lệch trên. Nếu
                    món không còn đủ nguyên liệu, yêu cầu chưa được duyệt.
                  </p>
                  {exchange.replacementOrder && (
                    <div className="mt-4 rounded-xl bg-pandan-soft p-4 text-sm">
                      <p>
                        Đã tạo đơn thay thế #{exchange.replacementOrder.id}.{" "}
                        {exchange.replacementOrder.status === "PENDING" ||
                        exchange.replacementOrder.status === "PAYMENT_FAILED"
                          ? "Đang chờ khách thanh toán chênh lệch."
                          : "Đã ghi nhận thanh toán / đang phục vụ."}
                      </p>
                    </div>
                  )}
                  {exchange.decisionNote && (
                    <p className="mt-4 whitespace-pre-wrap text-sm">
                      Kết quả xử lý: {exchange.decisionNote}
                    </p>
                  )}
                  {exchange.status === "REQUESTED" && !action && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        disabled={
                          saving ||
                          exchange.quotedTotal === null ||
                          exchange.sourceOrder.status !== "PAID"
                        }
                        onClick={() => {
                          setAction("approve");
                          setNote("");
                        }}
                        className="min-h-12 rounded-full bg-espresso px-5 font-semibold text-white disabled:opacity-40"
                      >
                        Kiểm tra và duyệt đổi
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => {
                          setAction("reject");
                          setNote("");
                        }}
                        className="min-h-12 rounded-full border border-line px-5 text-sm"
                      >
                        Từ chối yêu cầu
                      </button>
                    </div>
                  )}
                </>
              )}
              {refund && (
                <>
                  <p className="mt-2 text-sm text-muted">
                    {refund.attempt.order.user.email} · Đơn #
                    {refund.attempt.orderId}
                  </p>
                  <div className="mt-5 rounded-2xl bg-crema-soft p-5">
                    <p className="text-sm text-muted">Khoản tiền cần trả lại</p>
                    <p className="mt-1 font-display text-3xl font-bold">
                      {formatPrice(refund.amount)}
                    </p>
                    <p className="mt-2 text-sm">
                      {reasons[refund.attempt.reviewReason ?? ""] ??
                        "Khoản thu cần quầy đối soát"}
                    </p>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div>
                      <dt className="text-muted">Tham chiếu thanh toán</dt>
                      <dd className="mt-1 break-all font-mono text-xs">
                        {refund.attempt.txnRef}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Mã giao dịch VNPay</dt>
                      <dd>{refund.attempt.providerTxnNo ?? "Chưa có"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Trạng thái xử lý</dt>
                      <dd className="font-semibold">
                        {refundLabels[refund.status]}
                      </dd>
                    </div>
                    {refund.reference && (
                      <div>
                        <dt className="text-muted">Chứng từ hoàn</dt>
                        <dd className="break-all">{refund.reference}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-5 rounded-2xl border border-line p-4 text-sm">
                    Các nút bên dưới chỉ lưu hồ sơ. Quầy cần xác minh người nhận
                    và thực hiện hoàn tiền bên ngoài hệ thống. Chỉ xác nhận hoàn
                    tất sau khi khoản trả đã được thực hiện và có chứng từ.
                  </p>
                  {refund.status !== "COMPLETED" && !action && (
                    <button
                      disabled={saving}
                      onClick={() => {
                        setAction(
                          refund.status === "OPEN" ? "claim" : "complete",
                        );
                        setNote("");
                        setReference("");
                        setChecked(false);
                      }}
                      className="mt-5 min-h-12 rounded-full bg-espresso px-5 font-semibold text-white"
                    >
                      {refund.status === "OPEN"
                        ? "Nhận xử lý khoản thu"
                        : "Ghi nhận đã hoàn thủ công"}
                    </button>
                  )}
                  <section className="mt-6">
                    <h3 className="font-semibold">Lịch sử xử lý</h3>
                    <ol className="mt-3 space-y-3">
                      {refund.attempt.audits.map((a) => (
                        <li
                          key={a.id}
                          className="border-l-2 border-line pl-4 text-sm"
                        >
                          <p className="whitespace-pre-wrap">{a.note}</p>
                          <p className="mt-1 text-xs text-muted">
                            {date(a.createdAt)} · {a.actor?.email ?? "Hệ thống"}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
              {action && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                  className="mt-6 space-y-4 rounded-2xl border-2 border-espresso p-4"
                  aria-label="Xác nhận thao tác"
                >
                  <h3 className="font-semibold">
                    {action === "approve"
                      ? "Xác nhận duyệt đổi món"
                      : action === "reject"
                        ? "Lý do không duyệt"
                        : action === "claim"
                          ? "Nhận xử lý khoản thu dư"
                          : "Xác nhận đã trả khoản thu dư"}
                  </h3>
                  <label className="block text-sm">
                    {action === "reject"
                      ? "Lý do gửi cho khách"
                      : "Ghi chú xử lý"}
                    <textarea
                      required
                      minLength={3}
                      maxLength={1000}
                      disabled={saving}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-2 min-h-24 w-full rounded-xl border border-line p-3"
                    />
                  </label>
                  {action === "complete" && (
                    <>
                      <label className="block text-sm">
                        Mã chứng từ hoàn tiền
                        <input
                          required
                          minLength={5}
                          maxLength={200}
                          disabled={saving}
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="Mã giao dịch trả tiền thực tế"
                          className="mt-2 h-12 w-full rounded-xl border border-line px-3"
                        />
                      </label>
                      <label className="flex gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={(e) => setChecked(e.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          Tôi đã kiểm tra đúng người nhận, đúng số tiền và hoàn
                          tiền thực tế; chứng từ trên là chứng từ hoàn.
                        </span>
                      </label>
                    </>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={
                        saving ||
                        note.trim().length < 3 ||
                        (action === "complete" &&
                          (!checked || reference.trim().length < 5))
                      }
                      className="min-h-11 rounded-full bg-espresso px-5 font-semibold text-white disabled:opacity-40"
                    >
                      {saving ? "Đang lưu…" : "Xác nhận"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setAction(null)}
                      className="min-h-11 rounded-full border border-line px-5"
                    >
                      Quay lại kiểm tra
                    </button>
                  </div>
                </form>
              )}
              <Link
                href="/barista"
                className="mt-6 inline-block text-xs text-muted"
              >
                Khu vực nhân viên
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
