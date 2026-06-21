const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = localStorage.getItem("mobidf_session");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mobidf_session", sid);
  }
  return sid;
}

function getUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    const u = JSON.parse(localStorage.getItem("mobidf_user") || "{}");
    return u.nome || "";
  } catch { return ""; }
}

async function post(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  try {
    await fetch(`${BASE}/api/v1/analytics/${path}?${qs}`, { method: "POST" });
  } catch { /* silencioso — analytics não pode quebrar o app */ }
}

export function sendHeartbeat(page: string) {
  post("heartbeat", {
    session_id: getSessionId(),
    page,
    user_name: getUserName(),
  });
}

export function trackEvent(event: string, meta = "") {
  post("event", { session_id: getSessionId(), event, meta });
}

export async function fetchLiveStats(): Promise<LiveStats | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/analytics/live`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

export interface LiveStats {
  online_now: number;
  sessions_total: number;
  events_1h: number;
  events_24h: number;
  routes_1h: number;
  poi_searches_1h: number;
  qr_generated_1h: number;
  stops_searched_1h: number;
  logins_1h: number;
  pages_active: Record<string, number>;
}
