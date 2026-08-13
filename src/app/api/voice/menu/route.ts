import { NextResponse } from "next/server";
import { RESTAURANT_ID } from "@/lib/voice-auth";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  const url = `${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${RESTAURANT_ID}&is_available=eq.true&select=id,name,description,price_cents,menu_categories(name),menu_item_modifiers(modifier_id,is_required,modifiers(id,name,price_delta_cents,is_available))&order=sort_order.asc,name.asc`;
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json({
    restaurant_id: RESTAURANT_ID,
    items: data,
  });
}
