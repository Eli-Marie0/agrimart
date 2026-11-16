"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OrderConfirmation from "@/components/OrderConfirmation";

function Confirmation() {
  const params = useSearchParams();
  return <OrderConfirmation orderId={params.get("order")} paymentFlag={params.get("payment") || ""} />;
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="wrap pad"><p className="load-note">Loading order...</p></div>}>
      <Confirmation />
    </Suspense>
  );
}
