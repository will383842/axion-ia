/**
 * Argent de la fiche client (lot B7) : fonctions PURES, affichage seul, aucune écriture.
 * Les règles d'avoir sont celles de `resteDuNetCents` (avoirs non annulés, montants NÉGATIFS en base) ;
 * « reste dû » vient toujours de `resteDuNetCents` / `calculerEncoursDuCents`, jamais recalculé ici.
 */

import { resteDuNetCents } from "@/server/qualiopi/crm/clients";
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

// Point d'entrée UNIQUE du domaine pour les cartes et tuiles du lot B7 : elles ne l'importent pas elles-mêmes.
export { estFactureOuverte, resteDuNetCents };

export interface FacturePourArgent {
  statut: string;
  avoirDeId: string | null;
  montantHtCents: number;
  montantTtcCents: number | null;
  payments: { amountCents: number; status: string }[];
  avoirs: { montantHtCents: number; montantTtcCents: number | null; statut: string }[];
}

/** Facture réellement émise : ni brouillon, ni annulée. */
export function estFactureEmise(statut: string): boolean {
  return statut !== "brouillon" && statut !== "annulee";
}

export interface DejaFacture {
  /** Somme HT des factures émises non annulées, avoirs non annulés déduits. */
  htCents: number;
  /** Même somme en TTC (repli HT pour une facture sans TTC, voir `nbSansTtc`). */
  ttcCents: number;
  /** Nombre de factures (ou avoirs) émises dont le TTC est NULL : leur HT a servi de repli. */
  nbSansTtc: number;
}

/**
 * Les avoirs sont comptés une seule fois, via `avoirs` de la facture qu'ils corrigent
 * (les lignes `avoirDeId` non null de la liste sont ignorées, comme dans `calculerEncoursDuCents`).
 */
export function dejaFactureCents(factures: readonly FacturePourArgent[]): DejaFacture {
  let htCents = 0;
  let ttcCents = 0;
  let nbSansTtc = 0;
  for (const f of factures) {
    if (f.avoirDeId !== null || !estFactureEmise(f.statut)) continue;
    htCents += f.montantHtCents;
    ttcCents += f.montantTtcCents ?? f.montantHtCents;
    if (f.montantTtcCents === null) nbSansTtc += 1;
    for (const a of f.avoirs) {
      if (a.statut === "annulee") continue;
      htCents += a.montantHtCents;
      ttcCents += a.montantTtcCents ?? a.montantHtCents;
      if (a.montantTtcCents === null) nbSansTtc += 1;
    }
  }
  return { htCents, ttcCents, nbSansTtc };
}

/** Total HT déjà facturé (raccourci de `dejaFactureCents`). */
export function dejaFactureHtCents(factures: readonly FacturePourArgent[]): number {
  return dejaFactureCents(factures).htCents;
}

/** Devis envoyés au client, pas encore acceptés ni refusés : nombre et total HT. */
export function devisEnAttente(
  devis: ReadonlyArray<{ statut: string; montantTotalHtCents: number }>,
): {
  nombre: number;
  htCents: number;
} {
  const en = devis.filter((d) => d.statut === "envoye");
  return { nombre: en.length, htCents: en.reduce((acc, d) => acc + d.montantTotalHtCents, 0) };
}

/** Encaissé (paiements `succeeded`) d'une facture, TTC. */
export function encaisseCents(f: Pick<FacturePourArgent, "payments">): number {
  return f.payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amountCents, 0);
}

/**
 * « Payée en partie » : facture ouverte avec un encaissement ET un reste dû.
 * `resteCents` vient de `resteDuNetCents` (seule source).
 */
export function paiementPartiel(
  f: FacturePourArgent,
): { recuCents: number; resteCents: number } | null {
  if (f.avoirDeId !== null || !estFactureOuverte(f.statut)) return null;
  const recuCents = encaisseCents(f);
  const resteCents = resteDuNetCents(f);
  return recuCents > 0 && resteCents > 0 ? { recuCents, resteCents } : null;
}

const FORMAT_ENTIER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const FORMAT_CENTIMES = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FORMAT_DATE_COURTE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
});

/** « 1 440 » ou « 1 440,50 » (espaces insécables) : le suffixe HT / TTC est ajouté par l'appelant. */
export function montantEnEuros(cents: number): string {
  return (cents % 100 === 0 ? FORMAT_ENTIER : FORMAT_CENTIMES)
    .format(cents / 100)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

export function montantHt(cents: number): string {
  return `${montantEnEuros(cents)}\u00a0€\u00a0HT`; // price-exempt
}

export function montantTtc(cents: number): string {
  return `${montantEnEuros(cents)}\u00a0€\u00a0TTC`; // price-exempt
}

/** « 16 oct. » (Europe/Paris). */
export function dateCourte(d: Date): string {
  return FORMAT_DATE_COURTE.format(d);
}
