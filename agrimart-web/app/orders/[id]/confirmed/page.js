import OrderConfirmation from "@/components/OrderConfirmation";

export const metadata = { title: "Order confirmed" };

export default async function ConfirmedPage({ params }) {
  const { id } = await params;
  return <OrderConfirmation orderId={id} />;
}
