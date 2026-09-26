/**
 * Candidatures VIDÉO FREELANCE (monteurs + vidéastes de tournage), lues pour
 * la vue console qui compare leurs prix côte à côte.
 *
 * Demande Will 2026-09-26 : « que les monteurs et ceux qui filment soient bien
 * visibles ». La liste générique ne peut pas le faire : elle ne montre ni les
 * réponses aux questions de l'offre, ni les prix. Ici, chaque offre a SON
 * tableau, avec une colonne par question — c'est la seule façon de comparer
 * dix tarifs d'un coup d'œil.
 *
 * ⚠️ Pas un module `"use server"` (même motif que `reads.ts`) : la page appelle
 *    cette lecture après avoir vérifié la session, et le cloisonnement se fait
 *    ICI, par le prédicat commun `peutOuvrirDossierCandidat`.
 */

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { VIDEO_FREELANCE_OFFER_SLUGS } from "@/lib/careers/video-editor-offer";
import { parseScreeningQuestions, type ScreeningQuestion } from "@/lib/careers/screening-answers";
import type { JobApplicationStatus } from "../../../prisma/generated/client";
import { safeDecrypt, type AccesDossierCandidat } from "./reads";

/** Au-delà, la vue le dit : elle ne montre que les plus récentes. */
export const PLAFOND_VIDEO_FREELANCE = 200;

export interface CandidatVideo {
  id: string;
  /** `null` quand le rôle n'ouvre pas le dossier : la vue affiche « masqué ». */
  nom: string | null;
  ville: string | null;
  status: JobApplicationStatus;
  submittedAt: Date;
  /** Réponses par id de question. Vide quand le dossier est fermé au rôle. */
  reponses: Record<string, string>;
}

export interface OffreVideo {
  slug: string;
  offerId: string | null;
  titre: string;
  questions: ScreeningQuestion[];
  candidats: CandidatVideo[];
  /** Nombre total, qui peut dépasser ce qui est affiché. */
  total: number;
}

function lireReponses(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Une entrée par offre vidéo freelance, dans l'ordre de
 * `VIDEO_FREELANCE_OFFER_SLUGS` (tournage d'abord, montage ensuite). Une offre
 * absente de la base est simplement omise.
 */
export async function listerCandidaturesVideoFreelance(
  acces: AccesDossierCandidat,
): Promise<OffreVideo[]> {
  const offres = await prisma.jobOffer.findMany({
    where: { slug: { in: [...VIDEO_FREELANCE_OFFER_SLUGS] } },
    select: { id: true, slug: true, titleFr: true, screeningQuestions: true },
  });
  const ouvert = peutOuvrirDossierCandidat(acces.role);

  const resultat: OffreVideo[] = [];
  for (const slug of VIDEO_FREELANCE_OFFER_SLUGS) {
    const offre = offres.find((o) => o.slug === slug);
    if (!offre) continue;
    const [total, lignes] = await Promise.all([
      prisma.jobApplication.count({ where: { offerId: offre.id } }),
      prisma.jobApplication.findMany({
        where: { offerId: offre.id },
        orderBy: { submittedAt: "desc" },
        take: PLAFOND_VIDEO_FREELANCE,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          status: true,
          submittedAt: true,
          answers: true,
        },
      }),
    ]);
    resultat.push({
      slug,
      offerId: offre.id,
      titre: offre.titleFr,
      questions: parseScreeningQuestions(offre.screeningQuestions),
      total,
      candidats: lignes.map((l) => ({
        id: l.id,
        nom: ouvert ? `${safeDecrypt(l.firstName)} ${safeDecrypt(l.lastName)}`.trim() : null,
        // La ville et les réponses sont des informations sur la personne : elles
        // suivent le même cloisonnement que le nom.
        ville: ouvert ? l.city : null,
        status: l.status,
        submittedAt: l.submittedAt,
        reponses: ouvert ? lireReponses(l.answers) : {},
      })),
    });
  }

  // Même trace que la liste générique, et seulement quand des identités sortent.
  if (ouvert && resultat.some((o) => o.candidats.length > 0)) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: acces.acteurId,
          action: "careers.candidature.liste.consultee",
          targetType: "JobApplication",
          targetId: null,
          ipAddress: await getClientIp(),
        },
      });
    } catch {
      // best-effort, comme `reads.ts` : un journal indisponible ne prive pas
      // le recruteur de sa liste.
    }
  }

  return resultat;
}
