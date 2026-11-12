import { Suspense } from "react";
import { notFound } from "next/navigation";
import ExchangeWorkspace from "@/features/orders/ExchangeWorkspace";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  return <ExchangeWorkspace orderId={orderId} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-tabs md:px-6">
      <Suspense
        fallback={
          <p className="py-12" role="status">
            Đang mở yêu cầu hỗ trợ…
          </p>
        }
      >
        <Content params={params} />
      </Suspense>
    </main>
  );
}
