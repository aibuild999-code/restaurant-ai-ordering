"use client";

import { useMemo, useState } from "react";

type OrderStatus = "new" | "accepted" | "ready" | "completed";

type Order = {
  id: number;
  customer: string;
  phone: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: OrderStatus;
  pickup: string;
};

const demoOrders: Order[] = [
  {
    id: 1,
    customer: "John",
    phone: "(416) 555-0199",
    items: [
      { name: "Large Pepperoni Pizza", qty: 1, price: 18 },
      { name: "Coke", qty: 2, price: 3.5 },
    ],
    total: 25,
    status: "new",
    pickup: "ASAP · ~20 min",
  },
];

const statusLabel: Record<OrderStatus, string> = {
  new: "NEW",
  accepted: "ACCEPTED",
  ready: "READY",
  completed: "COMPLETED",
};

export default function Home() {
  const [orders, setOrders] = useState(demoOrders);
  const [activeTab, setActiveTab] = useState<"orders" | "menu">("orders");

  const newCount = useMemo(() => orders.filter((o) => o.status === "new").length, [orders]);

  function advanceOrder(id: number) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== id) return order;
        const next: Record<OrderStatus, OrderStatus> = {
          new: "accepted",
          accepted: "ready",
          ready: "completed",
          completed: "completed",
        };
        return { ...order, status: next[order.status] };
      }),
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI Phone Orders</p>
            <h1 className="text-xl font-bold sm:text-2xl">Maple Street Pizza</h1>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-medium text-slate-900">(416) 555-0147</p>
            <p>Pickup · ~20 minutes</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Restaurant Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Orders from your AI phone agent appear here.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Online</span>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <button onClick={() => setActiveTab("orders")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "orders" ? "bg-slate-950 text-white" : "text-slate-600"}`}>
            Orders {newCount > 0 && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5">{newCount}</span>}
          </button>
          <button onClick={() => setActiveTab("menu")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "menu" ? "bg-slate-950 text-white" : "text-slate-600"}`}>
            Menu
          </button>
        </div>

        {activeTab === "orders" ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">New & Active Orders</h3>
              <p className="text-sm text-slate-500">{orders.filter((o) => o.status !== "completed").length} active</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {orders.filter((o) => o.status !== "completed").map((order) => (
                <article key={order.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">ORDER #{order.id}</p>
                      <h4 className="mt-1 text-xl font-bold">{order.customer}</h4>
                      <p className="text-sm text-slate-500">{order.phone}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{statusLabel[order.status]}</span>
                  </div>

                  <div className="space-y-3 py-5">
                    {order.items.map((item) => (
                      <div key={item.name} className="flex justify-between gap-4 text-sm">
                        <span><strong>{item.qty} ×</strong> {item.name}</span>
                        <span className="font-semibold">${(item.qty * item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between border-t pt-4 text-lg font-bold">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Pickup: {order.pickup}</p>

                  <button onClick={() => advanceOrder(order.id)} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-base font-bold text-white transition hover:bg-slate-800">
                    {order.status === "new" ? "ACCEPT ORDER" : order.status === "accepted" ? "MARK READY" : "MARK COMPLETED"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold">Menu</h3>
            <p className="mt-1 text-sm text-slate-500">Menu management will be connected to Supabase next.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["Large Pepperoni Pizza · $18.00", "Large Cheese Pizza · $16.00", "Medium Pepperoni Pizza · $15.00", "Garlic Knots · $7.00", "Coke · $3.50", "Diet Coke · $3.50", "Bottled Water · $2.50"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 p-4 font-medium">{item}</div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
