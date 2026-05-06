// IndexNow protocol notification endpoint (Bing / Yandex / Seznam / Naver).
// Forwards the URL list to https://api.indexnow.org/indexnow with the site
// key declared in the INDEXNOW_KEY environment variable (32-128 char hex).
// Spec: https://www.indexnow.org/documentation

export const runtime = "edge";

interface IndexNowPayload {
  host?: string;
  key?: string;
  urlList?: string[];
}

const ENDPOINT = "https://api.indexnow.org/indexnow";

const SITE_HOST = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(
  /^https?:\/\//,
  "",
);

export async function POST(req: Request) {
  let body: IndexNowPayload | null = null;
  try {
    body = (await req.json()) as IndexNowPayload;
  } catch {
    return new Response(null, { status: 400 });
  }
  const urls = body?.urlList?.filter((u) => typeof u === "string") ?? [];
  if (urls.length === 0) return new Response(null, { status: 400 });

  const key = process.env["INDEXNOW_KEY"];
  if (!key) {
    // Soft-fail in non-prod: log and 202 so callers don't break.
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(`[indexnow] INDEXNOW_KEY missing — would forward ${urls.length} url(s)`);
    }
    return new Response(null, { status: 202 });
  }

  const upstream = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: body?.host ?? SITE_HOST,
      key,
      keyLocation: `https://${SITE_HOST}/${key}.txt`,
      urlList: urls,
    }),
  });

  return new Response(null, { status: upstream.status });
}
