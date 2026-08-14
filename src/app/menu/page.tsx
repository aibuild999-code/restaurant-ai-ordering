"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
};

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load menu");
        return response.json();
      })
      .then(setMenu)
      .catch(() => setError("Our menu is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(menu.map((item) => item.category))];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-slate-100 px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Maple Street Pizza
          </p>
          <h1 className="mt-2 text-4xl font-black">Our Menu</h1>
          <p className="mt-3 text-slate-600">
            Browse our current menu and then call us when you're ready to order.
          </p>
        </header>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            Loading menu…
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-8 text-center text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && menu.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            No menu items are currently available.
          </div>
        )}

        {!loading &&
          !error &&
          categories.map((category) => (
            <section key={category} className="mb-6">
              <h2 className="mb-3 text-xl font-bold">{category}</h2>

              <div className="space-y-3">
                {menu
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-blue-100"
                    >
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <h3 className="font-bold">{item.name}</h3>

                          {item.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <span className="whitespace-nowrap font-bold">
                          ${(item.price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}

        <footer className="mt-10 text-center text-sm text-slate-500">
          Maple Street Pizza · Pickup orders available by phone
        </footer>
      </div>
    </main>
  );
}
