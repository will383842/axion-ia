/**
 * `admin-job-applications/reads.ts` — **LA LECTURE DES CANDIDATURES, SANS SESSION.**
 *
 * ⚠️ **CE FICHIER N'EST PAS UN MODULE `"use server"`, ET C'EST TOUT LE POINT.**
 *    Dans un fichier de Server Actions, *chaque export devient un point d'entrée
 *    réseau*. Une lecture sans garde de session exportée depuis `actions.ts`
 *    serait appelable depuis n'importe quel navigateur.
 *
 * Même motif que `admin-submissions/reads.ts` : `listApplicationsAction`
 * commençait par `requireAdminRead()`, qui appelle `auth()` — lequel lit un
 * **cookie de navigateur**. La boîte de réception
 * (`admin-inbox/queries.ts:158`) passait par cette action, donc elle exigeait
 * une session de navigateur qu'un appel MCP n'a pas.
 *
 * ⚠️ **CETTE EXTRACTION N'ÉLARGIT RIEN.** Le corps est déplacé sans une
 *    modification, et `listApplicationsAction` garde sa garde à l'identique.
 *
 * Y vivent aussi les trois choses dont la lecture a besoin et qu'un module
 * `"use server"` ne peut pas exporter : la liste des statuts, le schéma de
 * filtres, et le déchiffrement tolérant. Elles n'ont pas été dupliquées —
 * `actions.ts` les importe désormais d'ici, pour qu'il n'y en ait qu'une
 * écriture.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { VIDEO_EDITOR_OFFER_SLUG } from "@/lib/careers/video-editor-offer";
import type { JobApplicationStatus } from "../../../prisma/generated/client";

export const STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
  "archived",
] as const;

/**
 * Déchiffre sans jamais faire tomber la page. Un PII corrompu rend une chaîne
 * lisible plutôt qu'une exception : l'écran doit rester consultable même quand
 * une ligne est illisible.
 */
export function safeDecrypt(v: string): string {
  try {
    return decryptPii(v);
  } catch {
    return "[déchiffrement échoué]";
  }
}

export const listApplicationsSchema = z.object({
  offerId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().uuid().optional(),
  ),
  status: z.enum([...STATUSES, "all"]).default("all"),
  // Vues séparées (demande Will 2026-08-12) : la vue standard EXCLUT l'offre
  // monteur vidéo freelance, qui a son propre onglet. L'onglet « Toutes »
  // (demande Will 2026-08-13) passe `all` : aucune contrainte d'offre.
  // Le défaut reste `standard` — la boîte de réception unifiée appelle cette
  // action sans `view` et son canal Candidatures ne doit pas changer de
  // périmètre en silence.
  view: z.enum(["standard", "monteur", "all"]).default("standard"),
  onlyAttention: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export type ListApplicationsInput = z.infer<typeof listApplicationsSchema>;

export interface JobApplicationListItem {
  id: string;
  offerId: string;
  offerTitleSnap: string;
  contactName: string;
  contactEmail: string;
  status: JobApplicationStatus;
  hasCv: boolean;
  needsAttention: boolean;
  submittedAt: Date;
}

export interface JobApplicationListResult {
  items: JobApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * **LE CORPS DE `listApplicationsAction`, MOT POUR MOT, MOINS SA GARDE.**
 *
 * Ne l'appeler que depuis un contexte qui a DÉJÀ établi le droit de lire :
 * `listApplicationsAction` (session de navigateur) ou le handler `/api/mcp`
 * (secret partagé). Ce fichier ne décide d'aucun droit.
 */
export async function listApplications(
  input: Partial<ListApplicationsInput> = {},
): Promise<JobApplicationListResult> {
  const parsed = listApplicationsSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.offerId) where.offerId = parsed.offerId;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.onlyAttention) where.needsAttention = true;
  if (parsed.view === "monteur") {
    where.offer = { slug: VIDEO_EDITOR_OFFER_SLUG };
  } else if (parsed.view === "standard" && !parsed.offerId) {
    // Vue standard sans filtre d'offre explicite : les candidatures monteur
    // vidéo restent dans leur onglet. Un `offerId` explicite (lien depuis la
    // fiche offre) garde la priorité et n'est pas amputé.
    where.offer = { slug: { not: VIDEO_EDITOR_OFFER_SLUG } };
  }

  const [total, rows] = await Promise.all([
    prisma.jobApplication.count({ where }),
    prisma.jobApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        offerId: true,
        offerTitleSnap: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        cvStoragePath: true,
        needsAttention: true,
        submittedAt: true,
      },
    }),
  ]);

  const items: JobApplicationListItem[] = rows.map((r) => ({
    id: r.id,
    offerId: r.offerId,
    offerTitleSnap: r.offerTitleSnap,
    contactName: `${safeDecrypt(r.firstName)} ${safeDecrypt(r.lastName)}`.trim(),
    contactEmail: safeDecrypt(r.email),
    status: r.status,
    hasCv: Boolean(r.cvStoragePath),
    needsAttention: r.needsAttention,
    submittedAt: r.submittedAt,
  }));

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}
