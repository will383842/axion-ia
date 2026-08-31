/**
 * Crée l'abonnement webhook Calendly (2026-08-09).
 *
 *     pnpm calendly:webhook:subscribe
 *
 * À lancer UNE SEULE FOIS, le jour où le plan Calendly passe en Standard.
 * Vérifié le 2026-08-09 : les abonnements webhook exigent Standard, Teams ou
 * Enterprise — le plan gratuit renvoie 403 sur cet appel.
 *
 * 🔴 CALENDLY NE GÉNÈRE PAS LA CLÉ DE SIGNATURE — corrigé le 2026-08-31.
 *
 * Ce script attendait un champ `signing_key` dans la réponse de création. Il
 * n'y en a jamais. Mesuré en production : l'abonnement se créait bien (201),
 * puis le script affichait `CALENDLY_WEBHOOK_SIGNING_KEY=(absente)` — donc un
 * abonnement vivant, et aucune clé pour vérifier ses livraisons. La route
 * refusait alors tout ce qu'elle recevait, silencieusement.
 *
 * C'est l'APPELANT qui fournit la clé, dans le corps du POST. Le script en
 * fabrique donc une (24 octets aléatoires, en hexadécimal) et la transmet à la
 * création — sauf si `CALENDLY_WEBHOOK_SIGNING_KEY` est déjà posée dans
 * l'environnement, auquel cas il réutilise celle-là, pour qu'un abonnement
 * recréé reste vérifiable sans rien changer dans Coolify.
 *
 * Calendly ne la re-montre jamais. ⚠️ Elle n'est
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
import { randomBytes } from "node:crypto";

const token = process.env.CALENDLY_API_TOKEN?.trim();

/**
 * La clé de signature transmise à Calendly.
 *
 * Reprise de l'environnement quand elle y est — recréer un abonnement ne doit
 * pas obliger à toucher Coolify — et fabriquée sinon. 24 octets aléatoires : la
 * signature est un HMAC-SHA256, dont la clé n'a aucun intérêt à être plus courte
 * que son empreinte.
 */
const signingKey =
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || randomBytes(24).toString("hex");
const cleReprise = Boolean(process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim());
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/+$/, "");
const callbackUrl = `${siteUrl}/api/calendly/webhook`;

/**
 * Les seuls types traités par la route — cf. `api/calendly/webhook/route.ts`.
 *
 * `invitee_no_show.created` a été ajouté le 2026-08-18 : sans lui, une absence
 * cochée dans l'agenda n'arrivait que par le sondage (≤ 10 min), voire jamais si
 * elle tombait hors de la fenêtre de rattrapage.
 *
 * ⚠️ Un abonnement DÉJÀ créé garde la liste d'évènements qu'il avait à sa
 * création, et ce script ne la met PAS à jour : il détecte l'abonnement existant
 * et s'arrête (étape 2). Pour livrer un type ajouté ici, il faut SUPPRIMER
 * l'abonnement côté Calendly puis relancer. La clé de signature, elle, est
 * reprise de l'environnement si elle y est : il n'y a alors rien à reposer
 * dans Coolify.
 *
 * ℹ️ Le plan Calendly est « standard » (payant) depuis le 2026-08-31 — mesuré,
 * pas supposé. La phrase « plan gratuit, rien à faire » qui figurait ici est
 * donc caduque : les webhooks sont désormais disponibles.
 */
const EVENTS = ["invitee.created", "invitee.canceled", "invitee_no_show.created"] as const;

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

/**
 * Portées réclamées par Calendly dans le corps d'un 403, ou `null` si le corps
 * n'en mentionne aucune.
 *
 * C'est ce qui distingue « ton JETON est trop étroit » (régénérer le jeton,
 * gratuit) de « ton PLAN n'y a pas droit » (payer). Les deux rendent 403 ;
 * seul le corps tranche, et il porte alors `required_scopes`.
 */
function portéesManquantes(body: unknown): string[] | null {
  const brut = record(body)?.["required_scopes"];
  if (!Array.isArray(brut)) return null;
  const portees = brut.filter((s): s is string => typeof s === "string");
  return portees.length > 0 ? portees : null;
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
  // 🔑 Ne PAS sauter cette garde en silence (corrigé 2026-08-31). Quand le GET
  // échoue — typiquement 403 faute de portée `webhooks:read` —, `collection`
  // n'est pas un tableau, la recherche de doublon était simplement ignorée et
  // l'exécution tombait sur le POST. L'idempotence annoncée en tête de fichier
  // (« deux livraisons par réservation ») n'était donc pas assurée, sans qu'un
  // seul mot ne le dise.
  if (existing.status !== 200) {
    const portees = portéesManquantes(existing.body);
    if (portees) {
      console.error(
        `✗ 403 — le JETON n'a pas la portée requise : ${portees.join(", ")}.\n` +
          "  Ce n'est PAS une limite de plan : c'est le jeton qui est trop étroit.\n" +
          "  Régénérer un jeton personnel Calendly incluant `webhooks:read` ET\n" +
          "  `webhooks:write`, le poser dans CALENDLY_API_TOKEN, puis relancer.\n" +
          "  Rien n'a changé ; le sondage BullMQ (≤ 60 s) reste en place.",
      );
      process.exit(1);
    }
    console.error(
      `✗ Impossible de LIRE les abonnements existants (HTTP ${existing.status}).\n` +
        "  On s'arrête ici volontairement : créer sans avoir pu vérifier\n" +
        "  risquerait un DOUBLON, donc deux livraisons par réservation.",
    );
    console.error(JSON.stringify(existing.body, null, 2));
    process.exit(1);
  }
  const collection = record(existing.body)?.["collection"];
  if (Array.isArray(collection)) {
    const already = collection.find((c) => record(c)?.["callback_url"] === callbackUrl);
    if (already) {
      console.log(`✓ Un abonnement existe déjà pour ${callbackUrl} — rien à faire.`);
      console.log(`  URI : ${record(already)?.["uri"]}`);
      console.log(
        cleReprise
          ? "\n  ℹ️ CALENDLY_WEBHOOK_SIGNING_KEY est posée dans l'environnement :\n" +
              "     c'est elle qui vérifie les livraisons de cet abonnement."
          : "\n  ⚠️ Aucune CALENDLY_WEBHOOK_SIGNING_KEY dans l'environnement, et\n" +
              "     Calendly ne la re-montre pas. Les livraisons de cet abonnement ne\n" +
              "     peuvent donc PAS être vérifiées : supprimer cet abonnement côté\n" +
              "     Calendly, puis relancer ce script pour en fabriquer une.",
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
      // 🔑 C'est NOUS qui la posons. Calendly n'en génère pas.
      signing_key: signingKey,
    }),
  });

  if (created.status === 403) {
    // 🔑 NE PAS imputer au plan un 403 qu'on n'a pas lu (corrigé 2026-08-31).
    // Ce bloc traduisait TOUT 403 par « le plan Calendly ne permet pas les
    // webhooks ». Mesuré en production le 2026-08-31, le 403 réellement rendu
    // était un défaut de PORTÉE du jeton (`required_scopes: ["webhooks:read"]`,
    // le jeton n'ayant que `event_types:read scheduled_events:read users:read`).
    // Souscrire à Standard aurait reproduit le message à l'identique : un
    // diagnostic qui nomme une cause qu'il n'a pas mesurée coûte un abonnement.
    const portees = portéesManquantes(created.body);
    if (portees) {
      console.error(
        `✗ 403 — le JETON n'a pas la portée requise : ${portees.join(", ")}.\n` +
          "  Ce n'est PAS une limite de plan. Régénérer un jeton personnel\n" +
          "  Calendly incluant `webhooks:read` ET `webhooks:write`, le poser\n" +
          "  dans CALENDLY_API_TOKEN, puis relancer ce script.\n" +
          "  Rien n'a changé ; le sondage BullMQ (≤ 60 s) reste en place.",
      );
      process.exit(1);
    }
    console.error(
      "✗ 403 — création refusée, et le corps ne mentionne aucune portée manquante.\n" +
        "  C'est alors vraisemblablement une limite de PLAN (les webhooks exigent\n" +
        "  Standard, Teams ou Enterprise). Corps exact ci-dessous — le lire AVANT\n" +
        "  de souscrire quoi que ce soit.\n" +
        "  Rien n'a changé ; le sondage BullMQ (≤ 60 s) reste en place.",
    );
    console.error(JSON.stringify(created.body, null, 2));
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
  // On affiche la clé qu'on a ENVOYÉE, pas un champ de la réponse : Calendly
  // ne renvoie pas la clé de signature, et lire son absence a déjà coûté un
  // abonnement muet (voir l'en-tête de ce fichier).
  console.log("  CALENDLY_WEBHOOK_SIGNING_KEY=" + signingKey);
  console.log("──────────────────────────────────────────────────────────────");
  console.log(
    cleReprise
      ? "\n  Clé REPRISE de l'environnement : rien à changer dans Coolify."
      : "\n  Clé FABRIQUÉE par ce script, et Calendly ne la re-montrera pas.\n" +
          "     La poser maintenant dans Coolify, application WEB, Env vars (scope RUN),\n" +
          "     puis redémarrer le conteneur. La route s'activera d'elle-même.",
  );
}

void main().catch((e: unknown) => {
  console.error("✗ Échec inattendu :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
