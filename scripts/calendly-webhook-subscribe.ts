/**
 * Crée l'abonnement webhook Calendly (2026-08-09).
 *
 *     pnpm calendly:webhook:subscribe
 *
 * À lancer UNE SEULE FOIS, le jour où le plan Calendly passe en Standard.
 * Vérifié le 2026-08-09 : les abonnements webhook exigent Standard, Teams ou
 * Enterprise — le plan gratuit renvoie 403 sur cet appel.
 *
 * Le script affiche la `signing_key` renvoyée par Calendly. ⚠️ Elle n'est
 * montrée QU'UNE FOIS, à la création : la poser immédiatement dans Coolify sous
 * `CALENDLY_WEBHOOK_SIGNING_KEY` (application WEB — le worker n'en a pas besoin,
 * il ne reçoit pas de requêtes HTTP). Perdue, il faut supprimer l'abonnement et
 * en recréer un.
 *
 * Idempotent : si un abonnement pointe déjà vers la même URL, le script le
 * signale et ne crée rien — relancer ne fabrique pas de doublon (qui, lui,
 * produirait deux livraisons par réservation).
 *
 * Variables requises : CALENDLY_API_TOKEN, NEXT_PUBLIC_SITE_URL.
 */

import { CALENDLY_API_BASE } from "@/server/calendly/api";

const token = process.env.CALENDLY_API_TOKEN?.trim();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/+$/, "");
const callbackUrl = `${siteUrl}/api/calendly/webhook`;

/** Les deux seuls types traités par la route — cf. `api/calendly/webhook/route.ts`. */
const EVENTS = ["invitee.created", "invitee.canceled"] as const;

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path.startsWith("http") ? path : `${CALENDLY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Corps vide ou non-JSON (204, 502…) — le statut suffit à décider.
  }
  return { status: res.status, body };
}

function record(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

async function main(): Promise<void> {
  if (!token) {
    console.error("✗ CALENDLY_API_TOKEN absent. Rien n'a été fait.");
    process.exit(1);
  }

  // 1. Qui suis-je ? L'abonnement se crée dans la portée d'une organisation.
  const me = await api("/users/me");
  const resource = record(record(me.body)?.["resource"]);
  const userUri = typeof resource?.["uri"] === "string" ? resource["uri"] : null;
  const orgUri =
    typeof resource?.["current_organization"] === "string"
      ? resource["current_organization"]
      : null;
  if (!userUri || !orgUri) {
    console.error(`✗ /users/me a répondu ${me.status} — jeton invalide ou révoqué ?`);
    process.exit(1);
  }

  // 2. Un abonnement pointe-t-il déjà vers cette URL ?
  const existing = await api(
    `/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}` +
      `&user=${encodeURIComponent(userUri)}&scope=user&count=100`,
  );
  const collection = record(existing.body)?.["collection"];
  if (Array.isArray(collection)) {
    const already = collection.find((c) => record(c)?.["callback_url"] === callbackUrl);
    if (already) {
      console.log(`✓ Un abonnement existe déjà pour ${callbackUrl} — rien à faire.`);
      console.log(`  URI : ${record(already)?.["uri"]}`);
      console.log(
        "\n  ⚠️ La signing_key n'est PAS re-consultable. Si elle a été perdue,\n" +
          "     supprimer cet abonnement puis relancer ce script.",
      );
      return;
    }
  }

  // 3. Création.
  const created = await api("/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      url: callbackUrl,
      events: EVENTS,
      organization: orgUri,
      user: userUri,
      scope: "user",
    }),
  });

  if (created.status === 403) {
    console.error(
      "✗ 403 — le plan Calendly ne permet pas les webhooks.\n" +
        "  Ils exigent Standard, Teams ou Enterprise. Le plan gratuit n'y a pas droit.\n" +
        "  Rien n'a changé ; le sondage BullMQ (≤ 60 s) reste en place.",
    );
    process.exit(1);
  }
  if (created.status !== 201) {
    console.error(`✗ Création refusée (HTTP ${created.status}) :`);
    console.error(JSON.stringify(created.body, null, 2));
    process.exit(1);
  }

  const sub = record(record(created.body)?.["resource"]);
  console.log("✓ Abonnement créé.");
  console.log(`  URI    : ${sub?.["uri"]}`);
  console.log(`  URL    : ${callbackUrl}`);
  console.log(`  Events : ${EVENTS.join(", ")}`);
  console.log("\n──────────────────────────────────────────────────────────────");
  console.log("  CALENDLY_WEBHOOK_SIGNING_KEY=" + String(sub?.["signing_key"] ?? "(absente)"));
  console.log("──────────────────────────────────────────────────────────────");
  console.log(
    "\n  ⚠️ Cette clé ne sera PLUS JAMAIS affichée.\n" +
      "     La poser maintenant dans Coolify → application WEB → Env vars (scope RUN),\n" +
      "     puis redémarrer le conteneur. La route s'activera d'elle-même.",
  );
}

void main().catch((e: unknown) => {
  console.error("✗ Échec inattendu :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
