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

import { resoudreCodePostal } from "./communes-lecture";
import { extraireCodePostal, normaliserCodePostal } from "./lieu";

export type IssueLieu = "enregistre" | "approximatif" | "commune_inconnue" | "code_invalide";

/** Plafond d'un rattrapage (un geste de la console, pas un passage de fond). */
export const PLAFOND_RATTRAPAGE = 500;

const arrondi2 = (x: number) => Math.round(x * 100) / 100;

async function ecrire(
  trainerId: string,
  codePostal: string,
  ville: string | null,
  userId: string,
  maintenant: Date,
  action: string,
): Promise<IssueLieu> {
  const r = await resoudreCodePostal(codePostal, ville);
  await prisma.$transaction(async (tx) => {
    await tx.trainer.update({
      where: { id: trainerId },
      data: {
        codePostalPro: codePostal,
        communeInsee: r?.commune.codeInsee ?? null,
        geoLat: r ? arrondi2(r.commune.latitude) : null,
        geoLng: r ? arrondi2(r.commune.longitude) : null,
        geoCalculeAt: r ? maintenant : null,
      },
    });
    await journaliser(
      tx,
      {
        action,
        targetType: "Trainer",
        targetId: trainerId,
        changes: { lieuModifie: true, communeTrouvee: r !== null },
        session: { userId },
      },
      { exiger: true },
    );
  });
  if (!r) return "commune_inconnue";
  return r.approximatif ? "approximatif" : "enregistre";
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
  return ecrire(trainerId, cp, ville?.trim() || null, userId, maintenant, "qualiopi.trainer.lieu");
}

export interface BilanRattrapage {
  readonly examinees: number;
  readonly trouvees: number;
  readonly sansCodePostal: number;
  readonly sansCommune: number;
}

/** Rattrape les formateurs actifs sans commune. Ne supprime ni ne vide rien. */
export async function rattraperLieuxFormateurs(
  userId: string,
  maintenant: Date,
): Promise<BilanRattrapage> {
  const fiches = await prisma.trainer.findMany({
    where: { actif: true, finCollaborationAt: null, communeInsee: null },
    select: { id: true, codePostalPro: true, adresseProfessionnelle: true },
    take: PLAFOND_RATTRAPAGE,
    orderBy: { id: "asc" },
  });
  let trouvees = 0;
  let sansCodePostal = 0;
  let sansCommune = 0;
  for (const f of fiches) {
    const cp =
      normaliserCodePostal(f.codePostalPro) ?? extraireCodePostal(f.adresseProfessionnelle);
    if (!cp) {
      sansCodePostal += 1;
      continue;
    }
    // Rien de neuf à écrire si la commune reste introuvable pour un code déjà saisi.
    if (cp === f.codePostalPro && (await resoudreCodePostal(cp, null)) === null) {
      sansCommune += 1;
      continue;
    }
    const issue = await ecrire(
      f.id,
      cp,
      null,
      userId,
      maintenant,
      "qualiopi.trainer.lieu.rattrapage",
    );
    if (issue === "commune_inconnue") sansCommune += 1;
    else trouvees += 1;
  }
  return { examinees: fiches.length, trouvees, sansCodePostal, sansCommune };
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
