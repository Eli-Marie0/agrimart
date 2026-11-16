"use client";

import DashNav from "@/components/DashNav";
import OrdersBoard from "@/components/OrdersBoard";
import RoleGate from "@/components/RoleGate";

export default function StaffOrdersPage() {
  return (
    <RoleGate roles={["staff", "admin"]}>
      <div className="dash">
        <DashNav kind="staff" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Staff</p>
              <h1>Orders</h1>
              <p>Confirm payment, prepare the order, hand off for delivery and complete it. Every change emails the customer.</p>
            </div>
          </header>
          <OrdersBoard />
        </div>
      </div>
    </RoleGate>
  );
}
