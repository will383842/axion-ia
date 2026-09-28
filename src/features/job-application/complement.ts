// COMPLÉTER SA CANDIDATURE EN LIGNE — la part serveur, sans `"use server"`.
//
// Demande Will 2026-09-28 : les monteurs qui ont postulé avant les questions de
// prix reçoivent un lien personnel (variable `{lien_complement}` des réponses
// de la console). Ce lien ouvre `/completer-ma-candidature`, qui pose les
// questions de l'offre et écrit les réponses DANS LA FICHE — plus aucune
// réponse par e-mail à recopier à la main.
//
// 🔑 Le lien n'écrit QUE les réponses aux questions de l'offre signée dans le
// jeton : ni l'identité, ni le statut, ni les notes. Un lien transféré à un
// tiers lui permettrait au pire de modifier des tarifs — jamais de lire le
// dossier au-delà des réponses que le candidat a lui-même données.

import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { parseScreeningQuestions, type ScreeningQuestion } from "@/lib/careers/screening-answers";
import {
  signerJetonComplement,
  verifierJetonComplement,
} from "@/server/recrutement/jeton-complement";

/** Chemin public de la page — une constante, lue par le lien ET par la page. */
export const CHEMIN_COMPLEMENT = "/completer-ma-candidature";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

/**
 * Le lien de complément d'une candidature, ou `null` si son offre ne pose
 * aucune question. `null` est voulu : l'envoi groupé ÉCARTE alors ce
 * destinataire (variable non résolue) au lieu de lui envoyer un lien vers une
 * page vide.
 */
export async function lienComplement(
  applicationId: string,
  offre: { id: string; screeningQuestions: unknown } | null,
): Promise<string | null> {
  if (!offre || parseScreeningQuestions(offre.screeningQuestions).length === 0) return null;
  const jeton = await signerJetonComplement(applicationId, offre.id);
  return `${SITE_URL}/fr${CHEMIN_COMPLEMENT}?jeton=${encodeURIComponent(jeton)}`;
}

export type DossierComplement =
  | {
      ok: true;
      applicationId: string;
      offerId: string;
      prenom: string | null;
      poste: string;
      /** Titre de l'offre, pour la notification. */
      offreTitre: string;
      offreSlug: string;
      offreCategorie: string;
      questions: ScreeningQuestion[];
      /** Réponses déjà données — la page les pré-remplit. */
      reponses: Record<string, string>;
    }
  | { ok: false; reason: string };

/** Vérifie le jeton et charge ce que la page a le droit de montrer. */
export async function chargerDossierComplement(
  jeton: string | null | undefined,
): Promise<DossierComplement> {
  const v = await verifierJetonComplement(jeton);
  if (!v.ok) return v;

  const [candidature, offre] = await Promise.all([
    prisma.jobApplication.findUnique({
      where: { id: v.applicationId },
      select: { id: true, firstName: true, offerTitleSnap: true, answers: true },
    }),
    prisma.jobOffer.findUnique({
      where: { id: v.offerId },
      select: { id: true, slug: true, titleFr: true, category: true, screeningQuestions: true },
    }),
  ]);
  if (!candidature) return { ok: false, reason: "unknown_application" };
  const questions = parseScreeningQuestions(offre?.screeningQuestions);
  if (!offre || questions.length === 0) return { ok: false, reason: "no_questions" };

  return {
    ok: true,
    applicationId: candidature.id,
    offerId: offre.id,
    prenom: prenomLisible(candidature.firstName),
    poste: candidature.offerTitleSnap,
    offreTitre: offre.titleFr,
    offreSlug: offre.slug,
    offreCategorie: offre.category,
    questions,
    reponses: reponsesTexte(candidature.answers),
  };
}

/** Les réponses stockées, réduites aux valeurs texte. */
export function reponsesTexte(brut: unknown): Record<string, string> {
  if (brut == null || typeof brut !== "object" || Array.isArray(brut)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(brut)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Fusionne les nouvelles réponses dans les anciennes.
 *
 * 🔑 Seules les questions de l'offre sont écrites : un champ `answer_<x>`
 * forgé hors de la liste est ignoré. Une question laissée vide ne tombe PAS
 * dans la fusion : elle n'efface pas une réponse donnée au dépôt.
 */
export function fusionnerReponses(
  questions: readonly ScreeningQuestion[],
  anciennes: Record<string, string>,
  nouvelles: Record<string, string>,
): Record<string, string> {
  const fusion = { ...anciennes };
  for (const q of questions) {
    const v = nouvelles[q.id]?.trim();
    if (v) fusion[q.id] = v;
  }
  return fusion;
}

function prenomLisible(chiffre: string | null): string | null {
  if (!chiffre) return null;
  try {
    const clair = decryptPii(chiffre);
    return typeof clair === "string" && clair.trim().length > 0 ? clair.trim() : null;
  } catch {
    return null;
  }
}
