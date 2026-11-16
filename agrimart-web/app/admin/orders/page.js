"use client";

import DashNav from "@/components/DashNav";
import OrdersBoard from "@/components/OrdersBoard";
import RoleGate from "@/components/RoleGate";

export default function AdminOrdersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Admin</p>
              <h1>Orders</h1>
              <p>Confirm, prepare, hand off and complete orders. Cancelling returns deducted stock.</p>
            </div>
          </header>
          <OrdersBoard />
        </div>
      </div>
    </RoleGate>
  );
}
