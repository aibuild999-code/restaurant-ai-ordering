"use client";

import { useEffect, useMemo, useState } from "react";

type OrderStatus = "new" | "accepted" | "ready" | "completed" | "cancelled";
type ApiItem = { name: string; quantity: number; line_total_cents: number };

type ApiOrder = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  status: OrderStatus;
  pickup_time: string | null;
  total_cents: number;
  created_at: string;
  order_items: ApiItem[];
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
};

type Order = {
  id: string;
  number: number;
  customer: string;
  phone: string;
  items: { name: string; qty: number; total: number }[];
  total: number;
  status: OrderStatus;
  pickup: string;
};

type DashboardTab = "orders" | "completed" | "menu";

const statusLabel: Record<OrderStatus, string> = {
  new: "NEW",
  accepted: "ACCEPTED",
  ready: "READY",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

function mapOrder(order: ApiOrder): Order {
  return {
    id: order.id,
    number: order.order_number,
    customer: order.customer_name,
    phone: order.customer_phone || "Phone not provided",
    items: (order.order_items || []).map((item) => ({
      name: item.name,
      qty: item.quantity,
      total: item.line_total_cents / 100,
    })),
    total: order.total_cents / 100,
    status: order.status,
    pickup: order.pickup_time
      ? new Date(order.pickup_time).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : "ASAP · ~20 min",
  };
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("orders");
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState("");

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "completed" && order.status !== "cancelled"),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "completed"),
    [orders]
  );

  const newCount = useMemo(
    () => orders.filter((order) => order.status === "new").length,
    [orders]
  );

  async function loadOrders() {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Could not load orders");
      }

      const data: ApiOrder[] = await response.json();
      setOrders(data.map(mapOrder));
      setError("");
    } catch {
      setError("Orders could not be loaded. Check the Supabase connection.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenu() {
    setMenuLoading(true);

    try {
      const response = await fetch("/api/menu", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Could not load menu");
      }

      setMenu(await response.json());
    } catch {
      setError("Menu could not be loaded. Check the Supabase connection.");
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    loadMenu();

    const timer = setInterval(loadOrders, 5000);

    return () => clearInterval(timer);
  }, []);

  async function advanceOrder(order: Order) {
    const next: Record<OrderStatus, OrderStatus> = {
      new: "accepted",
      accepted: "ready",
      ready: "completed",
      completed: "completed",
      cancelled: "cancelled",
    };

    const nextStatus = next[order.status];

    if (nextStatus === order.status) {
      return;
    }

    const previous = orders;

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? { ...item, status: nextStatus }
          : item
      )
    );

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        status: nextStatus,
      }),
    });

    if (!response.ok) {
      setOrders(previous);
      setError("Order status could not be saved.");
    }
  }

  function OrderCard({ order }: { order: Order }) {
    return (
      <article className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              ORDER #{order.number}
            </p>

            <h4 className="mt-1 text-xl font-bold">{order.customer}</h4>

            <p className="text-sm text-slate-500">{order.phone}</p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              order.status === "new"
                ? "bg-amber-100 text-amber-800"
                : order.status === "accepted"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {statusLabel[order.status]}
          </span>
        </div>

        <div className="space-y-3 py-5">
          {order.items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex justify-between gap-4 text-sm"
            >
              <span>
                <strong>{item.qty} ×</strong> {item.name}
              </span>

              <span className="font-semibold">
                ${item.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t pt-4 text-lg font-bold">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Pickup: {order.pickup}
        </p>

        <button
          onClick={() => advanceOrder(order)}
          className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-base font-bold text-white transition hover:bg-slate-800"
        >
          {order.status === "new"
            ? "ACCEPT ORDER"
            : order.status === "accepted"
              ? "MARK READY"
              : "MARK COMPLETED"}
        </button>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-950">
      <header className="border-b border-white/70 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              AI Phone Orders
            </p>

            <h1 className="text-xl font-bold sm:text-2xl">
              Maple Street Pizza
            </h1>
          </div>

          <div className="text-right text-sm text-slate-600">
            <p className="font-medium text-slate-900">
              (416) 555-0147
            </p>

            <p>Pickup · ~20 minutes</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Restaurant Dashboard
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Orders from your AI phone agent appear here.
            </p>
          </div>

          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
            Online
          </span>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-xl bg-white/90 p-1.5 shadow-md ring-1 ring-slate-200 backdrop-blur">
          <button
            onClick={() => setActiveTab("orders")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "orders"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Active Orders

            {newCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">
                {newCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "completed"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Completed

            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {completedOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("menu")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "menu"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Menu
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "orders" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Active Orders
                </h3>

                <p className="text-sm text-slate-500">
                  Orders that still need restaurant action.
                </p>
              </div>

              <p className="text-sm font-semibold text-slate-500">
                {activeOrders.length} active
              </p>
            </div>

            {loading && (
              <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
                Loading orders…
              </div>
            )}

            {!loading && activeOrders.length === 0 && (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-lg font-semibold text-slate-900">
                  No active orders
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  New phone orders will appear here automatically.
                </p>
              </div>
            )}

            {!loading && activeOrders.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "completed" && (
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-bold">
                Completed Orders
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Order history for quick reference.
              </p>
            </div>

            {completedOrders.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">
                  No completed orders yet
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Completed orders will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="hidden grid-cols-[90px_1.2fr_2fr_110px_120px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
                  <span>Order</span>
                  <span>Customer</span>
                  <span>Items</span>
                  <span>Total</span>
                  <span>Pickup</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {completedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[90px_1.2fr_2fr_110px_120px] sm:items-center sm:gap-4"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-400 sm:hidden">
                          ORDER
                        </p>

                        <p className="font-bold">
                          #{order.number}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 sm:hidden">
                          CUSTOMER
                        </p>

                        <p className="font-semibold">
                          {order.customer}
                        </p>

                        <p className="text-xs text-slate-500">
                          {order.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 sm:hidden">
                          ITEMS
                        </p>

                        <p className="text-sm text-slate-700">
                          {order.items
                            .map(
                              (item) =>
                                `${item.qty} × ${item.name}`
                            )
                            .join(", ")}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 sm:hidden">
                          TOTAL
                        </p>

                        <p className="font-bold">
                          ${order.total.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 sm:hidden">
                          PICKUP
                        </p>

                        <p className="text-sm text-slate-600">
                          {order.pickup}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "menu" && (
          <section>
            <div className="mb-4">
              <h3 className="text-xl font-bold">Menu</h3>

              <p className="mt-1 text-sm text-slate-500">
                Live menu from Supabase.
              </p>
            </div>

            {menuLoading && (
              <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
                Loading menu…
              </div>
            )}

            {!menuLoading && menu.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
                No menu items found.
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {menu.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white p-5 shadow-md shadow-slate-200/40 ring-1 ring-slate-200"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {item.category}
                      </p>

                      <h4 className="mt-1 font-bold">
                        {item.name}
                      </h4>

                      {item.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <span className="font-bold">
                      ${(item.price_cents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
