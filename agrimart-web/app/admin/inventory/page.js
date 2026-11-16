"use client";

import DashNav from "@/components/DashNav";
import InventoryBoard from "@/components/InventoryBoard";
import RoleGate from "@/components/RoleGate";

export default function AdminInventoryPage() {
  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Admin</p>
              <h1>Inventory and logs</h1>
              <p>Stock in, adjustments and spoilage, each logged with the person and the reason.</p>
            </div>
          </header>
          <InventoryBoard />
        </div>
      </div>
    </RoleGate>
  );
}
