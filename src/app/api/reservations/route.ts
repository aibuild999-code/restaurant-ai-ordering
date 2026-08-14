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

  const url = `${SUPABASE_URL}/rest/v1/reservation_requests?restaurant_id=eq.${RESTAURANT_ID}&select=id,restaurant_id,customer_name,customer_phone,party_size,requested_date,requested_time,status,proposed_date,proposed_time,customer_response,notes,created_at,updated_at&order=created_at.desc`;
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const body = await request.json();
  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const partySize = Number(body.party_size);
  const requestedDate = String(body.requested_date || "").trim();
  const requestedTime = String(body.requested_time || "").trim();

  if (!customerName || !customerPhone || !Number.isInteger(partySize) || partySize < 1 || partySize > 50 || !requestedDate || !requestedTime) {
    return NextResponse.json({ error: "customer_name, customer_phone, party_size, requested_date, and requested_time are required." }, { status: 400 });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reservation_requests`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({
      restaurant_id: RESTAURANT_ID,
      customer_name: customerName,
      customer_phone: customerPhone,
      party_size: partySize,
      requested_date: requestedDate,
      requested_time: requestedTime,
      status: "pending",
      notes: body.notes ? String(body.notes) : null,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json(Array.isArray(data) ? data[0] : data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const body = await request.json();
  const reservationId = String(body.reservation_id || "").trim();
  const status = String(body.status || "").trim();
  const allowed = ["pending", "approved", "alternative_proposed", "customer_confirmed", "customer_declined", "cancelled", "completed"];

  if (!reservationId || !allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid reservation update." }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };

  if (body.proposed_date !== undefined) update.proposed_date = body.proposed_date || null;
  if (body.proposed_time !== undefined) update.proposed_time = body.proposed_time || null;
  if (body.customer_response !== undefined) update.customer_response = body.customer_response || null;
  if (body.notes !== undefined) update.notes = body.notes || null;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reservation_requests?id=eq.${encodeURIComponent(reservationId)}&restaurant_id=eq.${RESTAURANT_ID}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(update),
  });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json(data);
}
