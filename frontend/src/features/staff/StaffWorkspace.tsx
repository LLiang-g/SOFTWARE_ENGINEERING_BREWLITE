"use client";
import { useEffect, useState } from "react";
import StaffBoard from "./StaffBoard";
import StaffPayments from "./StaffPayments";
import StaffPaymentCases from "./StaffPaymentCases";
export default function StaffWorkspace() {
  const [tab, setTab] = useState<"orders" | "payments" | "cases">("orders");
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("workspace") === "cases"
    )
      queueMicrotask(() => setTab("cases"));
  }, []);
  return (
    <>
      <nav
        aria-label="Khu vực barista"
        className="flex flex-wrap justify-center gap-2 border-b border-line p-3"
      >
        <button
          type="button"
          aria-pressed={tab === "orders"}
          onClick={() => setTab("orders")}
          className="rounded-full border px-4 py-2"
        >
          Đơn hàng
        </button>
        <button
          type="button"
          aria-pressed={tab === "payments"}
          onClick={() => setTab("payments")}
          className="rounded-full border px-4 py-2"
        >
          Thanh toán
        </button>
        <button
          type="button"
          aria-pressed={tab === "cases"}
          onClick={() => setTab("cases")}
          className="rounded-full border px-4 py-2"
        >
          Hỗ trợ đơn
        </button>
      </nav>
      {tab === "orders" ? (
        <StaffBoard />
      ) : tab === "payments" ? (
        <StaffPayments />
      ) : (
        <StaffPaymentCases />
      )}
    </>
  );
}
