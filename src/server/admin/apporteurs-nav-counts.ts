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

import { validationParRendezVousActive } from "@/features/apporteurs-reseau/interrupteur-rendez-vous";
import { idsRetires } from "@/features/apporteurs-reseau/retrait";
import { prisma } from "@/lib/prisma";

export interface ApporteursNavCounts {
  presentations: number;
  /** Rendez-vous proposés par l'outil que le dirigeant n'a ni validés ni écartés (0 si éteint). */
  propositions: number;
  pieces: number;
  virements: number;
}

export const APPORTEURS_NAV_VIDES: ApporteursNavCounts = {
  presentations: 0,
  propositions: 0,
  pieces: 0,
  virements: 0,
};

export async function compterApporteursNav(
  _maintenant: Date = new Date(),
): Promise<ApporteursNavCounts> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return APPORTEURS_NAV_VIDES;
  // Les pièces d'un apporteur RETIRÉ du réseau ne comptent pas dans la pastille (relecture de
  // a1, 08/10) : elles restent consultables sur sa fiche, onglet « Retirés ».
  const retires = await idsRetires().catch(() => new Set<string>());
  const [presentations, propositions, pieces, virements] = await Promise.all([
    prisma.presentationEntreprise
      .count({ where: { statut: "reservee", contactEnvoyeAt: null } })
      .catch(() => 0),
    propositionsATraiter().catch(() => 0),
    prisma.pieceApporteur
      .count({
        where: {
          type: { in: ["vigilance", "immatriculation"] },
          statut: "deposee",
          remplaceeAt: null,
          purgeeAt: null,
          ...(retires.size > 0 ? { apporteurId: { notIn: [...retires] } } : {}),
        },
      })
      .catch(() => 0),
    virementsAFaire().catch(() => 0),
  ]);
  return { presentations, propositions, pieces, virements };
}

async function virementsAFaire(): Promise<number> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["autofactureNumero"],
    where: { statut: "due", autofactureNumero: { not: null } },
  });
  return g.length;
}

/**
 * Les rendez-vous proposés qui attendent le dirigeant (0 tant que l'interrupteur est éteint) :
 * EXACTEMENT les lignes de la liste de la console, annulées comprises (un rendez-vous annulé et
 * pas encore tranché est une décision à prendre : il retient l'ancien apporteur). Aucune lecture
 * de la source ; jamais un nombre de présentations par apporteur.
 */
async function propositionsATraiter(): Promise<number> {
  if (!validationParRendezVousActive()) return 0;
  const reservees = await prisma.presentationEntreprise.findMany({
    where: { statut: "reservee" },
    select: { id: true },
  });
  if (reservees.length === 0) return 0;
  return prisma.propositionRendezVousPresentation.count({
    where: {
      ecarteeAt: null,
      retenueAt: null,
      presentationId: { in: reservees.map((x) => x.id) },
    },
  });
}
