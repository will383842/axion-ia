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
import {
  lireSourceRendezVous,
  rendezVousNonTenu,
} from "@/features/apporteurs-reseau/statut-rendez-vous";
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
 * Les rendez-vous proposés qui attendent le dirigeant (0 tant que l'interrupteur est éteint).
 * Ne compte QUE ce qu'il a à traiter : jamais un nombre de présentations par apporteur.
 */
async function propositionsATraiter(): Promise<number> {
  if (!validationParRendezVousActive()) return 0;
  const l = await prisma.propositionRendezVousPresentation.findMany({
    where: { ecarteeAt: null, retenueAt: null },
    select: { presentationId: true, rendezVousCle: true },
    take: 500,
  });
  if (l.length === 0) return 0;
  const reservees = await prisma.presentationEntreprise.findMany({
    where: { id: { in: [...new Set(l.map((x) => x.presentationId))] }, statut: "reservee" },
    select: { id: true },
  });
  const ouvertes = new Set(reservees.map((x) => x.id));
  // Même règle que la liste de la console : un rendez-vous annulé, manqué ou reporté depuis la
  // proposition n'est plus « à traiter » (il n'a pas eu lieu).
  const nonTenus = new Map<string, boolean>();
  const aTraiter = new Set<string>();
  for (const x of l) {
    if (!ouvertes.has(x.presentationId)) continue;
    let non = nonTenus.get(x.rendezVousCle);
    if (non === undefined) {
      const src = await lireSourceRendezVous(prisma, x.rendezVousCle);
      non = !!src && rendezVousNonTenu(src);
      nonTenus.set(x.rendezVousCle, non);
    }
    if (!non) aTraiter.add(x.presentationId);
  }
  return aTraiter.size;
}
