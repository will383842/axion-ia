/**
 * Relevé mensuel des apporteurs : LECTURE des entrées du calcul (lot 3c). Aucune écriture.
 *
 * Ce module ne calcule AUCUN montant : il lit les lignes que `calcul.ts` consomme (`EntreeReleve`).
 * Contrat de `EntreeReleve.commissions` : toute commission de l'apporteur ayant un évènement dans
 * `[1er janvier ; coupure[` (émission, avoir, virement, attente d'autofacture), PLUS toute
 * commission facturée et non virée à la coupure QUELLE QUE SOIT l'année d'émission (réutilise
 * `conditionsCommissionQ4b`, la définition partagée avec le ciblage), PLUS les frères d'une
 * autofacture lue (le virement d'une autofacture se calcule sur TOUTES ses lignes). Sans `server-only`
 * (le worker l'atteint par `tsx`).
 */
import { facturesClientDesLignes } from "../prime-challenge";
import { prisma } from "@/lib/prisma";

import { paiementsIntegrauxParFacture } from "../paiement-integral";
import { bornesPeriode, debutAnnee, exigerPeriodeClose } from "./periode";
import { conditionsCommissionQ4b } from "./statistiques";
import type { CommissionLue, EntreeReleve, PieceLue } from "./types";

import type { Prisma } from "../../../../prisma/generated/client";

/** Au-delà, la lecture REFUSE (jamais de troncature silencieuse d'un relevé). */
export const BORNE_LIGNES_PAR_APPORTEUR = 5000;

const SELECT_COMMISSION = {
  id: true,
  factureId: true,
  activite: true,
  palier: true,
  parrainage: true,
  statut: true,
  montantCents: true,
  factureHtCents: true,
  prixPublicHtCents: true,
  autofactureNumero: true,
  autofactureEmiseAt: true,
  avoirNumero: true,
  autofactureAttenteMotif: true,
  autofactureAttenteDepuis: true,
  litigeDepuis: true,
  verseeAt: true,
  creeAt: true,
  majAt: true,
  regleAppliquee: true,
  versionContrat: true,
  presentation: { select: { denomination: true } },
} satisfies Prisma.CommissionApporteurSelect;

/** Filtre « commissions à lire » d'un apporteur pour une période (exporté pour être testé). */
export function conditionsLecture(
  periode: string,
  avoirsDeLAnnee: readonly string[],
): Prisma.CommissionApporteurWhereInput[] {
  const { debut, coupure } = bornesPeriode(periode);
  const debutA = debutAnnee(periode);
  return [
    // D1, D2 et mouvements du mois : LA définition partagée avec le ciblage (statistiques.ts).
    conditionsCommissionQ4b(debut, coupure),
    // Année civile (cumul E) : émission (repli majAt), virement, attente d'autofacture.
    {
      autofactureNumero: { not: null },
      avoirNumero: null,
      OR: [
        { autofactureEmiseAt: { gte: debutA, lt: coupure } },
        { autofactureEmiseAt: null, majAt: { gte: debutA, lt: coupure } },
      ],
    },
    { verseeAt: { gte: debutA, lt: coupure } },
    { autofactureAttenteDepuis: { gte: debutA, lt: coupure } },
    ...(avoirsDeLAnnee.length ? [{ avoirNumero: { in: [...avoirsDeLAnnee] } }] : []),
    // D3 (indicatif) : lignes créées avant la coupure, sans date de sortie.
    {
      creeAt: { lt: coupure },
      OR: [
        { statut: { in: ["a_qualifier", "en_attente_vigilance"] } },
        { litigeDepuis: { not: null } },
      ],
    },
  ];
}

type LigneBrute = Prisma.CommissionApporteurGetPayload<{ select: typeof SELECT_COMMISSION }>;

export async function lireEntreeReleve(
  apporteurId: string,
  periode: string,
  preparationAt: Date,
): Promise<EntreeReleve> {
  exigerPeriodeClose(periode, preparationAt);
  const { coupure } = bornesPeriode(periode);
  const debutA = debutAnnee(periode);

  const piecesBrutes = await prisma.pieceAutofactureApporteur.findMany({
    where: { apporteurId },
    select: {
      numero: true,
      genre: true,
      regimeTva: true,
      totalHtCents: true,
      totalTvaCents: true,
      totalTtcCents: true,
      factureRectifiee: true,
      emiseAt: true,
    },
    take: BORNE_LIGNES_PAR_APPORTEUR + 1,
  });
  if (piecesBrutes.length > BORNE_LIGNES_PAR_APPORTEUR) {
    throw new Error("relevé : trop de pièces pour un apporteur (lecture refusée, jamais tronquée)");
  }
  const avoirsDeLAnnee = piecesBrutes
    .filter((p) => p.genre === "avoir" && p.emiseAt >= debutA && p.emiseAt < coupure)
    .map((p) => p.numero);

  const premieres = await prisma.commissionApporteur.findMany({
    where: { apporteurId, OR: conditionsLecture(periode, avoirsDeLAnnee) },
    select: SELECT_COMMISSION,
    take: BORNE_LIGNES_PAR_APPORTEUR + 1,
  });
  if (premieres.length > BORNE_LIGNES_PAR_APPORTEUR) {
    throw new Error(
      "relevé : trop de commissions pour un apporteur (lecture refusée, jamais tronquée)",
    );
  }
  // Les frères d'une autofacture lue : son virement se calcule sur toutes ses lignes.
  const ids = new Set(premieres.map((c) => c.id));
  const numeros = [
    ...new Set(premieres.map((c) => c.autofactureNumero).filter((n): n is string => n !== null)),
  ];
  const freres: LigneBrute[] = numeros.length
    ? await prisma.commissionApporteur.findMany({
        where: { apporteurId, autofactureNumero: { in: numeros }, id: { notIn: [...ids] } },
        select: SELECT_COMMISSION,
        take: BORNE_LIGNES_PAR_APPORTEUR + 1,
      })
    : [];
  if (freres.length > BORNE_LIGNES_PAR_APPORTEUR) {
    throw new Error("relevé : trop de lignes d'autofacture (lecture refusée, jamais tronquée)");
  }
  const brutes = [...premieres, ...freres];

  // Une prime de challenge n'a pas de facture client : ni jointure ni paiement intégral à lire.
  const factureIds = [...new Set(facturesClientDesLignes(brutes))];
  const [factures, paiements] = await Promise.all([
    factureIds.length
      ? prisma.factureFormation.findMany({
          where: { id: { in: factureIds } },
          select: { id: true, numero: true, emiseAt: true },
        })
      : Promise.resolve([]),
    paiementsIntegrauxParFacture(factureIds),
  ]);
  const parFacture = new Map(factures.map((f) => [f.id, f]));

  const commissions: CommissionLue[] = brutes.map((c) => {
    const f = parFacture.get(c.factureId);
    return {
      id: c.id,
      activite: c.activite,
      palier: c.palier,
      parrainage: c.parrainage,
      statut: c.statut,
      montantCents: c.montantCents,
      factureHtCents: c.factureHtCents,
      prixPublicHtCents: c.prixPublicHtCents,
      entreprise: c.presentation?.denomination ?? null,
      factureClientNumero: f?.numero ?? null,
      factureClientDate: f?.emiseAt ?? null,
      encaissementIntegralAt: paiements.get(c.factureId) ?? null,
      autofactureNumero: c.autofactureNumero,
      autofactureEmiseAt: c.autofactureEmiseAt,
      avoirNumero: c.avoirNumero,
      autofactureAttenteMotif: c.autofactureAttenteMotif,
      autofactureAttenteDepuis: c.autofactureAttenteDepuis,
      litigeDepuis: c.litigeDepuis,
      verseeAt: c.verseeAt,
      creeAt: c.creeAt,
      majAt: c.majAt,
      regleAppliquee: c.regleAppliquee,
      versionContrat: c.versionContrat,
    };
  });
  const pieces: PieceLue[] = piecesBrutes.map((p) => ({
    numero: p.numero,
    genre: p.genre,
    regimeTva: p.regimeTva,
    totalHtCents: p.totalHtCents,
    totalTvaCents: p.totalTvaCents,
    totalTtcCents: p.totalTtcCents,
    factureRectifiee: p.factureRectifiee,
    emiseAt: p.emiseAt,
  }));
  return { periode, preparationAt, commissions, pieces };
}
