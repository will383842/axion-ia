// IndexNow protocol notification endpoint (Bing/Yandex).
// Sprint 14 wires the actual ping after build; Sprint 0 stub returns 204.

export const runtime = "edge";

interface IndexNowPayload {
  host?: string;
  key?: string;
  urlList?: string[];
}

export async function POST(req: Request) {
  let body: IndexNowPayload | null = null;
  try {
    body = (await req.json()) as IndexNowPayload;
  } catch {
    return new Response(null, { status: 400 });
  }
  // Stub — Sprint 14 will forward to https://api.indexnow.org/indexnow
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[indexnow] stub received ${body?.urlList?.length ?? 0} url(s)`);
  }
  return new Response(null, { status: 202 });
}
