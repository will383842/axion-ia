/**
 * Réseau d'apporteurs — la LECTURE cloisonnée de la page « Mes commissions » (lecture seule).
 *
 * RÈGLES (verrouillées par `__tests__/espace-commissions.spec.ts`) :
 *   · chaque requête porte `apporteurId: dossier.id` dans son `where`, sauf la lecture de
 *     `PresentationReservation`, qui n'a pas de colonne apporteur et se fait par `presentationId`
 *     parmi les présentations de CET apporteur (provenance prouvée par la première requête) ;
 *   · l'identifiant vient de `lireDossierParLien`, jamais de l'adresse ;
 *   · aucun appel aux fonctions de calcul ou d'attribution : on relit ce qui est écrit en base ;
 *   · colonnes ÉNUMÉRÉES : aucune coordonnée, aucun motif de contestation, aucun prix client.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

import {
  assemblerEspaceCommissions,
  BORNE_COMMISSIONS,
  BORNE_PRESENTATIONS,
  type EspaceCommissionsVue,
  type RegimeTva,
} from "./espace-commissions-assemblage";

/** Un numéro d'autofacture ou d'avoir bien formé, 40 caractères au plus. */
export const NUMERO_PIECE = /^AXI-APP-\d{4}-\d{4,}$/;
export const NUMERO_PIECE_MAX = 40;

export async function lireEspaceCommissions(
  dossier: { id: string; regimeTva: RegimeTva },
  maintenant: Date = new Date(),
): Promise<EspaceCommissionsVue> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return {
      entreprises: [],
      horsEntreprise: [],
      virements: [],
      pieces: [],
      tronque: false,
    };
  }
  const apporteurId = dossier.id;
  const [presentations, commissions] = await Promise.all([
    prisma.presentationEntreprise.findMany({
      where: { apporteurId },
      orderBy: { recueAt: "desc" },
      take: BORNE_PRESENTATIONS + 1,
      select: {
        id: true,
        denomination: true,
        recueAt: true,
        statut: true,
        contactEnvoyeAt: true,
        protegeeJusquAt: true,
      },
    }),
    prisma.commissionApporteur.findMany({
      where: { apporteurId },
      orderBy: { creeAt: "desc" },
      take: BORNE_COMMISSIONS + 1,
      select: {
        id: true,
        presentationId: true,
        parrainage: true,
        activite: true,
        palier: true,
        montantCents: true,
        statut: true,
        releveMois: true,
        autofactureNumero: true,
        autofactureEmiseAt: true,
        avoirNumero: true,
        autofactureAttenteMotif: true,
        litigeDepuis: true,
        verseeAt: true,
        majAt: true,
        presentation: { select: { apporteurId: true } },
      },
    }),
  ]);
  const tronque =
    presentations.length > BORNE_PRESENTATIONS || commissions.length > BORNE_COMMISSIONS;
  const mesPresentations = presentations.slice(0, BORNE_PRESENTATIONS);
  const mesCommissions = commissions.slice(0, BORNE_COMMISSIONS);

  // Pas de colonne apporteur ici : on lit par `presentationId` parmi les présentations ci-dessus.
  const reservations =
    mesPresentations.length === 0
      ? []
      : await prisma.presentationReservation.findMany({
          where: { presentationId: { in: mesPresentations.map((p) => p.id) } },
          select: { presentationId: true, reserveeJusquAt: true, valideeAt: true },
        });

  return assemblerEspaceCommissions({
    apporteurId,
    regimeTva: dossier.regimeTva,
    maintenant,
    presentations: mesPresentations,
    reservations,
    commissions: mesCommissions.map(({ presentation, ...c }) => ({
      ...c,
      presentationApporteurId: presentation?.apporteurId ?? null,
    })),
    tronque,
  });
}

/**
 * La pièce (autofacture ou avoir) de CET apporteur, par son numéro : `null` pour un numéro mal
 * formé, inexistant ou appartenant à un autre (même réponse dans les trois cas).
 */
export async function numeroDePieceDeLApporteur(
  apporteurId: string,
  numero: string,
): Promise<string | null> {
  if (numero.length > NUMERO_PIECE_MAX || !NUMERO_PIECE.test(numero)) return null;
  const l = await prisma.commissionApporteur.findFirst({
    where: { apporteurId, OR: [{ autofactureNumero: numero }, { avoirNumero: numero }] },
    select: { id: true },
  });
  return l ? numero : null;
}
