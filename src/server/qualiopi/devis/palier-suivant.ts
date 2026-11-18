/**
 * Palier d'échéancier SUIVANT à facturer sur un devis à formules — PUR.
 *
 * Réutilise `echeancierPhases` (offre-calculs) : le montant d'un palier est celui que
 * le devis imprime — floor(total × % / 100), le DERNIER palier absorbant le reste. Rien
 * n'est recalculé ici. Le palier suivant est le rang qui suit le nombre de factures
 * déjà émises (annulées exclues par l'appelant) : un palier facturé puis annulé se
 * représente donc de lui-même.
 */
import { z } from "zod";

import { echeancierPhases } from "./offre-calculs";
import { offreDevisV1, type Formule } from "./offre-devis";

export interface PalierSuivant {
  readonly rang: number;
  readonly libelle: string;
  readonly pourcentage: number;
  /** Dernier palier : il se facture comme SOLDE (les acomptes précédents sont déduits). */
  readonly estSolde: boolean;
  readonly montantHtCents: number;
  /** Nombre de paliers de l'échéancier. */
  readonly nbPaliers: number;
}

export type LecturePalier =
  | { readonly ok: true; readonly palier: PalierSuivant | null }
  | { readonly ok: false; readonly motif: string };

/**
 * @param offre              Json de `Devis.offre` (revalidé ici : jamais fait confiance au Json brut).
 * @param formuleRetenue     `Devis.formuleRetenue`.
 * @param totalHtCents       Total HT du devis tel que la FACTURATION le compte (Σ round(q × prix)).
 * @param nbFacturesEmises   Factures du devis non annulées, hors avoirs.
 * @returns `palier: null` quand tous les paliers sont déjà facturés.
 */
export function lirePalierSuivant(input: {
  offre: unknown;
  formuleRetenue: string | null;
  totalHtCents: number;
  nbFacturesEmises: number;
}): LecturePalier {
  const offre = offreDevisV1.safeParse(input.offre);
  if (!offre.success) return { ok: false, motif: "Offre du devis illisible." };
  const f = input.formuleRetenue as Formule | null;
  if (f !== "achat" && f !== "abonnement") {
    return { ok: false, motif: "Aucune formule retenue sur ce devis." };
  }
  const bloc = f === "achat" ? offre.data.achat : offre.data.abonnement;
  if (bloc === undefined || !offre.data.formulesProposees.includes(f)) {
    return { ok: false, motif: "Formule retenue absente de l'offre." };
  }
  const lignes =
    f === "achat" ? offre.data.achat?.lignes : offre.data.abonnement?.miseEnServiceLignes;
  const taux = [
    ...(lignes ?? []).map((l) => l.tauxTvaBps),
    ...offre.data.automatisations.map((a) => a.tauxTvaBps),
  ];
  let echeancier;
  try {
    echeancier = echeancierPhases(input.totalHtCents, bloc.phases, taux);
  } catch (err) {
    return { ok: false, motif: err instanceof Error ? err.message : "Échéancier invalide." };
  }
  const index = input.nbFacturesEmises;
  if (index >= echeancier.length) return { ok: true, palier: null };
  const triees = [...bloc.phases].sort((a, b) => a.rang - b.rang);
  const phase = triees[index]!;
  const palier = echeancier[index]!;
  return {
    ok: true,
    palier: {
      rang: palier.rang,
      libelle: palier.libelle,
      pourcentage: phase.pourcentage,
      estSolde: index === echeancier.length - 1,
      montantHtCents: palier.montantHtCents,
      nbPaliers: echeancier.length,
    },
  };
}

const ligneMontant = z.object({ quantite: z.number().positive(), prixUnitaireHtCents: z.number() });

/**
 * Total HT des lignes d'un devis TEL QUE LA FACTURATION le compte (Σ round(q × prix),
 * comme `planifierFacturationDevis`). `null` si les lignes sont illisibles ou vides.
 */
export function totalHtLignesDevis(lignes: unknown): number | null {
  const p = z.array(ligneMontant).min(1).safeParse(lignes);
  if (!p.success) return null;
  return p.data.reduce((acc, l) => acc + Math.round(l.quantite * l.prixUnitaireHtCents), 0);
}
