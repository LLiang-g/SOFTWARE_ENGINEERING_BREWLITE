import { paymentFetch } from "../payments/vnpay-api";
import type { NewOrderItem } from "@/lib/orders-api";
export type QuoteLine = NewOrderItem & { name: string; lineTotal: number };
export type Quote = {
  total: number;
  credit: number;
  difference: number;
  fingerprint: string;
  allowed: boolean;
  message: string;
  lines: QuoteLine[];
};
export type Exchange = {
  id: number;
  sourceOrderId: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  version: number;
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  quotedTotal: number | null;
  quotedLines: QuoteLine[] | null;
  items: NewOrderItem[];
  sourceOrder: {
    total: number;
    status: string;
    user: { email: string };
    items: (QuoteLine & { product: { name: string } })[];
  };
  replacementOrderId: number | null;
  replacementOrder: {
    id: number;
    total: number;
    creditApplied: number;
    status: string;
  } | null;
};
export const exchangeLabels: Record<Exchange["status"], string> = {
  REQUESTED: "Chờ quầy duyệt",
  APPROVED: "Đã duyệt đổi",
  REJECTED: "Không được duyệt",
  WITHDRAWN: "Khách đã rút yêu cầu",
};
export const getExchanges = (id: number, signal?: AbortSignal) =>
  paymentFetch<Exchange[]>(`/orders/${id}/exchanges`, { signal });
export const getQuote = (
  id: number,
  items: NewOrderItem[],
  signal?: AbortSignal,
) =>
  paymentFetch<Quote>(`/orders/${id}/exchange-quote`, {
    method: "POST",
    body: JSON.stringify({ items }),
    signal,
  });
