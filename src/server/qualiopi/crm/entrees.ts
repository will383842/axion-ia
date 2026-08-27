/**
 * Qualiopi — Entrées récentes (pont appel/contact → CRM, Lot 3).
 *
 * Fusionne les derniers `CalendlyEvent` (appels réservés sur /appel) et
 * `Submission` (messages /contact & formulaires) en une liste unifiée triée
 * par date desc, chaque ligne annotée du client CRM existant le cas échéant.
 *
 * Match « déjà converti » : correspondance email insensible à la casse contre
 * `Client.contactEmail` (colonne citext). La PII Submission (contactName /
 * contactEmail / contactPhone) est stockée chiffrée (`enc:v1:` — cf.
 * `src/lib/pii-crypto.ts`) → déchiffrement applicatif AVANT match, le lookup
 * SQL direct sur `Submission.contactEmail` étant impossible. Les emails
 * Calendly (`inviteeEmail`) sont en clair (citext).
 *
 * Stub-aware (ADR 0026) : try/catch → [] / null. Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntreeSource = "calendly" | "submission";

export interface ClientExistant {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface EntreeRecente {
  source: EntreeSource;
  /** id CalendlyEvent (cuid) ou Submission (uuid). */
  id: string;
  /** Date de référence : startTime ?? capturedAt (Calendly) / submittedAt. */
  date: Date;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  /** Société déclarée (Submission.companyName) — null côté Calendly. */
  societe: string | null;
  /** Sujet (event-type Calendly) ou extrait du message (tronqué). */
  extrait: string | null;
  /** Client CRM au même email (case-insensitive), sinon null. */
  clientExistant: ClientExistant | null;
}

export interface ListEntreesOpts {
  /** Nombre max d'entrées fusionnées retournées (défaut 30, max 200). */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers purs
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;
const EXTRAIT_MAX = 180;

function tronquer(s: string): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > EXTRAIT_MAX ? `${clean.slice(0, EXTRAIT_MAX - 1)}…` : clean;
}

/** Extrait lisible du payload `details` d'une Submission (message en priorité). */
function extraitSubmission(details: unknown): string | null {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const d = details as Record<string, unknown>;
    for (const key of ["message", "subject", "projectDescription", "besoin"]) {
      const v = d[key];
      if (typeof v === "string" && v.trim() !== "") return tronquer(v);
    }
  }
  return null;
}

/** Normalise un email pour le match (trim + lowercase). Null si inutilisable. */
function emailCle(email: string | null | undefined): string | null {
  if (!isDecryptedEmailUsable(email)) return null;
  return (email as string).trim().toLowerCase();
}

// Lignes DB minimales (découplées du client Prisma généré → testable en mock).
interface CalendlyRow {
  id: string;
  eventTypeName: string;
  startTime: Date | null;
  capturedAt: Date;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
}

interface SubmissionRow {
  id: string;
  type: string;
  submittedAt: Date;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  details: unknown;
}

function fromCalendly(row: CalendlyRow): EntreeRecente {
  return {
    source: "calendly",
    id: row.id,
    date: row.startTime ?? row.capturedAt,
    nom: row.inviteeName,
    email: row.inviteeEmail,
    telephone: row.inviteePhone,
    societe: null,
    extrait: row.eventTypeName || null,
    clientExistant: null,
  };
}

function fromSubmission(row: SubmissionRow): EntreeRecente {
  return {
    source: "submission",
    id: row.id,
    date: row.submittedAt,
    // PII chiffrée at-rest (enc:v1) → déchiffrement applicatif. decryptPii
    // est no-op sur les valeurs en clair (leads chatbot / legacy).
    nom: decryptPii(row.contactName) || null,
    email: decryptPii(row.contactEmail) || null,
    telephone: decryptPii(row.contactPhone),
    societe: row.companyName && row.companyName !== "—" ? row.companyName : null,
    extrait: extraitSubmission(row.details) ?? row.type,
    clientExistant: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fusionne les N derniers CalendlyEvent + Submission (hors corbeille), triés
 * par date desc, annotés du client CRM existant (match email case-insensitive).
 * Stub-safe → [] au build.
 */
export async function listEntreesRecentes(opts?: ListEntreesOpts): Promise<EntreeRecente[]> {
  const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  let calendlyRows: CalendlyRow[];
  let submissionRows: SubmissionRow[];
  try {
    [calendlyRows, submissionRows] = (await Promise.all([
      prisma.calendlyEvent.findMany({
        select: {
          id: true,
          eventTypeName: true,
          startTime: true,
          capturedAt: true,
          inviteeName: true,
          inviteeEmail: true,
          inviteePhone: true,
        },
        orderBy: { capturedAt: "desc" },
        take: limit,
      }),
      prisma.submission.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          type: true,
          submittedAt: true,
          companyName: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          details: true,
        },
        orderBy: { submittedAt: "desc" },
        take: limit,
      }),
    ])) as [CalendlyRow[], SubmissionRow[]];
  } catch {
    return [];
  }

  const entrees = [
    ...(calendlyRows ?? []).map(fromCalendly),
    ...(submissionRows ?? []).map(fromSubmission),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);

  const parEmail = await clientsParEmail(entrees.map((e) => e.email));
  if (parEmail.size === 0) return entrees;

  return entrees.map((e) => {
    const cle = emailCle(e.email);
    const client = cle ? (parEmail.get(cle) ?? null) : null;
    return client ? { ...e, clientExistant: client } : e;
  });
}

/**
 * Les clients CRM correspondant à une liste d'e-mails, indexés par e-mail
 * NORMALISÉ (`emailCle` : trim + minuscules).
 *
 * ## Pourquoi c'est exporté
 *
 * Cette annotation était la seule valeur propre de l'écran « Entrées récentes ».
 * Cet écran refaisait l'union appels + messages que la Boîte de réception fait
 * déjà — quatre portes pour un seul geste (cf.
 * `_AUDIT/RESERVATION-2026-08-26/UNE-SEULE-PORTE.md`). L'écran redirige
 * désormais vers la Boîte de réception, qui reprend l'annotation **en appelant
 * cette fonction**, pas en la recopiant.
 *
 * 🔑 Un prédicat recopié diverge au premier correctif. Ici, deux règles
 * subtiles doivent rester communes aux deux appelants : la comparaison
 * insensible à la casse, et « le PREMIER client créé gagne » en cas de doublon
 * d'e-mail. Dupliquées, elles auraient fini par ne plus désigner le même client
 * sur deux écrans qui montrent la même demande.
 *
 * Un seul `findMany` sur les e-mails distincts, quelle que soit la taille de la
 * liste. **Stub-safe** : rend une Map vide plutôt que de lever.
 */
export async function clientsParEmail(
  emails: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, ClientExistant>> {
  const parEmail = new Map<string, ClientExistant>();
  const cles = [...new Set(emails.map(emailCle).filter((c): c is string => !!c))];
  if (cles.length === 0) return parEmail;

  let clients: Array<ClientExistant & { contactEmail: string | null }>;
  try {
    clients = await prisma.client.findMany({
      // `contactEmail` est citext → l'égalité est déjà case-insensitive côté
      // Postgres ; `mode: "insensitive"` double la garantie (et documente
      // l'intention). Les clés sont lowercased côté JS.
      where: { contactEmail: { in: cles, mode: "insensitive" } },
      select: { id: true, numero: true, raisonSociale: true, contactEmail: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return parEmail;
  }

  for (const c of clients ?? []) {
    const cle = emailCle(c.contactEmail);
    // Premier client créé gagne en cas de doublon (orderBy createdAt asc).
    if (cle && !parEmail.has(cle)) {
      parEmail.set(cle, { id: c.id, numero: c.numero, raisonSociale: c.raisonSociale });
    }
  }
  return parEmail;
}

/**
 * Client CRM dont le `contactEmail` matche (insensible à la casse).
 * Utilisé par la conversion pour dédupliquer. Stub-safe → null.
 */
export async function findClientByEmail(email: string): Promise<ClientExistant | null> {
  const cleaned = email.trim();
  if (cleaned === "") return null;
  try {
    const client = await prisma.client.findFirst({
      where: { contactEmail: { equals: cleaned, mode: "insensitive" } },
      select: { id: true, numero: true, raisonSociale: true },
      orderBy: { createdAt: "asc" },
    });
    return client ?? null;
  } catch {
    return null;
  }
}
