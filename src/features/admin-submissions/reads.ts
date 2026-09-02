/**
 * `admin-submissions/reads.ts` — **LA LECTURE DES SOUMISSIONS, SANS SESSION.**
 *
 * ⚠️ **CE FICHIER N'EST PAS UN MODULE `"use server"`, ET C'EST TOUT LE POINT.**
 *    Dans un fichier de Server Actions, *chaque export devient un point d'entrée
 *    réseau*. Une lecture sans garde de session exportée depuis `actions.ts`
 *    serait donc appelable par n'importe qui, depuis un navigateur. Elle vit ici,
 *    où seul du code serveur peut l'importer.
 *
 * ═══ POURQUOI ELLE EXISTE ═══
 *
 * `listSubmissionsAction` commençait par `requireAdminReadSession()`, qui appelle
 * `auth()` — et `auth()` lit un **cookie de navigateur**. La boîte de réception
 * (`admin-inbox/queries.ts:88`) passait par cette action, donc **elle exigeait
 * une session de navigateur**.
 *
 * Un appel MCP n'en a pas. Il porte un secret partagé dans un en-tête, pas un
 * cookie. Sans cette extraction, l'outil `axionia.inbox.recent` ne pouvait pas
 * exister — c'est le constat d'audit qui a créé le lot 4a : « la couche service
 * d'Axion-IA, déclarée existante et réutilisable, l'était pour un agrégateur sur
 * six ».
 *
 * ═══ CE QUE CETTE EXTRACTION NE FAIT PAS ═══
 *
 * ⚠️ **ELLE N'ÉLARGIT RIEN.** Le corps est déplacé *sans une modification*, et
 *    `listSubmissionsAction` garde sa garde à l'identique : elle appelle
 *    désormais cette fonction, après avoir vérifié la session. Tout appelant qui
 *    passait par l'action continue d'être gardé exactement comme avant.
 *
 *    L'habilitation du canal MCP est portée **ailleurs** — par le secret partagé
 *    du handler et par le profil du socle —, jamais par ce fichier. Le défaut
 *    qu'on ferme ici est l'inverse du défaut #871 (« le rôle `reader` voyait le
 *    hub de facturation que la secrétaire ne voyait pas ») : la garde ne doit ni
 *    disparaître, ni diverger selon le chemin d'appel.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";

import {
  listSubmissionsSchema,
  buildSubmissionsWhere,
  normalizeSearch,
  matchSubmissionSearch,
  type ListSubmissionsInput,
} from "./query";
import type {
  SubmissionType,
  SubmissionStatus,
  Locale,
  Prisma,
} from "../../../prisma/generated/client";

export interface SubmissionListItem {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  locale: Locale;
  companyName: string;
  contactName: string;
  contactEmail: string;
  /** Téléphone déchiffré (2026-08-13 — colonne Téléphone du listing). Null si absent. */
  contactPhone: string | null;
  /** Extrait du contenu (details.message, tronqué à 300 caractères) pour
   *  l'afficher directement dans le listing (demande Will 2026-08-13). */
  messageExtrait: string | null;
  sector: string | null;
  assignedTo: string | null;
  submittedAt: Date;
  // Sprint Notif Infra 2026-05-26 / fix P1-2 — champs reply system pour
  // afficher les badges Sans réponse / Répondu (N) / Échec dans le listing.
  replyCount: number;
  needsAttention: boolean;
  archivedAt: Date | null;
  /** Corbeille (2026-07-10) — non null = soft-deleted (dans la corbeille). */
  deletedAt: Date | null;
  lastRepliedAt: Date | null;
  /** Status delivery de la DERNIÈRE reply (null si aucune). */
  lastReplyStatus: string | null;
  /** Form v2 (2026-05-28) — type fin extrait de details.unifiedType. Les 5
   * nouveaux types (presse, recrutement, speaker, investisseur, support_client)
   * sont stockés en DB comme SubmissionType.contact + details.unifiedType. */
  unifiedType: string | null;
  /** details.subType — le slug de la formation (devis express des fiches) ou la
   * granularité fine (audit-flash, chatbot…). C'est LE contexte que la boîte de
   * réception affichait « — » alors qu'il était en base (relevé P1-08). */
  subType: string | null;
}

export interface SubmissionListResult {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * **LE CORPS DE `listSubmissionsAction`, MOT POUR MOT, MOINS SA GARDE.**
 *
 * Ne l'appeler que depuis un contexte qui a DÉJÀ établi le droit de lire :
 * `listSubmissionsAction` (session de navigateur) ou le handler `/api/mcp`
 * (secret partagé). Ce fichier ne décide d'aucun droit — c'est la règle du
 * contrat d'adaptateur : « ne jamais décider d'un droit ».
 */
export async function listSubmissions(
  input: Partial<ListSubmissionsInput> = {},
): Promise<SubmissionListResult> {
  const parsed = listSubmissionsSchema.parse(input);

  // Un SEUL constructeur de `where`, partagé avec l'export CSV (cf. `./query`).
  //
  // NB : la recherche par email/nom N'EST PAS un filtre SQL. `contactEmail` /
  // `contactName` sont chiffrés au repos (AES-GCM, IV aléatoire → non
  // déterministe), donc un `contains` SQL ne matche jamais. On filtre en mémoire
  // après déchiffrement (voir plus bas). `companyName` reste en clair.
  const where = buildSubmissionsWhere(parsed);

  // Sélection partagée liste + recherche.
  const select = {
    id: true,
    type: true,
    status: true,
    locale: true,
    companyName: true,
    contactName: true,
    contactEmail: true,
    contactPhone: true,
    sector: true,
    assignedTo: true,
    submittedAt: true,
    replyCount: true,
    needsAttention: true,
    archivedAt: true,
    deletedAt: true,
    lastRepliedAt: true,
    // Form v2 — `details` JSON contient unifiedType (le champ `type` DB n'a que
    // 5 valeurs enum, vs 12 types unifiés).
    details: true,
    // Dernière reply → lastReplyStatus (badge "Échec envoi").
    replies: {
      orderBy: { repliedAt: "desc" },
      take: 1,
      select: { deliveryStatus: true },
    },
  } satisfies Prisma.SubmissionSelect;

  // Mappe une ligne DB → SubmissionListItem. DÉCHIFFRE le PII : contactName /
  // contactEmail sont stockés chiffrés (enc:v1) par le formulaire ; decryptPii
  // est un no-op sur les valeurs en clair (leads chatbot) → sûr partout.
  const mapRow = (s: Prisma.SubmissionGetPayload<{ select: typeof select }>) => {
    const details =
      s.details && typeof s.details === "object" && !Array.isArray(s.details)
        ? (s.details as Record<string, unknown>)
        : null;
    const unifiedType =
      details && typeof details.unifiedType === "string" ? details.unifiedType : null;
    const subType = details && typeof details.subType === "string" ? details.subType : null;
    const rawMessage = details && typeof details.message === "string" ? details.message.trim() : "";
    return {
      id: s.id,
      type: s.type,
      status: s.status,
      locale: s.locale,
      companyName: s.companyName,
      contactName: decryptPii(s.contactName),
      contactEmail: decryptPii(s.contactEmail),
      contactPhone: s.contactPhone ? decryptPii(s.contactPhone) : null,
      messageExtrait: rawMessage
        ? rawMessage.length > 300
          ? `${rawMessage.slice(0, 300)}…`
          : rawMessage
        : null,
      sector: s.sector,
      assignedTo: s.assignedTo,
      submittedAt: s.submittedAt,
      replyCount: s.replyCount,
      needsAttention: s.needsAttention,
      archivedAt: s.archivedAt,
      deletedAt: s.deletedAt,
      lastRepliedAt: s.lastRepliedAt,
      lastReplyStatus: s.replies[0]?.deliveryStatus ?? null,
      unifiedType,
      subType,
    };
  };

  const searchQ = normalizeSearch(parsed.search);

  let mapped: ReturnType<typeof mapRow>[];
  let total: number;
  if (searchQ) {
    // Scan borné des plus récents (matchant les AUTRES filtres) → déchiffre →
    // filtre + pagine en mémoire. Une boîte admin dépasse rarement ce plafond.
    const SEARCH_SCAN_CAP = 2000;
    const scanned = await prisma.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: SEARCH_SCAN_CAP,
      select,
    });
    const filtered = scanned.map(mapRow).filter((r) => matchSubmissionSearch(r, searchQ));
    total = filtered.length;
    const start = (parsed.page - 1) * parsed.pageSize;
    mapped = filtered.slice(start, start + parsed.pageSize);
  } else {
    const [count, items] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
        select,
      }),
    ]);
    total = count;
    mapped = items.map(mapRow);
  }

  return {
    items: mapped,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}
