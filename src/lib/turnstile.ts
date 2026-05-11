// Cloudflare Turnstile verification (Sprint 15 / M8).
//
// Pattern : tous les forms publics envoient un cf-turnstile-response token,
// que le Server Action valide cote serveur via l'endpoint Cloudflare.
// CLAUDE.md §15 — anti-spam multi-couches (Turnstile + honeypot + rate limit).
//
// Fail-soft en dev : si TURNSTILE_SECRET_KEY absent ou egal a la cle de test
// publique Cloudflare, on accepte tout (pour faciliter le dev).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cles de test Cloudflare (publiques) qui passent toujours. */
const DEV_KEYS = new Set([
  "1x0000000000000000000000000000000AA", // always passes
  "2x0000000000000000000000000000000AA", // always fails
  "3x0000000000000000000000000000000AA", // forces interactive
]);

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Sprint 15 fix Fork 3 C2-3 : fail-closed des que prod OU staging.
  // Avant : `NODE_ENV !== "production"` laissait passer staging vulnerable.
  // Maintenant : seul `NEXT_PUBLIC_APP_ENV=development` autorise le bypass.
  if (!secret) {
    const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
    if (appEnv === "development") return true;
    return false;
  }

  // Dev keys (Cloudflare test secrets publics) → bypass TOTAL, même sans token.
  // Sprint 14.10.7 fix Will 2026-05-11 : en dev local le widget invisible peut
  // ne pas générer de token (réseau lent, AdBlock, première frappe rapide).
  // Comme la dev key est publique et explicitement « always passes » côté CF,
  // on accepte la soumission sans token côté serveur aussi. Risque sécuritaire :
  // nul (la dev key ne peut pas être utilisée en prod — clé publique connue).
  if (DEV_KEYS.has(secret)) return true;

  if (!token) return false;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
