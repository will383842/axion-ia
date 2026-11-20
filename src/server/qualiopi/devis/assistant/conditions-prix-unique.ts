/**
 * Conditions particulières d'un devis en PRIX UNIQUE (devis classique) — module PUR.
 *
 * Le gabarit v6 n'imprime ni échéancier ni délais ni garantie ni plafond pour un devis
 * classique, hormis le texte libre de la colonne `Devis.conditionsParticulieres`. Ce module
 * produit ce texte à partir de ce que l'écran a saisi, et c'est la SEULE source des montants
 * par phase en prix unique (aperçu, étape « Paiement » et PDF passent par ici).
 *
 * Montants : `echeancierPhases` (arrondi inférieur, dernier versement = reste) appliqué au
 * total TTC, donc la somme des versements égale exactement le total du devis.
 */
import { formatEurosFromCents } from "@/server/qualiopi/documents/base-layout";
import { echeancierPhases } from "@/server/qualiopi/devis/offre-calculs";
import { DECLENCHEURS } from "@/server/qualiopi/devis/vue-formules";
import type { RegimeTva, TotauxFacture } from "@/server/qualiopi/legal/tva";
import type { PayloadAssistantV1 } from "./payload";
import { TEXTE_DELAIS, TEXTE_GARANTIE, TEXTE_PLAFOND_RESPONSABILITE } from "./textes-rubriques";
import type { ErreurChamp } from "./validation-etapes";

/** Titre du premier paragraphe : sert aussi à reconnaître un texte produit par l'assistant. */
export const TITRE_ECHEANCIER = "Échéancier de paiement";

export type ResultatConditionsPrixUnique =
  { texte: string; phasesCents: number[] } | { erreurs: ErreurChamp[] };

const CHAMP = "formules.achat.phases";
const nonVide = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const minuscule1 = (s: string) => (s === "" ? s : s.charAt(0).toLocaleLowerCase("fr") + s.slice(1));

export function texteConditionsPrixUnique(
  p: PayloadAssistantV1,
  totaux: Pick<TotauxFacture, "totalTtcCents" | "totalHtCents">,
  regime: RegimeTva,
): ResultatConditionsPrixUnique {
  const phases = p.formules.achat.phases;
  const erreur = (message: string): ResultatConditionsPrixUnique => ({
    erreurs: [{ champ: CHAMP, message }],
  });
  if (phases.length === 0) return erreur("Paiement : au moins un versement.");
  const pct: number[] = [];
  for (const ph of phases) {
    const t = ph.pourcentage.trim();
    // Entiers de 1 à 100 : le modèle d'offre refuse 0 % (un acompte nul n'est pas une phase).
    if (!/^\d{1,3}$/.test(t) || Number(t) < 1 || Number(t) > 100)
      return erreur("Paiement : chaque pourcentage est un entier de 1 à 100.");
    pct.push(Number(t));
  }
  if (pct.reduce((s, x) => s + x, 0) !== 100)
    return erreur("Paiement : la somme des pourcentages doit valoir 100.");

  const assujetti = regime === "assujetti";
  const base = assujetti ? totaux.totalTtcCents : totaux.totalHtCents;
  const paliers = echeancierPhases(
    base,
    phases.map((ph, i) => ({
      rang: i + 1,
      libelle: ph.libelle,
      pourcentage: pct[i]!,
      declencheur: ph.declencheur,
    })),
    [],
  );
  const phasesCents = paliers.map((x) => x.montantHtCents);
  const suffixe = assujetti ? " TTC" : "";

  const lignes = phases.map((ph, i) => {
    const libelle = nonVide(ph.libelle) ?? "Versement";
    const quand = minuscule1(DECLENCHEURS[ph.declencheur] ?? ph.declencheur);
    return `${i + 1}. ${libelle}, ${quand} : ${pct[i]} %, soit ${formatEurosFromCents(phasesCents[i]!)}${suffixe}`;
  });
  const paragraphes = [`${TITRE_ECHEANCIER}\n${lignes.join("\n")}`];

  const d =
    p.nonImprime["delais"] && typeof p.nonImprime["delais"] === "object"
      ? (p.nonImprime["delais"] as Record<string, unknown>)
      : {};
  const fourchette = nonVide(d["fourchette"]);
  paragraphes.push(
    `Délais :\n${nonVide(d["texte"]) ?? TEXTE_DELAIS}${fourchette ? ` Délai estimé : ${fourchette}.` : ""}`,
  );

  const jours = Number(p.formules.garantieJours.trim());
  if (p.formules.garantieJours.trim() !== "" && Number.isInteger(jours) && jours > 0)
    paragraphes.push(
      `Garantie de ${jours} jours.\n${nonVide(p.nonImprime["phraseGarantie"]) ?? TEXTE_GARANTIE}`,
    );

  paragraphes.push(TEXTE_PLAFOND_RESPONSABILITE);
  return { texte: paragraphes.join("\n\n"), phasesCents };
}
