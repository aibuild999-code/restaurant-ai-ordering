import { NextRequest, NextResponse } from "next/server";
import { isVoiceAgentAuthorized, RESTAURANT_ID } from "@/lib/voice-auth";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MenuItem = {
  id: string;
  name: string;
  price_cents: number;
};

type Modifier = {
  id: string;
  name: string;
  price_delta_cents: number;
};

function headers(prefer?: string) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function supabase(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers || {}),
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isVoiceAgentAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const customerName = String(body.customer_name || "").trim();
  const customerPhone = body.customer_phone ? String(body.customer_phone).trim() : "";
  const notes = body.notes ? String(body.notes).trim() : null;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName) return NextResponse.json({ error: "customer_name is required." }, { status: 400 });
  if (!customerPhone) return NextResponse.json({ error: "customer_phone is required." }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: "At least one item is required." }, { status: 400 });
  if (items.length > 20) return NextResponse.json({ error: "Too many order lines." }, { status: 400 });

  const normalizedItems = items.map((item: any) => ({
    menu_item_id: String(item.menu_item_id || ""),
    quantity: Number(item.quantity),
    modifier_ids: Array.isArray(item.modifier_ids) ? item.modifier_ids.map(String) : [],
    notes: item.notes ? String(item.notes).trim() : null,
  }));

  if (normalizedItems.some((item: any) => !item.menu_item_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return NextResponse.json({ error: "Each item needs a valid menu_item_id and quantity." }, { status: 400 });
  }

  const uniqueMenuIds: string[] = [...new Set<string>(normalizedItems.map((item: any) => item.menu_item_id))];
  const menuFilter = uniqueMenuIds.map((id: string) => encodeURIComponent(id)).join(",");
  const menuResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${RESTAURANT_ID}&is_available=eq.true&id=in.(${menuFilter})&select=id,name,price_cents`,
    { headers: headers() },
  );
  const menuItems: MenuItem[] = (await menuResponse.json()) as MenuItem[];
  if (!menuResponse.ok) return NextResponse.json({ error: menuItems }, { status: menuResponse.status });

  const menuMap = new Map<string, MenuItem>(menuItems.map((item: MenuItem) => [item.id, item]));
  if (menuMap.size !== uniqueMenuIds.length) {
    return NextResponse.json({ error: "One or more requested menu items are unavailable or do not exist." }, { status: 400 });
  }

  const modifierIds: string[] = [...new Set<string>(normalizedItems.flatMap((item: any) => item.modifier_ids as string[]))];
  let modifierMap = new Map<string, Modifier>();
  if (modifierIds.length) {
    const modifierFilter = modifierIds.map((id: string) => encodeURIComponent(id)).join(",");
    const modifierResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/modifiers?restaurant_id=eq.${RESTAURANT_ID}&is_available=eq.true&id=in.(${modifierFilter})&select=id,name,price_delta_cents`,
      { headers: headers() },
    );
    const modifiers: Modifier[] = (await modifierResponse.json()) as Modifier[];
    if (!modifierResponse.ok) return NextResponse.json({ error: modifiers }, { status: modifierResponse.status });
    modifierMap = new Map<string, Modifier>(modifiers.map((modifier: Modifier) => [modifier.id, modifier]));
    if (modifierMap.size !== modifierIds.length) {
      return NextResponse.json({ error: "One or more requested modifiers are unavailable or do not exist." }, { status: 400 });
    }
  }

  const calculatedItems = normalizedItems.map((item: any) => {
    const menu = menuMap.get(item.menu_item_id);
    if (!menu) throw new Error("Menu item validation failed.");

    const modifiers: Modifier[] = item.modifier_ids.map((id: string) => {
      const modifier = modifierMap.get(id);
      if (!modifier) throw new Error("Modifier validation failed.");
      return modifier;
    });

    const unitPrice = menu.price_cents + modifiers.reduce((sum: number, modifier: Modifier) => sum + modifier.price_delta_cents, 0);
    return {
      ...item,
      item_name: menu.name,
      unit_price_cents: unitPrice,
      line_total_cents: unitPrice * item.quantity,
      modifiers,
    };
  });

  const totalCents = calculatedItems.reduce((sum: number, item: any) => sum + item.line_total_cents, 0);

  const restaurantResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurants?id=eq.${RESTAURANT_ID}&select=pickup_minutes`,
    { headers: headers() },
  );
  const restaurants = await restaurantResponse.json() as Array<{ pickup_minutes?: number }>;
  const pickupMinutes = Number(restaurants?.[0]?.pickup_minutes ?? 20);
  const pickupTime = new Intl.DateTimeFormat("en-US", {   timeZone: "America/Toronto",   dateStyle: "short",   timeStyle: "short", }).format(new Date(Date.now() + pickupMinutes * 60_000));

  const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: headers("return=representation"),
    body: JSON.stringify({
      restaurant_id: RESTAURANT_ID,
      customer_name: customerName,
      customer_phone: customerPhone,
      status: "new",
      pickup_time: pickupTime,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      source: "phone_ai",
      notes,
    }),
  });
  const orders = await orderResponse.json() as Array<{ id: string; order_number: number }>;
  if (!orderResponse.ok || !orders?.[0]) return NextResponse.json({ error: orders }, { status: orderResponse.status || 500 });

  const order = orders[0];
  const orderItemResponse = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
    method: "POST",
    headers: headers("return=representation"),
    body: JSON.stringify(calculatedItems.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
      notes: item.notes,
    }))),
  });
  const createdOrderItems = await orderItemResponse.json() as Array<{ id: string }>;

  if (!orderItemResponse.ok || createdOrderItems.length !== calculatedItems.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: "DELETE",
      headers: headers(),
    });
    return NextResponse.json({ error: createdOrderItems }, { status: orderItemResponse.status });
  }

  const modifierRows: Array<{
    order_item_id: string;
    modifier_id: string;
    modifier_name: string;
    price_delta_cents: number;
  }> = [];

  calculatedItems.forEach((item: any, index: number) => {
    const created = createdOrderItems[index];
    item.modifiers.forEach((modifier: Modifier) => {
      modifierRows.push({
        order_item_id: created.id,
        modifier_id: modifier.id,
        modifier_name: modifier.name,
        price_delta_cents: modifier.price_delta_cents,
      });
    });
  });

  if (modifierRows.length) {
    const modifierResponse = await fetch(`${SUPABASE_URL}/rest/v1/order_item_modifiers`, {
      method: "POST",
      headers: headers("return=representation"),
      body: JSON.stringify(modifierRows),
    });
    if (!modifierResponse.ok) {
      const modifierError = await modifierResponse.json();

      await fetch(`${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${encodeURIComponent(order.id)}`, {
        method: "DELETE",
        headers: headers(),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: "DELETE",
        headers: headers(),
      });

      return NextResponse.json({ error: modifierError }, { status: modifierResponse.status });
    }
  }

  return NextResponse.json({
    success: true,
    order_number: order.order_number,
    order_id: order.id,
    customer_name: customerName,
    customer_phone: customerPhone,
    total_cents: totalCents,
    pickup_time: pickupTime,
    items: calculatedItems.map((item: any) => ({
      name: item.item_name,
      quantity: item.quantity,
      line_total_cents: item.line_total_cents,
      modifiers: item.modifiers.map((modifier: Modifier) => modifier.name),
    })),
  }, { status: 201 });
}
