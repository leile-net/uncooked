import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = req.headers.get("x-device-secret");
  if (!secret) return json({ error: "missing device secret" }, 401);

  let body: {
    tray_down?: boolean;
    phone_present?: boolean;
    timer_running?: boolean;
    remaining_ms?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const trayDown = body.tray_down === true;
  const phonePresent = body.phone_present === true;
  const timerRunning = body.timer_running === true;
  const remainingMs = Number.isFinite(body.remaining_ms) ? Math.max(0, Math.floor(body.remaining_ms ?? 0)) : 0;
  const uncooking = trayDown && phonePresent && timerRunning;

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: device, error: deviceError } = await admin
    .from("devices")
    .select("user_id")
    .eq("secret", secret)
    .maybeSingle();

  if (deviceError || !device) return json({ error: "unknown device" }, 401);

  const userId = device.user_id;
  const now = new Date().toISOString();

  const { error: statusError } = await admin.from("device_status").upsert({
    user_id: userId,
    tray_down: trayDown,
    phone_present: phonePresent,
    timer_running: timerRunning,
    remaining_ms: uncooking ? remainingMs : 0,
    updated_at: now,
  });
  if (statusError) return json({ error: statusError.message }, 500);

  const { data: openSession, error: openError } = await admin
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (openError) return json({ error: openError.message }, 500);

  if (uncooking && !openSession) {
    const { error } = await admin.from("sessions").insert({ user_id: userId, started_at: now });
    if (error && error.code !== "23505") return json({ error: error.message }, 500);
  } else if (!uncooking && openSession) {
    const { error } = await admin.from("sessions").update({ ended_at: now }).eq("id", openSession.id);
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, uncooking });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
