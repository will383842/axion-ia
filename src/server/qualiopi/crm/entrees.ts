/**
 * Qualiopi — Entrées récentes (pont appel/contact → CRM, Lot 3).
 *
 * Fusionne les derniers `CalendlyEvent` (appels réservés sur /appel) et
 * `Submission` (messages /contact & formulaires) en une liste unifiée triée
 * par date desc, chaque ligne annotée du client CRM existant le cas échéant.
 *
 * Match « déjà client » : l'adresse de la fiche (`Client.contactEmail`, citext)
 * OU celle de l'une de ses personnes (`client_contact_adresses`, par
 * empreinte) — le critère de la porte unique (correction anti-doublon A2). La PII Submission (contactName /
 * contactEmail / contactPhone) est stockée chiffrée (`enc:v1:` — cf.
 * `src/lib/pii-crypto.ts`) → déchiffrement applicatif AVANT match, le lookup
 * SQL direct sur `Submission.contactEmail` étant impossible. Les emails
 * Calendly (`inviteeEmail`) sont en clair (citext).
 *
 * Stub-aware (ADR 0026) : try/catch → [] / null. Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";

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

/** Une fiche lue pour l'appariement par adresse. */
interface FicheParAdresses extends ClientExistant {
  contactEmail: string | null;
  contacts?: Array<{ adresses?: Array<{ emailHash: string }> }>;
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
 * 🔑 Un prédicat recopié diverge au premier correctif. Ici, trois règles
 * subtiles doivent rester communes à tous les appelants : la comparaison
 * insensible à la casse, l'adresse de la fiche OU de l'une de ses personnes
 * (critère de la porte unique, correction anti-doublon A2 — sinon une personne
 * rangée comme deuxième contact n'était pas « déjà client »), et « le PREMIER
 * client créé gagne » en cas de doublon d'e-mail. Dupliquées, elles auraient fini par ne plus désigner le même client
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

  let clients: FicheParAdresses[];
  let empreintes: Map<string, string>;
  try {
    // Empreinte de chaque adresse cherchée — la clé de `client_contact_adresses`
    // (`hashEmailForLookup`, la même que la porte unique). Lève en production
    // sans clé : on rend alors une Map vide, comme pour une base absente.
    empreintes = new Map(
      cles.flatMap((c) => {
        const h = hashEmailForLookup(c);
        return h === null ? [] : [[h, c] as const];
      }),
    );
    clients = await prisma.client.findMany({
      where: {
        // Comme la porte unique (`chargerFichesCandidates`) : l'adresse de la
        // fiche OU celle de n'importe laquelle de ses personnes. Une fiche
        // absorbée par une fusion vivante n'est plus « le client ».
        OR: [
          // `contactEmail` est citext ; `mode: "insensitive"` documente l'intention.
          { contactEmail: { in: cles, mode: "insensitive" } },
          ...(empreintes.size > 0
            ? [
                {
                  contacts: {
                    some: { adresses: { some: { emailHash: { in: [...empreintes.keys()] } } } },
                  },
                },
              ]
            : []),
        ],
        fusionsAbsorbee: { none: { defaiteLe: null } },
      },
      select: {
        id: true,
        numero: true,
        raisonSociale: true,
        contactEmail: true,
        contacts: { select: { adresses: { select: { emailHash: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return parEmail;
  }

  for (const c of clients ?? []) {
    const trouvees = new Set<string>();
    const cle = emailCle(c.contactEmail);
    if (cle) trouvees.add(cle);
    for (const p of c.contacts ?? []) {
      for (const a of p.adresses ?? []) {
        const cherchee = empreintes.get(a.emailHash);
        if (cherchee) trouvees.add(cherchee);
      }
    }
    // Premier client créé gagne en cas de doublon (orderBy createdAt asc).
    for (const t of trouvees) {
      if (!parEmail.has(t)) {
        parEmail.set(t, { id: c.id, numero: c.numero, raisonSociale: c.raisonSociale });
      }
    }
  }
  return parEmail;
}

/**
 * Le client CRM d'une adresse : celle de la fiche OU celle de l'une de ses
 * personnes (correction anti-doublon A2 : même critère que la porte unique).
 * Délègue à `clientsParEmail` — une seule règle d'appariement. Stub-safe → null.
 */
export async function findClientByEmail(email: string): Promise<ClientExistant | null> {
  const cle = emailCle(email);
  if (cle === null) return null;
  return (await clientsParEmail([cle])).get(cle) ?? null;
}
