/**
 * Lieu d'exercice d'un formateur — écriture (lot L15a, ADR 0066 ; W6 C3, C4).
 *
 * Écrit `codePostalPro`, `communeInsee` et un centre de commune ARRONDI à
 * 2 décimales (~1 km : jamais le domicile d'un micro-entrepreneur). Le journal
 * dit « lieu modifié », jamais le code postal ni la commune.
 *
 * Rattrapage des fiches existantes : code postal déjà saisi, sinon celui de
 * l'adresse professionnelle ; sinon la fiche reste « lieu à compléter ». Le
 * registre par SIRET viendra avec le client commun du registre (FAC-5).
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { resoudreCodePostal, type CommuneResolue } from "./communes-lecture";
import { extraireCodePostal, normaliserCodePostal } from "./lieu";

export type IssueLieu = "enregistre" | "approximatif" | "commune_inconnue" | "code_invalide";

/** Taille d'une page du rattrapage, et nombre de fiches examinées au plus par geste. */
export const PAGE_RATTRAPAGE = 200;
export const PLAFOND_RATTRAPAGE = 5_000;

const arrondi2 = (x: number) => Math.round(x * 100) / 100;

async function ecrire(
  trainerId: string,
  r: CommuneResolue,
  userId: string,
  maintenant: Date,
  action: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.trainer.update({
      where: { id: trainerId },
      data: {
        codePostalPro: r.codePostal,
        communeInsee: r.commune.codeInsee,
        geoLat: arrondi2(r.commune.latitude),
        geoLng: arrondi2(r.commune.longitude),
        geoCalculeAt: maintenant,
      },
    });
    await journaliser(
      tx,
      {
        action,
        targetType: "Trainer",
        targetId: trainerId,
        changes: { lieuModifie: true },
        session: { userId },
      },
      { exiger: true },
    );
  });
}

/** Saisie à la console : code postal (5 chiffres) et ville facultative. */
export async function enregistrerLieuFormateur(
  trainerId: string,
  saisieCodePostal: string,
  ville: string | null,
  userId: string,
  maintenant: Date,
): Promise<IssueLieu> {
  const cp = normaliserCodePostal(saisieCodePostal);
  if (!cp) return "code_invalide";
  const r = await resoudreCodePostal(cp, ville?.trim() || null);
  // Aucune commune : RIEN n'est écrit — une faute de frappe n'efface jamais
  // la commune déjà connue.
  if (!r) return "commune_inconnue";
  await ecrire(trainerId, r, userId, maintenant, "qualiopi.trainer.lieu");
  return r.approximatif ? "approximatif" : "enregistre";
}

export interface BilanRattrapage {
  readonly examinees: number;
  readonly trouvees: number;
  readonly sansCodePostal: number;
  readonly sansCommune: number;
  /** Plusieurs communes pour le code postal : laissées à confirmer à la main. */
  readonly aConfirmer: number;
}

/**
 * Rattrape les formateurs actifs sans commune, page par page (curseur sur
 * l'id) : une fiche sans issue n'empêche jamais d'examiner les suivantes.
 * Une commune APPROXIMATIVE (code postal partagé) n'est pas écrite : la fiche
 * reste « à compléter » et la ville se précise à la main. Ne vide rien.
 */
export async function rattraperLieuxFormateurs(
  userId: string,
  maintenant: Date,
): Promise<BilanRattrapage> {
  let examinees = 0;
  let trouvees = 0;
  let sansCodePostal = 0;
  let sansCommune = 0;
  let aConfirmer = 0;
  let apres: string | null = null;
  while (examinees < PLAFOND_RATTRAPAGE) {
    const fiches: Array<{
      id: string;
      codePostalPro: string | null;
      adresseProfessionnelle: string | null;
    }> = await prisma.trainer.findMany({
      where: {
        actif: true,
        finCollaborationAt: null,
        communeInsee: null,
        ...(apres ? { id: { gt: apres } } : {}),
      },
      select: { id: true, codePostalPro: true, adresseProfessionnelle: true },
      take: PAGE_RATTRAPAGE,
      orderBy: { id: "asc" },
    });
    if (fiches.length === 0) break;
    for (const f of fiches) {
      examinees += 1;
      const cp =
        normaliserCodePostal(f.codePostalPro) ?? extraireCodePostal(f.adresseProfessionnelle);
      if (!cp) {
        sansCodePostal += 1;
        continue;
      }
      const r = await resoudreCodePostal(cp, null);
      if (!r) sansCommune += 1;
      else if (r.approximatif) aConfirmer += 1;
      else {
        await ecrire(f.id, r, userId, maintenant, "qualiopi.trainer.lieu.rattrapage");
        trouvees += 1;
      }
    }
    if (fiches.length < PAGE_RATTRAPAGE) break;
    apres = fiches[fiches.length - 1]!.id;
  }
  return { examinees, trouvees, sansCodePostal, sansCommune, aConfirmer };
}

/** Les formateurs actifs dont le lieu reste à compléter (liste de la console). */
export async function lireLieuxACompleter(): Promise<
  Array<{ id: string; prenom: string; nom: string; codePostalPro: string | null }>
> {
  return prisma.trainer.findMany({
    where: { actif: true, finCollaborationAt: null, communeInsee: null },
    select: { id: true, prenom: true, nom: true, codePostalPro: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    take: 200,
  });
}
