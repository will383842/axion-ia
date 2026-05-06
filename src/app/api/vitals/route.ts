// use-client: not needed — this is a Route Handler, not a React Component.
// Edge runtime so the beacon stays cheap and lands close to the user.
import { type NextRequest } from "next/server";

export const runtime = "edge";

interface VitalsPayload {
  id?: string;
  name?: string;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  navigationType?: string;
  url?: string;
  locale?: string;
}

export async function POST(req: NextRequest) {
  let body: VitalsPayload | null = null;
  try {
    body = (await req.json()) as VitalsPayload;
  } catch {
    return new Response(null, { status: 204 });
  }

  // Sprint 0 stub: log to console.
  // Sprint 14: forward to Plausible custom events / ClickHouse.
  if (body && process.env.NODE_ENV !== "production") {
    console.warn(
      `[web-vitals] ${body.name ?? "?"}=${body.value ?? "?"} (${body.rating ?? "?"}) on ${body.url ?? "?"}`,
    );
  }

  return new Response(null, { status: 204 });
}
