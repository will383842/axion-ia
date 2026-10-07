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
 * Lot L1 du chantier « Candidatures unifiées » (2026-10-07) : la liste se CLASSE
 * par prix (du moins cher au plus cher par défaut), se filtre (prix maximum,
 * ville, étape) et dit combien de vidéos chaque personne a montrées.
 *  - Le tri se fait en mémoire sur TOUS les dossiers de l'offre (borne
 *    `PLAFOND_LECTURE_VIDEO`), jamais sur la seule page affichée : sinon « le
 *    moins cher » ne serait que le moins cher des 200 plus récents.
 *  - Les identités ne sont déchiffrées qu'APRÈS tri et filtres, pour les seules
 *    lignes affichées.
 *  - Un prix qui n'est pas UN montant (saisie libre d'avant le 26/09, « 200 à
 *    300 ») se lit « à préciser » et reste TOUJOURS en fin de liste, dans les
 *    deux sens : il n'est ni le moins cher ni le plus cher.
 *
 * ⚠️ Pas un module `"use server"` (même motif que `reads.ts`) : la page appelle
 *    cette lecture après avoir vérifié la session, et le cloisonnement se fait
 *    ICI, par le prédicat commun `peutOuvrirDossierCandidat`. Un rôle qui
 *    n'ouvre pas le dossier ne voit ni prix ni vidéo — et la liste ne se classe
 *    PAS par prix pour lui : l'ordre des lignes trahirait les prix masqués.
 */

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { VIDEO_FREELANCE_OFFER_SLUGS } from "@/lib/careers/video-editor-offer";
import {
  montantEnCentimes,
  parseScreeningQuestions,
  type ScreeningQuestion,
} from "@/lib/careers/screening-answers";
import { extraireLiensVideo, sourcesDeLiens } from "@/lib/careers/liens-video";
import { STATUTS_CANDIDATURE } from "@/content/recrutement/statuts";
import type { JobApplicationStatus } from "../../../prisma/generated/client";
import { safeDecrypt, type AccesDossierCandidat } from "./reads";

/** Lignes affichées par offre, après tri et filtres. Au-delà, la vue le dit. */
export const PLAFOND_VIDEO_FREELANCE = 200;

/**
 * Dossiers lus par offre pour trier. Au-delà, la vue le dit (plan § 3.3 ; une
 * table de prix dérivée ne se justifie qu'au-delà d'environ mille dossiers).
 */
export const PLAFOND_LECTURE_VIDEO = 1000;

export type SensTri = "asc" | "desc";

export interface VideoDeposee {
  id: string;
  nom: string;
  taille: number;
}

export interface LienExemple {
  url: string;
  plateforme: string;
}

export interface CandidatVideo {
  id: string;
  /** `null` quand le rôle n'ouvre pas le dossier : la vue affiche « masqué ». */
  nom: string | null;
  ville: string | null;
  status: JobApplicationStatus;
  submittedAt: Date;
  /** Réponses par id de question. Vide quand le dossier est fermé au rôle. */
  reponses: Record<string, string>;
  /** Vidéos déposées et passées par l'antivirus. Vide quand le dossier est fermé. */
  videos: VideoDeposee[];
  /** Liens vers son travail (formulaire, petit mot, portfolio). Vide quand le dossier est fermé. */
  liens: LienExemple[];
}

export interface OffreVideo {
  slug: string;
  offerId: string | null;
  titre: string;
  questions: ScreeningQuestion[];
  /** Questions de prix de l'offre, triables. */
  questionsPrix: string[];
  /** Question de prix qui classe la liste ; `null` si aucun tri par prix. */
  questionTri: string | null;
  sens: SensTri;
  candidats: CandidatVideo[];
  /** Nombre total de candidatures à l'offre. */
  total: number;
  /** Nombre de dossiers qui passent les filtres (peut dépasser ce qui est affiché). */
  retenus: number;
  /** Vrai quand l'offre a plus de dossiers que `PLAFOND_LECTURE_VIDEO`. */
  lectureTronquee: boolean;
}

export interface FiltresVideo {
  /** Id d'une question de prix ; ignoré si l'offre n'a pas cette question. */
  tri?: string | null;
  sens?: SensTri;
  /** Prix maximum, en centimes, sur la colonne qui classe la liste. */
  prixMaxCentimes?: number | null;
  /** Morceau du nom de ville, sans tenir compte des accents ni de la casse. */
  ville?: string | null;
  etape?: JobApplicationStatus | null;
}

function lireReponses(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Les questions de PRIX d'une offre, dans leur ordre.
 *
 * 🔑 Normalement celles typées `price` (posées en console le 26/09). Si une
 * offre n'en déclare aucune — JSON ressaisi sans le type —, on se rabat sur le
 * libellé (« prix », « tarif ») : sans ce repli, la colonne ne se classerait
 * plus du tout, en silence.
 */
export function questionsDePrix(questions: readonly ScreeningQuestion[]): ScreeningQuestion[] {
  const typees = questions.filter((q) => q.type === "price");
  if (typees.length > 0) return typees;
  return questions.filter((q) => /\b(prix|tarifs?)\b/i.test(q.labelFr ?? ""));
}

/**
 * La question qui classe la liste par défaut : le prix OBLIGATOIRE (vertical
 * pour le montage, demi-journée pour le tournage), sinon le premier prix.
 */
export function questionDeTriParDefaut(questions: readonly ScreeningQuestion[]): string | null {
  const prix = questionsDePrix(questions);
  return (prix.find((q) => q.required) ?? prix[0])?.id ?? null;
}

/** « Saint-Étienne » et « saint etienne » se trouvent l'un l'autre (accents, casse, tirets). */
export function sansAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-'’\s]+/g, " ")
    .toLowerCase()
    .trim();
}

export function lireEtape(v: string | null | undefined): JobApplicationStatus | null {
  return (STATUTS_CANDIDATURE as readonly string[]).includes(v ?? "")
    ? (v as JobApplicationStatus)
    : null;
}

interface LigneTriable {
  status: JobApplicationStatus;
  city: string | null;
  answers: Record<string, string>;
}

/**
 * Filtre et classe des lignes DÉJÀ rangées de la plus récente à la plus
 * ancienne. Fonction pure, testée seule.
 *
 *  - `questionTri` null → aucun tri par prix, l'ordre d'arrivée reste ;
 *  - prix illisible → « à préciser », toujours APRÈS les montants, dans les deux
 *    sens ; deux prix égaux (ou deux « à préciser ») gardent l'ordre d'arrivée ;
 *  - `prixMaxCentimes` écarte aussi les « à préciser » : un prix inconnu n'est
 *    pas sous le plafond.
 */
export function filtrerEtClasser<T extends LigneTriable>(
  lignes: readonly T[],
  o: {
    questionTri: string | null;
    sens: SensTri;
    prixMaxCentimes?: number | null;
    ville?: string | null;
    etape?: JobApplicationStatus | null;
  },
): T[] {
  const ville = o.ville ? sansAccents(o.ville) : "";
  const prix = (l: T) => (o.questionTri ? montantEnCentimes(l.answers[o.questionTri]) : null);
  const gardees = lignes
    .map((l, rang) => ({ l, rang, p: prix(l) }))
    .filter(({ l, p }) => {
      if (o.etape && l.status !== o.etape) return false;
      if (ville && !sansAccents(l.city ?? "").includes(ville)) return false;
      if (o.prixMaxCentimes != null && o.questionTri && (p === null || p > o.prixMaxCentimes)) {
        return false;
      }
      return true;
    });
  if (o.questionTri) {
    const signe = o.sens === "desc" ? -1 : 1;
    gardees.sort((a, b) => {
      if (a.p === null && b.p === null) return a.rang - b.rang;
      if (a.p === null) return 1;
      if (b.p === null) return -1;
      return (a.p - b.p) * signe || a.rang - b.rang;
    });
  }
  return gardees.map(({ l }) => l);
}

/**
 * Une entrée par offre vidéo freelance, dans l'ordre de
 * `VIDEO_FREELANCE_OFFER_SLUGS` (tournage d'abord, montage ensuite). Une offre
 * absente de la base est simplement omise.
 */
export async function listerCandidaturesVideoFreelance(
  acces: AccesDossierCandidat,
  filtres: FiltresVideo = {},
): Promise<OffreVideo[]> {
  const offres = await prisma.jobOffer.findMany({
    where: { slug: { in: [...VIDEO_FREELANCE_OFFER_SLUGS] } },
    select: { id: true, slug: true, titleFr: true, screeningQuestions: true },
  });
  const ouvert = peutOuvrirDossierCandidat(acces.role);
  const sens: SensTri = filtres.sens === "desc" ? "desc" : "asc";

  const resultat: OffreVideo[] = [];
  for (const slug of VIDEO_FREELANCE_OFFER_SLUGS) {
    const offre = offres.find((o) => o.slug === slug);
    if (!offre) continue;
    const questions = parseScreeningQuestions(offre.screeningQuestions);
    const prixIds = questionsDePrix(questions).map((q) => q.id);
    // Rôle sans accès : ni tri ni filtre sur ce qu'il ne voit pas (prix, ville).
    const questionTri = !ouvert
      ? null
      : filtres.tri && prixIds.includes(filtres.tri)
        ? filtres.tri
        : questionDeTriParDefaut(questions);

    const [total, brutes] = await Promise.all([
      prisma.jobApplication.count({ where: { offerId: offre.id } }),
      prisma.jobApplication.findMany({
        where: { offerId: offre.id },
        orderBy: { submittedAt: "desc" },
        take: PLAFOND_LECTURE_VIDEO,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          status: true,
          submittedAt: true,
          answers: true,
          motivation: true,
          linkedinUrl: true,
        },
      }),
    ]);
    const lignes = brutes.map((l) => ({ ...l, answers: lireReponses(l.answers) }));
    const retenues = filtrerEtClasser(lignes, {
      questionTri,
      sens,
      etape: filtres.etape ?? null,
      prixMaxCentimes: ouvert ? (filtres.prixMaxCentimes ?? null) : null,
      ville: ouvert ? (filtres.ville ?? null) : null,
    });
    const affichees = retenues.slice(0, PLAFOND_VIDEO_FREELANCE);

    // Vidéos DÉPOSÉES des seules lignes affichées, et seulement pour un rôle qui
    // ouvre le dossier (la route de lecture applique le même prédicat).
    const videos =
      ouvert && affichees.length > 0 ? await lireVideos(affichees.map((l) => l.id)) : [];

    resultat.push({
      slug,
      offerId: offre.id,
      titre: offre.titleFr,
      questions,
      questionsPrix: ouvert ? prixIds : [],
      questionTri,
      sens,
      total,
      retenus: retenues.length,
      lectureTronquee: total > brutes.length,
      candidats: affichees.map((l) => ({
        id: l.id,
        // Déchiffré APRÈS tri et filtres, pour les seules lignes affichées.
        nom: ouvert ? `${safeDecrypt(l.firstName)} ${safeDecrypt(l.lastName)}`.trim() : null,
        // La ville et les réponses sont des informations sur la personne : elles
        // suivent le même cloisonnement que le nom.
        ville: ouvert ? l.city : null,
        status: l.status,
        submittedAt: l.submittedAt,
        reponses: ouvert ? l.answers : {},
        videos: videos
          .filter((v) => v.applicationId === l.id)
          .map((v) => ({ id: v.id, nom: v.nomOriginal, taille: v.taille })),
        liens: ouvert
          ? extraireLiensVideo(
              sourcesDeLiens(
                {
                  answers: l.answers,
                  motivation: l.motivation,
                  linkedinUrl: l.linkedinUrl,
                  evenements: [],
                },
                () => "",
              ),
            ).map(({ url, plateforme }) => ({ url, plateforme }))
          : [],
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

async function lireVideos(ids: string[]) {
  return (
    prisma.jobApplicationVideo
      .findMany({
        where: { applicationId: { in: ids }, statut: "disponible" },
        orderBy: { createdAt: "asc" },
        select: { id: true, applicationId: true, nomOriginal: true, taille: true },
      })
      // Table absente (base de développement pas à jour) : la liste reste lisible.
      .catch(() => [])
  );
}
