import AccountOrderDetail from "@/components/AccountOrderDetail";

export const metadata = { title: "Order detail" };

export default async function AccountOrderPage({ params }) {
  const { id } = await params;
  return <AccountOrderDetail orderId={id} />;
}
