"use client";

import DashNav from "@/components/DashNav";
import InventoryBoard from "@/components/InventoryBoard";
import RoleGate from "@/components/RoleGate";

export default function StaffInventoryPage() {
  return (
    <RoleGate roles={["staff", "admin"]}>
      <div className="dash">
        <DashNav kind="staff" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Staff</p>
              <h1>Inventory and stock log</h1>
              <p>Record stock in, adjustments and spoilage. Each change is logged with your name and the reason.</p>
            </div>
          </header>
          <InventoryBoard />
        </div>
      </div>
    </RoleGate>
  );
}
