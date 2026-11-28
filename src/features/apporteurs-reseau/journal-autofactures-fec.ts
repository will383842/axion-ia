/**
 * Journal des autofactures (point 25) — FEC (art. A.47 A-1 du LPF). PUR.
 *
 * ⚠️ Les comptes ci-dessous sont « À CONFIRMER PAR L'EXPERT-COMPTABLE » avant la première
 * utilisation. Ils sont regroupés ICI, et nulle part ailleurs : une correction tient en une ligne.
 *
 * Autofacture : débit 6222 du HT, débit 44566 de la TVA (si assujetti), crédit 401 (auxiliaire
 * `APP<SIREN>`) du TTC. Avoir : écritures inverses. Une pièce aux totaux absents ou incohérents
 * fait REFUSER l'export : jamais d'écriture inventée.
 */
import { jourParis } from "./autofacture-donnees";
import { montantFr } from "./journal-autofactures-csv";
import { totauxAbsents, type LigneJournal } from "./journal-autofactures-types";

export const COMPTES_FEC = {
  /** À confirmer par l'expert-comptable. */
  commissions: { num: "6222", lib: "Commissions et courtages" },
  /** À confirmer par l'expert-comptable. */
  tvaDeductible: { num: "44566", lib: "TVA déductible sur autres biens et services" },
  /** À confirmer par l'expert-comptable. Compte auxiliaire : `APP<SIREN>`. */
  fournisseur: { num: "401", lib: "Fournisseurs" },
  prefixeAuxiliaire: "APP",
} as const;

export const JOURNAL_FEC = { code: "APP", lib: "Autofactures apporteurs" } as const;

export const COLONNES_FEC = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

export class ErreurFec extends Error {
  constructor(
    message: string,
    readonly numeros: readonly string[],
  ) {
    super(message);
    this.name = "ErreurFec";
  }
}

const aaaammjj = (d: Date) => jourParis(d).replace(/-/g, "");
const propre = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

export function construireFec(lignes: readonly LigneJournal[]): string {
  const absents = lignes.filter(totauxAbsents).map((l) => l.numero);
  if (absents.length > 0)
    throw new ErreurFec("Totaux absents : export FEC impossible pour ces pièces.", absents);
  const incoherents = lignes
    .filter((l) => l.totalHtCents! + l.totalTvaCents! !== l.totalTtcCents!)
    .map((l) => l.numero);
  if (incoherents.length > 0)
    throw new ErreurFec("HT + TVA ≠ TTC : export FEC impossible pour ces pièces.", incoherents);

  const negatifs = lignes
    .filter((l) => l.totalHtCents! < 0 || l.totalTvaCents! < 0 || l.totalTtcCents! < 0)
    .map((l) => l.numero);
  if (negatifs.length > 0)
    throw new ErreurFec("Total négatif : export FEC impossible pour ces pièces.", negatifs);
  const franchiseTva = lignes
    .filter((l) => l.regimeTva !== "assujetti" && l.totalTvaCents! !== 0)
    .map((l) => l.numero);
  if (franchiseTva.length > 0)
    throw new ErreurFec(
      "TVA non nulle en franchise : export FEC impossible pour ces pièces.",
      franchiseTva,
    );
  const sansSiren = lignes.filter((l) => !l.siren).map((l) => l.numero);
  if (sansSiren.length > 0)
    throw new ErreurFec("SIREN absent : export FEC impossible pour ces pièces.", sansSiren);

  const sortie: string[] = [COLONNES_FEC.join("\t")];
  let n = 0;
  for (const l of lignes) {
    n += 1;
    const date = aaaammjj(l.emiseAt);
    const avoir = l.genre === "avoir";
    const aux = `${COMPTES_FEC.prefixeAuxiliaire}${l.siren ?? ""}`;
    const libelle = propre(
      `${avoir ? "Avoir" : "Autofacture"} ${l.numero} ${l.denomination ?? ""}`,
    );
    const ecrire = (
      c: { num: string; lib: string },
      sens: "debit" | "credit",
      cents: number,
      auxiliaire: boolean,
    ) => {
      const v = montantFr(cents);
      sortie.push(
        [
          JOURNAL_FEC.code,
          JOURNAL_FEC.lib,
          String(n),
          date,
          c.num,
          c.lib,
          auxiliaire ? aux : "",
          auxiliaire ? propre(l.denomination ?? "") : "",
          l.numero,
          date,
          libelle,
          sens === "debit" ? v : "0,00",
          sens === "credit" ? v : "0,00",
          "",
          "",
          date,
          "",
          "",
        ].join("\t"),
      );
    };
    // Autofacture : charge au débit, dette fournisseur au crédit. Avoir : l'inverse.
    const chargeSens = avoir ? "credit" : "debit";
    const fournisseurSens = avoir ? "debit" : "credit";
    ecrire(COMPTES_FEC.commissions, chargeSens, l.totalHtCents!, false);
    if (l.regimeTva === "assujetti" && l.totalTvaCents! !== 0)
      ecrire(COMPTES_FEC.tvaDeductible, chargeSens, l.totalTvaCents!, false);
    ecrire(COMPTES_FEC.fournisseur, fournisseurSens, l.totalTtcCents!, true);
  }
  return `${sortie.join("\r\n")}\r\n`;
}
