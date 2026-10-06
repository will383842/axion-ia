/**
 * Pastilles du menu « Apporteurs d'affaires » : trois compteurs « reste à faire », qui
 * descendent à zéro (même philosophie que les pastilles Qualiopi).
 *
 *   · présentations à traiter : déclarations sans réponse « Bien reçu / Déjà connue / … » ;
 *   · pièces de vigilance déposées : attestation URSSAF ou extrait d'immatriculation à juger ;
 *   · virements à faire : autofactures émises (commissions dues, `autofactureNumero` posé) dont le
 *     virement n'est pas encore confirmé par « Virement fait ».
 *
 * Prisma seul (pas d'`@/auth`, pas de rendu) : fail-soft, chaque compteur retombe à 0.
 */

import { prisma } from "@/lib/prisma";

export interface ApporteursNavCounts {
  presentations: number;
  pieces: number;
  virements: number;
}

export const APPORTEURS_NAV_VIDES: ApporteursNavCounts = {
  presentations: 0,
  pieces: 0,
  virements: 0,
};

export async function compterApporteursNav(
  _maintenant: Date = new Date(),
): Promise<ApporteursNavCounts> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return APPORTEURS_NAV_VIDES;
  const [presentations, pieces, virements] = await Promise.all([
    prisma.presentationEntreprise
      .count({ where: { statut: "reservee", contactEnvoyeAt: null } })
      .catch(() => 0),
    prisma.pieceApporteur
      .count({
        where: {
          type: { in: ["vigilance", "immatriculation"] },
          statut: "deposee",
          remplaceeAt: null,
          purgeeAt: null,
        },
      })
      .catch(() => 0),
    virementsAFaire().catch(() => 0),
  ]);
  return { presentations, pieces, virements };
}

async function virementsAFaire(): Promise<number> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["autofactureNumero"],
    where: { statut: "due", autofactureNumero: { not: null } },
  });
  return g.length;
}
