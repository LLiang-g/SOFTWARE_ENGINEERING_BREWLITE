"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import OrdersLiveStatus from "@/features/orders/OrdersLiveStatus";
import { useOrdersLive } from "@/features/orders/useOrdersLive";
import { useAuthStore } from "@/features/auth/auth.store";
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL } from "@/lib/format";
import { ApiError } from "@/lib/orders-api";
import type { OrderView } from "@/lib/types";
import {
  getStaffOrders,
  updateStaffOrder,
  type NextStaffStatus,
} from "./staff-api";

const LOAD_ERROR = "Không tải được đơn hàng. Bạn hãy thử tải lại.";
const NO_PERMISSION = "Tài khoản này không có quyền barista.";

const COLUMNS = [
  {
    status: "PAID",
    title: "Chờ duyệt",
    action: "Duyệt đơn",
    nextStatus: "PREPARING",
  },
  {
    status: "PREPARING",
    title: ORDER_STATUS_LABEL.PREPARING,
    action: "Pha xong",
    nextStatus: "READY",
  },
  {
    status: "READY",
    title: ORDER_STATUS_LABEL.READY,
    action: "Đã giao khách",
    nextStatus: "COMPLETED",
  },
  {
    status: "COMPLETED",
    title: ORDER_STATUS_LABEL.COMPLETED,
    action: null,
    nextStatus: null,
  },
] as const;

export default function StaffBoard() {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const loadOrders = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await getStaffOrders(signal);
      if (signal.aborted) return;
      setOrders(data);
      setLoadError(null);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        // Phiên hết hạn: đăng xuất để cổng đăng nhập đưa về trang đăng nhập.
        useAuthStore.getState().logout();
        return;
      }
      setLoadError(
        error instanceof ApiError && error.status === 403
          ? NO_PERMISSION
          : LOAD_ERROR,
      );
    }
  }, []);
  const { connected, isLoading, refresh } = useOrdersLive(true, loadOrders);

  function reloadOrders() {
    setActionError(null);
    void refresh();
  }

  async function changeStatus(order: OrderView, status: NextStaffStatus) {
    if (isLoading || sendingId !== null || loadError) return;

    setSendingId(order.id);
    setActionError(null);
    try {
      await updateStaffOrder(order.id, status);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().logout();
      } else if (error instanceof ApiError && error.status === 403) {
        setActionError(NO_PERMISSION);
      } else if (error instanceof ApiError && error.status === 409) {
        setActionError(error.message);
        await refresh();
      } else {
        setActionError(
          error instanceof ApiError
            ? error.message
            : "Không kết nối được máy chủ. Bạn hãy thử lại.",
        );
      }
    } finally {
      setSendingId(null);
    }
  }

  return (
    <main className="flex-1 bg-stone-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Đơn hàng tại quầy</h1>
        <OrdersLiveStatus
          connected={connected}
          busy={isLoading || sendingId !== null}
          refresh={reloadOrders}
        />
        {loadError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <p role="alert">{loadError}</p>
          </div>
        )}
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {actionError}
          </p>
        )}

        {orders && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map(({ status, title, action, nextStatus }) => {
              const columnOrders = orders.filter(
                (order) => order.status === status,
              );

              return (
                <section
                  key={status}
                  className="rounded-xl border border-amber-100 bg-amber-50 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2 px-1">
                    <h2 className="font-semibold">{title}</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
                      {columnOrders.length}
                    </span>
                  </div>

                  {columnOrders.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-amber-200 px-3 py-4 text-sm text-gray-600">
                      Chưa có đơn trong cột này.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {columnOrders.map((order) => (
                        <li
                          key={order.id}
                          className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm"
                        >
                          <h3 className="font-semibold">Đơn #{order.id}</h3>
                          <time
                            dateTime={order.createdAt}
                            className="mt-1 block text-xs text-gray-600"
                          >
                            {formatDateTime(order.createdAt)}
                          </time>

                          <ul className="my-3 space-y-2 border-y border-gray-100 py-3 text-sm">
                            {order.items.map((item) => (
                              <li key={item.id}>
                                <p className="font-medium">
                                  {item.name} × {item.qty}
                                </p>
                                <p className="text-gray-600">
                                  Size {item.size} ·{" "}
                                  {item.toppingNames.join(", ") ||
                                    "Không topping"}
                                </p>
                              </li>
                            ))}
                          </ul>

                          <p className="flex justify-between gap-2 text-sm font-semibold">
                            <span>Tổng tiền</span>
                            <span>{formatPrice(order.total)}</span>
                          </p>

                          {order.pendingExchangeId && (
                            <Link
                              href="/barista?workspace=cases"
                              className="mt-3 block rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-900 underline"
                            >
                              Có yêu cầu đổi món — xử lý trước khi pha
                            </Link>
                          )}
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() =>
                                void changeStatus(order, nextStatus)
                              }
                              disabled={
                                isLoading ||
                                sendingId !== null ||
                                Boolean(loadError) ||
                                Boolean(order.pendingExchangeId)
                              }
                              className="mt-3 w-full rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {sendingId === order.id
                                ? "Đang cập nhật..."
                                : action}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
