/**
 * Qualiopi — Régime de TVA des factures (module PUR, testable sans infra).
 *
 * ⚠️ Qualiopi n'a AUCUN effet sur la TVA. Le régime dépend du statut fiscal de
 * l'OF, configurable (et évolutif dans le temps) via SiteSetting `regime_tva` :
 *
 *  - `assujetti`       : TVA au taux standard (20 %) — DÉFAUT légalement sûr.
 *                        S'applique tant qu'aucune exonération/franchise n'est
 *                        acquise, y compris sur les formations, y compris via
 *                        OPCO/CPF (le financeur ne change pas le régime TVA).
 *  - `exoneration_261` : exonération « formation professionnelle continue »
 *                        (art. 261-4-4° CGI) — NÉCESSITE l'attestation DREETS
 *                        (Cerfa 3511) + NDA + BPF à jour. Couvre UNIQUEMENT les
 *                        actions de FPC : les lignes de conseil/audit/site web
 *                        restent à 20 % (override `tauxTvaPercent` par ligne).
 *  - `franchise_293b`  : franchise en base (art. 293 B CGI), sous les seuils de
 *                        CA (37 500 € services en 2026) — tout à 0 %, mention
 *                        « TVA non applicable, art. 293 B du CGI ».
 *
 * Les factures déjà émises figent leur régime (instantané) ; seules les
 * nouvelles factures suivent le régime courant de la config.
 *
 * Montants en CENTIMES d'euro (pas de flottant).
 */

import { LEGAL_MENTIONS } from "./legal-mentions";

export type RegimeTva = "assujetti" | "exoneration_261" | "franchise_293b";

export const REGIMES_TVA: readonly RegimeTva[] = [
  "assujetti",
  "exoneration_261",
  "franchise_293b",
] as const;

/** Régime par défaut : assujetti (jamais omettre par erreur une TVA due). */
export const REGIME_TVA_DEFAUT: RegimeTva = "assujetti";

/** Taux standard de TVA en France métropolitaine (%). */
export const TAUX_TVA_STANDARD = 20;

/** Libellés humains (config admin / UI). */
export const REGIME_TVA_LABELS: Record<RegimeTva, string> = {
  assujetti: "Assujetti à la TVA (taux standard 20 %)",
  exoneration_261: "Exonération formation professionnelle (art. 261-4-4° CGI)",
  franchise_293b: "Franchise en base de TVA (art. 293 B CGI)",
};

/** `true` si la valeur est un régime TVA connu. */
export function isRegimeTva(value: unknown): value is RegimeTva {
  return typeof value === "string" && (REGIMES_TVA as readonly string[]).includes(value);
}

/**
 * Taux de TVA applicable à une ligne (%). Un `tauxTvaPercent` explicite sur la
 * ligne PRIME toujours (factures mixtes : formation 0 % + conseil 20 %). Sinon,
 * dérivé du régime : assujetti → taux standard, exonération/franchise → 0 %.
 */
export function tauxTvaLigne(
  regime: RegimeTva,
  ligne: { tauxTvaPercent?: number },
  tauxStandard: number = TAUX_TVA_STANDARD,
): number {
  // ⛔ AUCUN VERROU ICI, et c'est une correction de conception (ADR 0050 §3).
  //
  // Cette fonction sert DEUX moments qu'elle ne peut pas distinguer : le calcul
  // d'une pièce qu'on crée, et le RE-RENDU d'une pièce déjà émise. Y poser le
  // verrou réimprimait à 20 % une facture partie exonérée — c'est-à-dire
  // falsifier un document opposable au lieu d'empêcher un document futur.
  //
  // Le verrou vit donc au point de CRÉATION (`regimeTvaDepuisConfig` pour le
  // régime, `normaliserLignesPourActivite` pour le taux de ligne). Ici, on
  // reproduit fidèlement ce qu'on nous donne — c'est tout ce qu'un moteur de
  // rendu doit faire.
  if (typeof ligne.tauxTvaPercent === "number" && Number.isFinite(ligne.tauxTvaPercent)) {
    return Math.max(0, ligne.tauxTvaPercent);
  }
  switch (regime) {
    case "assujetti":
      return tauxStandard;
    case "exoneration_261":
    case "franchise_293b":
      return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LE VERROU — ordre permanent de Will, enfin appliqué par le code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le régime RÉELLEMENT appliqué. Toujours `assujetti`.
 *
 * ## L'ordre existait, le code ne le faisait pas
 *
 * Ordre permanent de Will : **« TVA toujours facturée, jamais d'exonération »**.
 * Or `exoneration_261` et `franchise_293b` étaient des chemins de première
 * classe : le régime est relu depuis la config à chaque émission (huit sites),
 * et il suffisait d'un `regime_tva` mal saisi pour émettre des factures à 0 %.
 * Le défaut était bien `assujetti` — donc rien de faux ne partait — mais **rien
 * ne l'empêchait**, et une facture émise fige son régime : la corriger après
 * coup suppose un avoir, pas une modification.
 *
 * ## Pourquoi le verrou est ICI, et pas aux huit lectures de config
 *
 * Verrouiller à la lecture demande de ne pas en oublier une, aujourd'hui **et à
 * chaque site ajouté demain**. Verrouiller à l'USAGE couvre tous les chemins
 * par construction : quelle que soit la façon dont un appelant obtient son
 * régime, il finit par passer par `tauxTvaLigne`, `computeTotauxFacture` ou
 * `mentionTva` — les trois seules portes qui transforment un régime en argent
 * ou en mention légale.
 *
 * ## ⚠️ Comment LEVER ce verrou, le jour venu
 *
 * L'exonération de l'art. 261-4-4° n'est pas une case à cocher : elle exige
 * l'attestation DREETS (Cerfa 3511), le NDA et un BPF à jour. Le jour où ces
 * pièces existent, on lève le verrou **par un ADR et cette fonction**, pas en
 * changeant un réglage. Les régimes restent définis et testés : ce qui est
 * verrouillé, c'est leur ATTEINTE, pas leur existence.
 */
export function regimeTvaApplique(regime: RegimeTva): RegimeTva {
  if (regime === "assujetti") return regime;
  // On ne lève pas : une facture en cours d'émission ne doit pas échouer sur un
  // réglage. On corrige, et on le DIT — un verrou muet laisserait croire que la
  // configuration a été prise en compte.
  console.error(
    `[tva] régime « ${regime} » IGNORÉ : ordre permanent « TVA toujours facturée, ` +
      "jamais d'exonération ». Le taux standard s'applique. Pour lever ce verrou : " +
      "attestation DREETS (Cerfa 3511) + ADR, puis `regimeTvaApplique`.",
  );
  return "assujetti";
}

/**
 * Le taux d'une ligne ne peut pas descendre sous le standard tant que le régime
 * appliqué est `assujetti`.
 *
 * 🔑 C'est la moitié DISCRÈTE du verrou, et la plus dangereuse. Le régime est
 * visible dans la config ; un `tauxTvaPercent: 0` posé sur une ligne ne l'est
 * pas — il court-circuitait tout, régime compris, sans qu'aucun écran ne le
 * dise. Une exonération de fait, ligne par ligne.
 *
 * ⚠️ Un taux SUPÉRIEUR reste accepté : le verrou existe pour ne jamais
 * sous-facturer la TVA, pas pour figer un taux. Une ligne à 5,5 % ou 10 %
 * (taux réduits) reste possible s'ils s'appliquent un jour, une ligne à 0 %
 * non.
 */
export function clampTauxLigneCreation(taux: number, tauxStandard: number): number {
  if (taux >= tauxStandard) return taux;
  console.error(
    `[tva] taux de ligne ${taux} % RELEVÉ à ${tauxStandard} % : sous le régime ` +
      "`assujetti`, un taux inférieur au standard est une exonération de fait — " +
      "ordre permanent « TVA toujours facturée ».",
  );
  return tauxStandard;
}

/**
 * Le régime à employer, lu depuis une valeur de configuration.
 *
 * 🔑 LA QUATRIÈME PORTE, et c'est un test existant qui l'a trouvée. Le verrou
 * posé sur les trois portes d'USAGE corrigeait les montants et la mention, mais
 * pas ce que la facture ENREGISTRE : `facturation-service` persistait le régime
 * brut de la config. Une facture serait née avec `regimeTva: "exoneration_261"`
 * ET 20 % de TVA — un enregistrement qui se contredit lui-même, exactement ce
 * qu'on refuse pour la mention imprimée.
 *
 * ⚠️ Les deux verrous sont COMPLÉMENTAIRES, aucun ne remplace l'autre :
 *  - celui-ci protège ce qui est LU et ENREGISTRÉ, aux sites qui l'emploient ;
 *  - celui des trois portes protège les chemins qui ne passeraient pas par ici,
 *    y compris ceux écrits demain par quelqu'un qui n'aura pas lu l'ADR 0050.
 */
export function regimeTvaDepuisConfig(valeur: unknown): RegimeTva {
  return isRegimeTva(valeur) ? regimeTvaApplique(valeur) : REGIME_TVA_DEFAUT;
}

export interface LigneFacturable {
  quantite: number;
  prixUnitaireHtCents: number;
  /** Override du taux TVA de la ligne (%). Sinon dérivé du régime. */
  tauxTvaPercent?: number;
}

/** Ventilation de la TVA par taux (une entrée par taux distinct présent). */
export interface VentilationTva {
  tauxPercent: number;
  baseHtCents: number;
  montantTvaCents: number;
}

export interface TotauxFacture {
  totalHtCents: number;
  ventilation: VentilationTva[];
  totalTvaCents: number;
  totalTtcCents: number;
}

/**
 * Calcule les totaux d'une facture : total HT, ventilation de la TVA par taux
 * (base + montant), total TVA et total TTC. La TVA est calculée par GROUPE de
 * taux (somme des bases puis application du taux) — méthode standard.
 */
export function computeTotauxFacture(
  lignes: readonly LigneFacturable[],
  regime: RegimeTva,
  tauxStandard: number = TAUX_TVA_STANDARD,
): TotauxFacture {
  const baseParTaux = new Map<number, number>();
  let totalHtCents = 0;

  for (const ligne of lignes) {
    const htLigne = Math.round(ligne.quantite * ligne.prixUnitaireHtCents);
    totalHtCents += htLigne;
    const taux = tauxTvaLigne(regime, ligne, tauxStandard);
    baseParTaux.set(taux, (baseParTaux.get(taux) ?? 0) + htLigne);
  }

  const ventilation: VentilationTva[] = [...baseParTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tauxPercent, baseHtCents]) => ({
      tauxPercent,
      baseHtCents,
      montantTvaCents: Math.round((baseHtCents * tauxPercent) / 100),
    }));

  const totalTvaCents = ventilation.reduce((sum, v) => sum + v.montantTvaCents, 0);

  return {
    totalHtCents,
    ventilation,
    totalTvaCents,
    totalTtcCents: totalHtCents + totalTvaCents,
  };
}

/**
 * Clé de la mention légale TVA à afficher selon le régime, ou `null` pour le
 * régime assujetti standard (aucune mention d'exonération/franchise).
 */
export function mentionTvaKey(
  regime: RegimeTva,
): "factureExonerationTva" | "factureFranchiseTva" | null {
  // ⛔ AUCUN VERROU ICI non plus : une facture émise sous exonération DOIT
  // continuer à porter sa mention quand on la re-rend. C'est le régime figé de
  // la pièce, et c'est ce qui la rend opposable. Le verrou empêche d'en créer
  // de nouvelles ; il ne réécrit pas celles qui existent.
  switch (regime) {
    case "exoneration_261":
      return "factureExonerationTva";
    case "franchise_293b":
      return "factureFranchiseTva";
    case "assujetti":
      return null;
  }
}

/** Mention légale TVA (texte) à afficher selon le régime, ou `null`. */
export function mentionTva(regime: RegimeTva): string | null {
  const key = mentionTvaKey(regime);
  return key ? LEGAL_MENTIONS[key] : null;
}
