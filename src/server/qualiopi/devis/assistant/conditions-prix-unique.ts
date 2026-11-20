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
import {
  CONDITIONS_PARTICULIERES_LIGNES_MAX,
  CONDITIONS_PARTICULIERES_MAX,
  nombreDeLignes,
} from "@/server/qualiopi/devis/conditions-particulieres";
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
  // Un versement non final à 0,00 € (ex. 1 % d'un total < 1 €) n'est pas un versement.
  if (phasesCents.slice(0, -1).some((c) => c <= 0))
    return erreur("Paiement : un versement ne peut pas être de 0,00 € (revoyez les pourcentages).");
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
  const texte = paragraphes.join("\n\n");
  if (
    texte.length > CONDITIONS_PARTICULIERES_MAX ||
    nombreDeLignes(texte) > CONDITIONS_PARTICULIERES_LIGNES_MAX
  ) {
    // Champ fautif : la saisie libre la plus longue (délais ou garantie).
    const tDelais = (nonVide(d["texte"]) ?? "").length + (fourchette ?? "").length;
    const tGarantie = (nonVide(p.nonImprime["phraseGarantie"]) ?? "").length;
    return {
      erreurs: [
        {
          champ: tGarantie > tDelais ? "nonImprime.phraseGarantie" : "nonImprime.delais",
          message:
            "Les textes de délais et de garantie sont trop longs pour le devis (4 000 caractères et 80 lignes au plus, échéancier compris).",
        },
      ],
    };
  }
  return { texte, phasesCents };
}

// ── Échéancier relu et recalculé sur un texte déjà écrit ─────────────────────────────

/** Une ligne du format exact produit plus haut : « 1. Acompte, à la signature : 30 %, soit 360,00 € TTC ». */
const LIGNE =
  /^(\d{1,2}\. .+ : )(\d{1,3}) %, soit (\d[\d\s\u00a0\u202f]*,\d{2}[\s\u00a0\u202f]€)( TTC)?$/;

interface LigneLue {
  prefixe: string;
  pct: number;
  montantCents: number;
}

/** Relit le premier paragraphe ; `null` si le texte n'est pas, ou plus, au format du module. */
function lireEcheancier(texte: string): { lignes: LigneLue[]; reste: string } | null {
  if (!texte.startsWith(`${TITRE_ECHEANCIER}\n`)) return null;
  const fin = texte.indexOf("\n\n");
  const premier = fin === -1 ? texte : texte.slice(0, fin);
  const reste = fin === -1 ? "" : texte.slice(fin);
  const brutes = premier.split("\n").slice(1);
  if (brutes.length === 0) return null;
  const lignes: LigneLue[] = [];
  for (let i = 0; i < brutes.length; i++) {
    const m = LIGNE.exec(brutes[i]!);
    if (!m || !m[1]!.startsWith(`${i + 1}. `)) return null;
    lignes.push({
      prefixe: m[1]!,
      pct: Number(m[2]),
      montantCents: Number(m[3]!.replace(/\D/g, "")),
    });
  }
  if (lignes.some((l) => l.pct < 1 || l.pct > 100)) return null;
  if (lignes.reduce((s, l) => s + l.pct, 0) !== 100) return null;
  return { lignes, reste };
}

export const MSG_ECHEANCIER_ILLISIBLE =
  "L'échéancier de paiement ne correspond plus au total : corrigez les montants des versements dans les conditions particulières.";

/**
 * Recalcule les montants du premier paragraphe (échéancier) sur le total TTC courant ; le reste du
 * texte est gardé tel quel. Erreur claire si le paragraphe a été retouché au point d'être illisible.
 */
export function recalculerEcheancier(
  texte: string,
  totalTtcCents: number,
  regime: RegimeTva,
): { texte: string } | { erreur: string } {
  const lu = lireEcheancier(texte);
  if (!lu) return { erreur: MSG_ECHEANCIER_ILLISIBLE };
  const paliers = echeancierPhases(
    totalTtcCents,
    lu.lignes.map((l, i) => ({
      rang: i + 1,
      libelle: "",
      pourcentage: l.pct,
      declencheur: "signature",
    })),
    [],
  );
  if (paliers.slice(0, -1).some((x) => x.montantHtCents <= 0))
    return { erreur: MSG_ECHEANCIER_ILLISIBLE };
  const suffixe = regime === "assujetti" ? " TTC" : "";
  const lignes = lu.lignes.map(
    (l, i) =>
      `${l.prefixe}${l.pct} %, soit ${formatEurosFromCents(paliers[i]!.montantHtCents)}${suffixe}`,
  );
  return { texte: `${TITRE_ECHEANCIER}\n${lignes.join("\n")}${lu.reste}` };
}

/** Vrai si la somme des versements imprimés égale le total (la base imprimée est celle du régime). */
export function controlerEcheancier(
  texte: string,
  totalTtcCents: number,
  _regime: RegimeTva,
): boolean {
  const lu = lireEcheancier(texte);
  return !!lu && lu.lignes.reduce((s, l) => s + l.montantCents, 0) === totalTtcCents;
}
