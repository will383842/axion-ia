/**
 * PAIEMENTS SORTANTS — la déclaration DAS 2 COMMUNE (FAC-9, décision 70).
 *
 * Un seul fichier par an pour les apporteurs, les formateurs et les organismes,
 * avec UN seul seuil (`SEUIL_DAS2_COMMUN_CENTS`). Les lignes des apporteurs sont
 * celles de leur export existant (`lignesDas2Apporteurs`, inchangé) ; celles des
 * formateurs sont lues dans leurs relevés PAYÉS dans l'année.
 *
 * Ce module ne remplace rien : l'export des apporteurs reste en place, avec son
 * propre seuil, tant que Will n'a pas choisi la bascule.
 */

import { SEUIL_DAS2_COMMUN_CENTS } from "./parametres";
import type { FluxPaiement } from "./virements";

export interface LigneDas2Commune {
  readonly flux: FluxPaiement | "organisme";
  readonly beneficiaire: string;
  readonly denomination: string | null;
  readonly siren: string | null;
  readonly siret: string | null;
  readonly adresse: string | null;
  /** Total versé dans l'année, TTC, avoirs déduits, en centimes. */
  readonly totalCents: number;
  readonly pieces: number;
}

/**
 * Un champ CSV sûr : guillemets doublés, et un texte qui commence par `=`, `+`,
 * `-`, `@`, une tabulation ou un retour chariot est préfixé d'une apostrophe
 * (un tableur l'exécuterait comme une formule). Les nombres ne sont pas touchés.
 */
function champCsv(v: string | number | null): string {
  if (typeof v === "number") return String(v);
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function euros(c: number): string {
  const signe = c < 0 ? "-" : "";
  const a = Math.abs(c);
  return `${signe}${Math.floor(a / 100)},${String(a % 100).padStart(2, "0")}`;
}

/** Pure : le CSV (séparateur « ; », BOM, CRLF), trié par flux puis bénéficiaire. */
export function construireDas2Commune(
  annee: number,
  lignes: ReadonlyArray<LigneDas2Commune>,
  seuilCents: number = SEUIL_DAS2_COMMUN_CENTS,
): string {
  const entete = [
    "annee",
    "flux",
    "beneficiaire",
    "denomination",
    "siren",
    "siret",
    "adresse",
    "montant_verse_eur",
    "nombre_pieces",
    "a_declarer",
  ];
  // Le seuil s'apprécie PAR BÉNÉFICIAIRE : une même entreprise (même SIREN) payée
  // comme apporteur ET comme formateur cumule ses deux flux.
  const cumulParSiren = new Map<string, number>();
  for (const l of lignes) {
    if (l.siren) cumulParSiren.set(l.siren, (cumulParSiren.get(l.siren) ?? 0) + l.totalCents);
  }
  const total = (l: LigneDas2Commune): number =>
    l.siren ? (cumulParSiren.get(l.siren) ?? l.totalCents) : l.totalCents;
  const triees = [...lignes].sort((a, b) =>
    a.flux === b.flux
      ? a.beneficiaire.localeCompare(b.beneficiaire, "fr")
      : a.flux < b.flux
        ? -1
        : 1,
  );
  const corps = triees.map((l) =>
    [
      annee,
      l.flux,
      l.beneficiaire,
      l.denomination,
      l.siren,
      l.siret,
      l.adresse,
      { montant: euros(l.totalCents) },
      l.pieces,
      // « au-delà du seuil » : strictement supérieur, comme l'export existant ;
      // apprécié sur le cumul du SIREN, tous flux confondus.
      total(l) > seuilCents ? "oui" : "non",
    ]
      .map((x) => (typeof x === "object" && x !== null ? x.montant : champCsv(x)))
      .join(";"),
  );
  return `﻿${[entete.join(";"), ...corps].join("\r\n")}\r\n`;
}

/** Bornes de l'année civile à Paris, approximées comme l'export existant (UTC − 1 h). */
function bornesAnnee(annee: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(annee, 0, 1) - 3_600_000),
    lt: new Date(Date.UTC(annee + 1, 0, 1) - 3_600_000),
  };
}

/**
 * Pure : regroupe les relevés payés d'un formateur (ou d'un organisme) en une
 * ligne par bénéficiaire. Un avoir (montant négatif) vient en déduction.
 */
export function regrouperRelevesPayes(
  releves: ReadonlyArray<{
    readonly beneficiaireId: string;
    readonly flux: "formateur" | "organisme";
    readonly beneficiaire: string;
    readonly siret: string | null;
    readonly adresse: string | null;
    readonly totalTtcCents: number;
  }>,
): LigneDas2Commune[] {
  const parBeneficiaire = new Map<string, LigneDas2Commune>();
  for (const r of releves) {
    const cle = `${r.flux}:${r.beneficiaireId}`;
    const cur = parBeneficiaire.get(cle);
    parBeneficiaire.set(cle, {
      flux: r.flux,
      beneficiaire: r.beneficiaire,
      denomination: null,
      siren: r.siret ? r.siret.slice(0, 9) : null,
      siret: r.siret,
      adresse: r.adresse,
      totalCents: (cur?.totalCents ?? 0) + r.totalTtcCents,
      pieces: (cur?.pieces ?? 0) + 1,
    });
  }
  return [...parBeneficiaire.values()];
}

/** La déclaration commune de l'année, lue en base (lecture seule). */
export async function exportDas2Commune(annee: number): Promise<string> {
  const [{ lignesDas2Apporteurs }, { prisma }] = await Promise.all([
    import("@/features/apporteurs-reseau/commissions"),
    import("@/lib/prisma"),
  ]);
  const [apporteurs, payes] = await Promise.all([
    lignesDas2Apporteurs(annee),
    prisma.trainerStatement.findMany({
      where: { statut: "paye", payeAt: bornesAnnee(annee) },
      select: {
        trainerId: true,
        totalTtcCents: true,
        montantFactureTtcCents: true,
        trainer: {
          select: { prenom: true, nom: true, siret: true, adresseProfessionnelle: true },
        },
      },
    }),
  ]);
  const formateurs = regrouperRelevesPayes(
    payes.map((r) => ({
      beneficiaireId: r.trainerId,
      flux: "formateur" as const,
      beneficiaire: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      siret: r.trainer.siret,
      adresse: r.trainer.adresseProfessionnelle,
      // Ce qui a été versé : la facture rapprochée, sinon le relevé.
      totalTtcCents: r.montantFactureTtcCents ?? r.totalTtcCents,
    })),
  );
  const lignes: LigneDas2Commune[] = [
    ...apporteurs.map((a): LigneDas2Commune => ({
      flux: "apporteur",
      beneficiaire: a.nom,
      denomination: a.denomination,
      siren: a.siren,
      siret: a.siret ?? null,
      adresse: a.adresse,
      totalCents: a.totalCents,
      pieces: a.lignes,
    })),
    ...formateurs,
  ];
  return construireDas2Commune(annee, lignes);
}
