/**
 * Réseau d'apporteurs — QUALITÉ de l'apporteur au sens de l'art. 14 du contrat 2.7.
 *
 *   · Société : adresse du SIÈGE et FONCTION de la personne qui signe (président, gérant…),
 *     demandées au dossier en ligne ; le dossier ne connaissait que l'adresse de l'établissement.
 *   · Entrepreneur individuel : immatriculé au registre du commerce et des sociétés, ou non
 *     (commerçant / non commerçant) ; la clause de juridiction ne vaut qu'entre commerçants.
 *
 * Table séparée `apporteur_reseau_qualite` (fenêtre app/worker). Absente ou vide = texte d'avant
 * (« commerçant s'il est immatriculé… », « qui déclare avoir le pouvoir de l'engager »).
 *
 * ⚠️ Module sans `server-only` : lu par le contrat, la console et le worker.
 */

import { prisma } from "@/lib/prisma";

import { signalerErreurReseau } from "./signaler";

export interface QualiteApporteur {
  siegeAdresse: string | null;
  fonctionSignataire: string | null;
  immatriculeRcs: boolean | null;
}

export const SIEGE_MAX = 400;
export const FONCTION_MAX = 100;

/** La table n'existe pas encore (migration pas jouée) : Prisma P2021. */
function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** La qualité déclarée par l'apporteur, ou `null` (rien déclaré, ou table absente). */
export async function lireQualite(apporteurId: string): Promise<QualiteApporteur | null> {
  try {
    return await prisma.apporteurReseauQualite.findUnique({
      where: { apporteurId },
      select: { siegeAdresse: true, fonctionSignataire: true, immatriculeRcs: true },
    });
  } catch (err) {
    // Le contrat garde alors la formule générale de la 2.7 (valable) : une lecture en échec ne
    // bloque jamais le dossier ni la signature ; elle est signalée.
    if (!tableAbsente(err)) signalerErreurReseau("lecture de la qualité (art. 14)", err);
    return null;
  }
}

/** Écrit la qualité (dossier en ligne). Rend `false` si la table n'existe pas encore. */
export async function enregistrerQualite(
  apporteurId: string,
  q: QualiteApporteur,
): Promise<boolean> {
  try {
    await prisma.apporteurReseauQualite.upsert({
      where: { apporteurId },
      create: { apporteurId, ...q },
      update: q,
    });
    return true;
  } catch (err) {
    if (tableAbsente(err)) return false;
    throw err;
  }
}
