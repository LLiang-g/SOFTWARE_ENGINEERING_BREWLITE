"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "../auth/auth.store";
import { paymentFetch } from "../payments/vnpay-api";
import RefundStatus from "../payments/RefundStatus";
import { exchangeLabels, getExchanges, type Exchange } from "./exchange-api";
export type { Exchange } from "./exchange-api";
export default function ExchangePanel({
  orderId,
  canRequest,
}: {
  orderId: number;
  canRequest: boolean;
}) {
  const [rows, setRows] = useState<Exchange[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    token = useAuthStore((s) => s.token);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const data = await getExchanges(orderId, signal);
      if (!signal?.aborted && useAuthStore.getState().token === token)
        setRows(data);
    },
    [orderId, token],
  );
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted)
        void load(c.signal).catch(() => {
          if (!c.signal.aborted) setError("Chưa tải được yêu cầu hỗ trợ.");
        });
    });
    return () => c.abort();
  }, [load]);
  const pending = rows.find((r) => r.status === "REQUESTED");
  useEffect(() => {
    if (!pending) return;
    const c = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void load(c.signal).catch(() => {});
    }, 15000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [pending, load]);
  async function withdraw() {
    if (!pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await paymentFetch(
        `/orders/${orderId}/exchanges/${pending.id}/withdraw`,
        { method: "POST", body: JSON.stringify({ version: pending.version }) },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không rút được yêu cầu");
      await load().catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 border-t border-line pt-3">
      {pending ? (
        <section
          className="rounded-2xl bg-crema-soft p-4 text-sm"
          aria-label="Yêu cầu đổi đang chờ"
        >
          <p className="font-semibold">Quầy đang xem yêu cầu đổi món</p>
          <p className="mt-1">
            Đơn ban đầu được giữ lại và chờ quầy xử lý yêu cầu trước khi pha.
          </p>
          <Link
            href={`/orders/${orderId}/exchange`}
            className="mt-2 inline-flex min-h-10 items-center underline"
          >
            Xem yêu cầu
          </Link>
          <button
            disabled={busy}
            onClick={() => void withdraw()}
            className="ml-4 min-h-10 text-muted underline"
          >
            Rút yêu cầu, giữ món cũ
          </button>
        </section>
      ) : canRequest ? (
        <Link
          href={`/orders/${orderId}/exchange`}
          className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-line underline-offset-4 hover:text-espresso"
        >
          Cần hỗ trợ đổi món?
        </Link>
      ) : null}
      {rows.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer py-2 text-muted">
            Lịch sử yêu cầu đổi món
          </summary>
          {rows.map((row) => (
            <div
              key={row.id}
              className="my-2 rounded-xl border border-line p-3"
            >
              <p className="font-medium">{exchangeLabels[row.status]}</p>
              <p className="mt-1 text-muted">
                {row.decisionNote || row.reason}
              </p>
              {row.replacementOrderId && (
                <Link
                  href={`/orders/${row.replacementOrderId}`}
                  className="mt-2 inline-flex min-h-10 items-center font-semibold underline"
                >
                  Xem đơn thay thế #{row.replacementOrderId}
                </Link>
              )}
            </div>
          ))}
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      <RefundStatus orderId={orderId} />
    </div>
  );
}
