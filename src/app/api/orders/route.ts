import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESTAURANT_ID = "58b007f7-c3ed-420a-aab3-36fc8b979dc9";

function headers() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const url = `${SUPABASE_URL}/rest/v1/orders?restaurant_id=eq.${RESTAURANT_ID}&select=id,order_number,customer_name,customer_phone,status,pickup_time,total_cents,created_at,order_items(id,item_name,quantity,line_total_cents)&order=created_at.desc`;
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  const normalized = data.map((order: { order_items?: Array<{ id: string; item_name: string; quantity: number; line_total_cents: number }> }) => ({
    ...order,
    order_items: (order.order_items || []).map((item) => ({
      id: item.id,
      name: item.item_name,
      quantity: item.quantity,
      line_total_cents: item.line_total_cents,
    })),
  }));

  return NextResponse.json(normalized);
}

export async function PATCH(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const body = await request.json();
  const orderId = String(body.orderId || "");
  const status = String(body.status || "");
  const allowed = ["new", "accepted", "ready", "completed", "cancelled"];

  if (!orderId || !allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
  }

  const url = `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&restaurant_id=eq.${RESTAURANT_ID}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json(data);
}
