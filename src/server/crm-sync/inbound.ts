/**
 * Événements ENTRANTS du CRM (lot L5) — consentements CRM → site.
 *
 * Le flux principal du chantier est site → CRM. Les consentements font
 * exception : ils doivent converger dans les DEUX sens, faute de quoi les deux
 * systèmes finissent par écrire des états opposés et se réécrire mutuellement
 * (plan §« Synchro BIDIRECTIONNELLE des consentements »).
 *
 * ── 🔴 ANTI-BOUCLE, la règle qui prime sur tout le reste ────────────────────
 * Un événement d'origine `crm` appliqué localement ne repart JAMAIS vers le
 * CRM. Concrètement : ce module n'importe AUCUNE fonction `sync*ToCrm`, et un
 * test l'espionne pour que cela reste vrai. La tentation existera le jour où
 * quelqu'un voudra « propager » l'effet local — c'est précisément la boucle
 * infinie que l'`origin` sert à couper.
 *
 * ── L'asymétrie assumée : l'opposition gagne toujours ───────────────────────
 * `consent_optout` et `erasure` produisent un effet local. `consent_optin`
 * n'en produit AUCUN : un opt-in venu du CRM ne doit pas pouvoir ressusciter
 * une désinscription faite sur le site, où le consentement a été recueilli et
 * où vit le registre de preuve. L'événement est consigné (`ignored`), donc
 * inspectable, mais il ne réécrit rien.
 *
 * ── La correspondance d'adresse, et pourquoi elle est ce qu'elle est ────────
 * Le CRM envoie `email_hash = sha256(email en minuscules)`, NON salé. Le site,
 * lui, indexe ses adresses avec `hashEmailForLookup` — un HMAC CLÉ
 * (`email-hash.ts`), délibérément non reversible sans le secret. Les deux
 * empreintes ne se comparent donc pas, et aucune colonne du site ne porte le
 * sha256 nu.
 *
 * Décision (documentée, pas subie) : `newsletter_subscribers.email` est stocké
 * EN CLAIR (colonne `citext`, jamais chiffrée — contrairement aux
 * submissions). Le sha256 de chaque abonné est donc calculable à la volée. On
 * balaie les abonnés ACTIFS (`confirmed`, quelques milliers au plus, deux
 * colonnes lues) plutôt que d'ajouter une colonne d'index qu'il faudrait
 * remplir, maintenir et migrer pour un flux dont le volume attendu est de
 * quelques événements par jour. Si la liste franchissait
 * `MAX_SCAN_SUBSCRIBERS`, le balayage s'arrête et l'événement est consigné
 * `no_match` — jamais un faux négatif silencieux : c'est le moment d'ajouter
 * la colonne, et le compteur le dira.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { alertCrmSync } from "./alerts";

import { crmSyncSecret } from "./config";

/** Fenêtre anti-rejeu. Au-delà, une requête interceptée est refusée. */
export const INBOUND_REPLAY_WINDOW_SEC = 300;

/**
 * Plafond du balayage d'abonnés. Volontairement large : à ce jour la liste est
 * de l'ordre du millier. C'est une borne de sécurité, pas un réglage.
 */
export const MAX_SCAN_SUBSCRIBERS = 20_000;

export type CrmInboundEventType = "consent_optout" | "consent_optin" | "erasure";
export type CrmInboundScope = "business" | "vivier";

export interface CrmInboundPayload {
  event_id: string;
  event_type: CrmInboundEventType;
  person_key?: string;
  email_hash: string;
  scope: CrmInboundScope;
  origin: "crm";
  occurred_at: string;
}

export type CrmInboundOutcome = "applied" | "no_match" | "ignored" | "duplicate";

export interface CrmInboundResult {
  ok: true;
  outcome: CrmInboundOutcome;
}

// ── Signature ───────────────────────────────────────────────────────────────

/**
 * HMAC-SHA256 de `<horodatage>.<corps brut>`, en hexadécimal.
 *
 * L'horodatage est DANS la signature, pas seulement à côté : sans lui, une
 * requête légitime interceptée resterait rejouable pour l'éternité. C'est
 * exactement le contrat que le site applique déjà dans l'autre sens
 * (`crm-sync/emit.ts`), en miroir — un seul schéma à comprendre pour les deux
 * directions.
 */
export function signInboundBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type InboundAuthFailure = "missing_secret" | "missing_headers" | "stale" | "bad_signature";

/**
 * Vérifie en-têtes + fenêtre + signature. Retourne `null` si tout est bon.
 *
 * Comparaison à temps constant : une comparaison de chaînes ordinaire fuit,
 * caractère par caractère, la longueur du préfixe correct — de quoi
 * reconstruire une signature valide en quelques milliers de requêtes.
 */
export function verifyInboundRequest(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  now?: Date;
}): InboundAuthFailure | null {
  const secret = crmSyncSecret();
  if (!secret) return "missing_secret";

  const { timestamp, signature } = input;
  if (!timestamp || !signature) return "missing_headers";

  const sent = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sent)) return "missing_headers";

  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - sent) > INBOUND_REPLAY_WINDOW_SEC) return "stale";

  const expected = signInboundBody(secret, timestamp, input.rawBody);
  if (expected.length !== signature.length) return "bad_signature";

  try {
    const ok = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    return ok ? null : "bad_signature";
  } catch {
    return "bad_signature";
  }
}

// ── Contrat du corps ────────────────────────────────────────────────────────

const EVENT_TYPES: ReadonlySet<string> = new Set(["consent_optout", "consent_optin", "erasure"]);
const SCOPES: ReadonlySet<string> = new Set(["business", "vivier"]);
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * Valide le corps à la main plutôt qu'avec Zod, pour une raison de fond : le
 * contrat est un MIROIR de l'émetteur CRM, et chaque règle ci-dessous a un
 * pendant exact de l'autre côté. Les écrire explicitement rend la comparaison
 * ligne à ligne possible entre deux dépôts qu'aucun compilateur ne relie.
 */
export function parseInboundPayload(input: unknown): CrmInboundPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const eventId = raw.event_id;
  if (typeof eventId !== "string" || eventId.length === 0 || eventId.length > 80) return null;

  const eventType = raw.event_type;
  if (typeof eventType !== "string" || !EVENT_TYPES.has(eventType)) return null;

  const emailHash = raw.email_hash;
  if (typeof emailHash !== "string" || !SHA256_HEX.test(emailHash)) return null;

  const scope = raw.scope;
  if (typeof scope !== "string" || !SCOPES.has(scope)) return null;

  // `origin` est refusé s'il ne vaut pas `crm` : un événement dont on ne peut
  // pas affirmer la provenance ne peut pas être protégé contre la boucle.
  if (raw.origin !== "crm") return null;

  const occurredAt = raw.occurred_at;
  if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) return null;

  const personKey = raw.person_key;
  if (personKey !== undefined && typeof personKey !== "string") return null;

  return {
    event_id: eventId,
    event_type: eventType as CrmInboundEventType,
    email_hash: emailHash.toLowerCase(),
    scope: scope as CrmInboundScope,
    origin: "crm",
    occurred_at: occurredAt,
    ...(typeof personKey === "string" ? { person_key: personKey } : {}),
  };
}

// ── Traitement ──────────────────────────────────────────────────────────────

/** sha256(adresse en minuscules) — le hachage NON salé que produit le CRM. */
export function sha256Email(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Applique un événement entrant. Idempotent par `event_id`.
 *
 * Ne lève jamais pour un doublon : un émetteur qui retente après un timeout a
 * raison de retenter, et doit obtenir un succès. C'est la définition même de
 * l'idempotence — pas une tolérance, un contrat.
 */
export async function processInboundEvent(payload: CrmInboundPayload): Promise<CrmInboundResult> {
  // Idempotence : la contrainte UNIQUE sur `event_id` porte la garantie, ce
  // pré-contrôle n'est qu'un raccourci. Deux livraisons simultanées passeront
  // toutes les deux ici, et c'est la base qui tranchera (cf. le catch plus bas).
  const existing = await prisma.crmInboundEvent.findUnique({
    where: { eventId: payload.event_id },
    select: { id: true },
  });
  if (existing) return { ok: true, outcome: "duplicate" };

  const outcome = await applyEffect(payload);

  try {
    await prisma.crmInboundEvent.create({
      data: {
        eventId: payload.event_id,
        eventType: payload.event_type,
        emailHash: payload.email_hash,
        scope: payload.scope,
        // `Prisma.InputJsonValue` n'accepte pas un `Record<string, unknown>`
        // (une valeur `unknown` pourrait être une fonction). Le corps est
        // pourtant du JSON par construction — il vient d'un `JSON.parse` — d'où
        // ce passage par `object`, qui dit exactement cela au compilateur.
        payload: payload as unknown as object,
        processedAt: new Date(),
        outcome,
      },
    });
  } catch (error) {
    // Course entre deux livraisons du même événement : la seconde viole
    // l'unicité (P2002). L'effet local étant idempotent, la bonne réponse est
    // un succès. MAIS seulement pour P2002 : une panne DB transitoire déguisée
    // en « doublon » renverrait 200 à l'émetteur — l'événement ne serait
    // JAMAIS consigné et jamais retenté (défaut relevé en revue adversariale).
    const isUniqueViolation =
      typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
    if (isUniqueViolation) {
      return { ok: true, outcome: "duplicate" };
    }
    console.error(
      "[crm-sync][entrant] écriture du journal en échec (l'émetteur retentera):",
      error,
    );
    throw error;
  }

  return { ok: true, outcome };
}

async function applyEffect(payload: CrmInboundPayload): Promise<CrmInboundOutcome> {
  // 🔴 L'opposition gagne toujours : seules les oppositions agissent. Un
  // opt-in venu du CRM ne ressuscite jamais une désinscription faite ici.
  if (payload.event_type === "consent_optin") return "ignored";

  // Le vivier candidats n'a pas d'équivalent « abonné » côté site : rien à
  // répercuter aujourd'hui. L'événement est conservé pour la preuve.
  if (payload.scope !== "business") return "ignored";

  const subscriberId = await findSubscriberIdByHash(payload.email_hash);
  if (!subscriberId) return "no_match";

  await prisma.newsletterSubscriber.update({
    where: { id: subscriberId },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  });

  return "applied";
}

/**
 * Retrouve un abonné par sha256 non salé de son adresse.
 *
 * Un balayage, assumé : cf. l'en-tête du module. On ne regarde que les abonnés
 * ACTIFS (`confirmed`) — désinscrire un abonné déjà `unsubscribed` ne changerait
 * rien, et `pending` n'a jamais confirmé, donc n'est abonné à rien.
 */
export async function findSubscriberIdByHash(emailHash: string): Promise<string | null> {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: "confirmed" },
    select: { id: true, email: true },
    // Ordre STABLE : sans lui, le sous-ensemble tronqué au plafond serait
    // non déterministe — le même optout pourrait alterner match/no_match.
    orderBy: { id: "asc" },
    take: MAX_SCAN_SUBSCRIBERS,
  });

  const target = emailHash.toLowerCase();
  for (const sub of subscribers) {
    if (sha256Email(sub.email) === target) return sub.id;
  }

  if (subscribers.length >= MAX_SCAN_SUBSCRIBERS) {
    // Ne PAS taire : au-delà du plafond, un `no_match` cesse d'être une
    // information fiable — un optout raté en silence est exactement le genre
    // d'échec que ce lot existe pour rendre VISIBLE. Alerte Telegram (kind
    // dédié, anti-bruit horaire) en plus du log : un warn que personne ne
    // lit n'est pas un signal (leçon fondatrice).
    console.warn(
      `[crm-sync][entrant] balayage plafonné à ${MAX_SCAN_SUBSCRIBERS} abonnés — ` +
        "la correspondance par empreinte n'est plus exhaustive.",
    );
    await alertCrmSync({
      kind: "scan_capped",
      detail: `Balayage plafonné à ${MAX_SCAN_SUBSCRIBERS} abonnés confirmés : un optout CRM peut être raté. Poser une colonne d'empreinte indexée.`,
    });
  }

  return null;
}
