import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESTAURANT_ID = "58b007f7-c3ed-420a-aab3-36fc8b979dc9";

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const url = `${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${RESTAURANT_ID}&is_available=eq.true&select=id,name,description,price_cents,sort_order,menu_categories(name)&order=sort_order.asc,name.asc`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data }, { status: response.status });

  return NextResponse.json(data.map((item: { id: string; name: string; description: string | null; price_cents: number; sort_order: number; menu_categories?: { name: string } | null }) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price_cents: item.price_cents,
    category: item.menu_categories?.name || "Other",
    sort_order: item.sort_order,
  })));
}
