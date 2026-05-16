// IndexNow protocol notification endpoint (Bing / Yandex / Seznam / Naver).
// Forwards the URL list to https://api.indexnow.org/indexnow with the site
// key declared in the INDEXNOW_KEY environment variable (32-128 char hex).
// Spec: https://www.indexnow.org/documentation
//
// Sprint Correctif S+1 (P0-S1-5 2026-05-16) — Auth HMAC obligatoire :
//   Header `X-Axion-Indexnow-Signature: <hex SHA-256(secret, body)>` requis.
//   Secret env `INDEXNOW_INTERNAL_HMAC_SECRET` (≥ 32 chars).
//
// **Note** : la majorité du pipeline IndexNow utilise `src/lib/indexnow.ts`
// qui appelle directement `api.indexnow.org` (bypass de cette route, voir
// commentaire dans le helper). Cette route reste exposée pour usage manuel
// debug + tests. La signature HMAC empêche un tiers d'abuser de NOTRE
// INDEXNOW_KEY pour spammer Bing avec des URLs malveillantes.

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

const ENCODER = new TextEncoder();

async function verifyHmac(rawBody: string, signatureHex: string | null): Promise<boolean> {
  if (!signatureHex) return false;
  if (signatureHex.length !== 64) return false;
  const secret = process.env["INDEXNOW_INTERNAL_HMAC_SECRET"];
  if (!secret || secret.length < 32) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, ENCODER.encode(rawBody) as BufferSource),
  );
  const expected = Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time comparison
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-axion-indexnow-signature");
  const valid = await verifyHmac(rawBody, signature);
  if (!valid) {
    return new Response(null, { status: 401 });
  }

  let body: IndexNowPayload | null = null;
  try {
    body = JSON.parse(rawBody) as IndexNowPayload;
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
      // IndexNow.org renvoie 422 si keyLocation ne finit pas par .txt.
      // Depuis 2026-05-13, le fichier `/<key>.txt` est exposé via /public
      // + matcher proxy.ts qui exclut `.*\\.txt$` du i18n redirect.
      // L'endpoint dynamique `/api/indexnow/key` reste actif en backup
      // (utile pour debug/curl manuel) mais n'est plus le keyLocation.
      keyLocation: `https://${SITE_HOST}/${key}.txt`,
      urlList: urls,
    }),
  });

  return new Response(null, { status: upstream.status });
}
