/**
 * Journal des autofactures (point 25) — CSV pour l'expert-comptable. PUR.
 * Séparateur « ; », UTF-8 avec BOM, montants « 1234,56 », dates « JJ/MM/AAAA » (jour de Paris).
 * Un avoir est écrit en POSITIF, son genre le dit.
 */
import { jourParis } from "./autofacture-donnees";
import { totauxAbsents, type LigneJournal } from "./journal-autofactures-types";

export const ENTETE_CSV_JOURNAL = [
  "Date",
  "Numéro",
  "Genre",
  "Facture rectifiée",
  "Apporteur",
  "SIREN",
  "Régime TVA",
  "N° TVA",
  "HT",
  "TVA",
  "TTC",
  "Virée le",
] as const;

export const LIBELLE_TOTAUX_ABSENTS = "Totaux absents (pièce reprise)";

/** « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
export function jourFr(d: Date): string {
  const [a, m, j] = jourParis(d).split("-");
  return `${j}/${m}/${a}`;
}

/** Centimes → « 1234,56 » (valeur absolue : un avoir s'écrit en positif). */
export function montantFr(cents: number): string {
  const v = Math.abs(cents);
  return `${Math.trunc(v / 100)},${String(v % 100).padStart(2, "0")}`;
}

function cellule(v: string): string {
  // Une cellule qui commence par = + - @ serait lue comme une formule par un tableur.
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function construireCsvJournal(lignes: readonly LigneJournal[]): string {
  const sortie = [ENTETE_CSV_JOURNAL.join(";")];
  for (const l of lignes) {
    const absents = totauxAbsents(l);
    const montants = absents
      ? [LIBELLE_TOTAUX_ABSENTS, "", ""]
      : [montantFr(l.totalHtCents!), montantFr(l.totalTvaCents!), montantFr(l.totalTtcCents!)];
    sortie.push(
      [
        jourFr(l.emiseAt),
        l.numero,
        l.genre === "avoir" ? "Avoir" : "Autofacture",
        l.factureRectifiee ?? "",
        l.denomination ?? "",
        l.siren ?? "",
        l.regimeTva === "assujetti" ? "Assujetti" : "Franchise en base (art. 293 B)",
        l.numeroTva ?? "",
        ...montants,
        l.viree.map(jourFr).join(" / "),
      ]
        .map(cellule)
        .join(";"),
    );
  }
  return `﻿${sortie.join("\r\n")}\r\n`;
}
