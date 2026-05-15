/**
 * Google Indexing API client — OAuth refresh token flow (cohérent gsc-client).
 *
 * Activation 2026-05-15. Pattern OAuth refresh_token réutilise le même client
 * OAuth Desktop que GSC (projet GCP `axion-ia-seo`, client ID partagé). Les
 * 3 env vars communes :
 *
 *  - `GSC_OAUTH_CLIENT_ID` (partagé)
 *  - `GSC_OAUTH_CLIENT_SECRET` (partagé)
 *  - `INDEXING_OAUTH_REFRESH_TOKEN` (dédié — scope `auth/indexing`)
 *
 * Pas de SDK `googleapis` requis — 2 endpoints HTTP suffisent.
 *
 * Cache access_token in-memory 55 min (sous TTL Google 1h).
 *
 * **LIMITE OFFICIELLE GOOGLE** : Indexing API n'accepte que `JobPosting` et
 * `BroadcastEvent` schema.org. Pour les autres types (Article, FAQ), Google
 * retourne 200 mais ne fait rien. IndexNow couvre Bing/Yandex/Naver/Seznam
 * en parallèle (cf. content-indexnow-worker).
 *
 * Doc : <https://developers.google.com/search/apis/indexing-api/v3/quickstart>
 */

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAt: number;
}

let cachedToken: CachedAccessToken | null = null;

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const INDEXING_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env["GSC_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GSC_OAUTH_CLIENT_SECRET"];
  const refreshToken = process.env["INDEXING_OAUTH_REFRESH_TOKEN"];

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Indexing OAuth credentials missing — set GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, INDEXING_OAUTH_REFRESH_TOKEN",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Indexing OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Indexing OAuth response missing access_token");
  }

  const ttlMs = (data.expires_in ?? 3600) * 1000 - 5 * 60_000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + ttlMs };
  return data.access_token;
}

/**
 * Publish une URL à l'Indexing API Google.
 *
 * @param url Pleine URL HTTPS du contenu à signaler (ex: https://axion-ia.com/fr/actualites/abc)
 * @param type `URL_UPDATED` (push update) ou `URL_DELETED` (page supprimée)
 * @returns true si Google a accepté (200/204), false si erreur (worker continue)
 */
export async function indexingPublishUrl(
  url: string,
  type: "URL_UPDATED" | "URL_DELETED",
): Promise<boolean> {
  if (
    !process.env["GSC_OAUTH_CLIENT_ID"] ||
    !process.env["GSC_OAUTH_CLIENT_SECRET"] ||
    !process.env["INDEXING_OAUTH_REFRESH_TOKEN"]
  ) {
    return false;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error("[indexing-client] OAuth refresh failed:", err);
    return false;
  }

  const res = await fetch(INDEXING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[indexing-client] publish failed for ${url}: ${res.status} ${text.slice(0, 200)}`,
    );
    return false;
  }

  return true;
}

/** True si OAuth credentials sont set (helper pour worker check). */
export function isIndexingApiReady(): boolean {
  return Boolean(
    process.env["GSC_OAUTH_CLIENT_ID"] &&
    process.env["GSC_OAUTH_CLIENT_SECRET"] &&
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"],
  );
}
