import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESTAURANT_ID = "58b007f7-c3ed-420a-aab3-36fc8b979dc9";
const RESERVATION_CUTOFF_MINUTES = 30;

function headers() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function timeToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateToDayOfWeek(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCDay();
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const requestedDate = String(body.requested_date || "").trim();
  const requestedTime = String(body.requested_time || "").trim();

  const dayOfWeek = dateToDayOfWeek(requestedDate);
  const requestedMinutes = timeToMinutes(requestedTime);

  if (dayOfWeek === null || requestedMinutes === null) {
    return NextResponse.json({
      valid: false,
      reason: "invalid_datetime",
      message: "Please provide the reservation date as YYYY-MM-DD and time as HH:MM.",
    });
  }

  const hoursUrl = `${SUPABASE_URL}/rest/v1/restaurant_hours?restaurant_id=eq.${RESTAURANT_ID}&day_of_week=eq.${dayOfWeek}&select=opens_at,closes_at,is_closed&limit=1`;
  const hoursResponse = await fetch(hoursUrl, { headers: headers(), cache: "no-store" });
  const hoursData = await hoursResponse.json();

  if (!hoursResponse.ok) {
    return NextResponse.json({ error: hoursData }, { status: hoursResponse.status });
  }

  const hours = hoursData?.[0];
  if (!hours || hours.is_closed) {
    return NextResponse.json({
      valid: false,
      reason: "closed",
      message: "The restaurant is closed on the requested date.",
    });
  }

  const opensAt = String(hours.opens_at).slice(0, 5);
  const closesAt = String(hours.closes_at).slice(0, 5);
  const openMinutes = timeToMinutes(opensAt);
  const closeMinutes = timeToMinutes(closesAt);

  if (openMinutes === null || closeMinutes === null) {
    return NextResponse.json(
      { error: "Restaurant hours are not configured correctly." },
      { status: 500 },
    );
  }

  const latestReservationMinutes = closeMinutes - RESERVATION_CUTOFF_MINUTES;
  const valid = requestedMinutes >= openMinutes && requestedMinutes <= latestReservationMinutes;

  if (!valid) {
    const latestAllowedTime = minutesToTime(latestReservationMinutes);
    return NextResponse.json({
      valid: false,
      reason: requestedMinutes < openMinutes ? "before_open" : "after_last_reservation",
      requested_time: requestedTime,
      opens_at: opensAt,
      closes_at: closesAt,
      latest_allowed_time: latestAllowedTime,
      cutoff_minutes: RESERVATION_CUTOFF_MINUTES,
      message:
        requestedMinutes < openMinutes
          ? `Reservations can start at ${opensAt}.`
          : `The latest reservation time is ${latestAllowedTime}, 30 minutes before closing at ${closesAt}.`,
    });
  }

  return NextResponse.json({
    valid: true,
    requested_date: requestedDate,
    requested_time: requestedTime,
    opens_at: opensAt,
    closes_at: closesAt,
    latest_allowed_time: minutesToTime(latestReservationMinutes),
    cutoff_minutes: RESERVATION_CUTOFF_MINUTES,
  });
}
