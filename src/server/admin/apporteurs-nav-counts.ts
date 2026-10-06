/**
 * Pastilles du menu « Apporteurs d'affaires » : trois compteurs « reste à faire », qui
 * descendent à zéro (même philosophie que les pastilles Qualiopi).
 *
 *   · présentations à traiter : déclarations sans réponse « Bien reçu / Déjà connue / … » ;
 *   · pièces de vigilance déposées : attestation URSSAF ou extrait d'immatriculation à juger ;
 *   · relevés du mois à émettre : apporteurs dont le solde net (dues moins reprises) donne
 *     lieu à un relevé (`releveEmis`, seuil de 50 € hors janvier et dernier relevé).
 *
 * Prisma seul (pas d'`@/auth`, pas de rendu) : fail-soft, chaque compteur retombe à 0.
 */

import { prisma } from "@/lib/prisma";
import { releveEmis } from "@/features/apporteurs-reseau/regles";

export interface ApporteursNavCounts {
  presentations: number;
  pieces: number;
  releve: number;
}

export const APPORTEURS_NAV_VIDES: ApporteursNavCounts = {
  presentations: 0,
  pieces: 0,
  releve: 0,
};

/** Mois civil (1 à 12) à Paris. */
function moisParis(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "2-digit" }).format(d),
  );
}

export async function compterApporteursNav(
  maintenant: Date = new Date(),
): Promise<ApporteursNavCounts> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return APPORTEURS_NAV_VIDES;
  const [presentations, pieces, releve] = await Promise.all([
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
    relevesAEmettre(maintenant).catch(() => 0),
  ]);
  return { presentations, pieces, releve };
}

async function relevesAEmettre(maintenant: Date): Promise<number> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: { statut: { in: ["due", "reprise"] }, releveMois: null, montantCents: { not: null } },
    _sum: { montantCents: true },
  });
  if (g.length === 0) return 0;
  const apporteurs = await prisma.apporteurReseau.findMany({
    where: { id: { in: g.map((x) => x.apporteurId) } },
    select: { id: true, statut: true },
  });
  const statut = new Map(apporteurs.map((a) => [a.id, a.statut]));
  const mois = moisParis(maintenant);
  return g.filter((x) =>
    releveEmis({
      soldeCents: x._sum.montantCents ?? 0,
      mois,
      dernier: statut.get(x.apporteurId) === "resilie",
    }),
  ).length;
}
