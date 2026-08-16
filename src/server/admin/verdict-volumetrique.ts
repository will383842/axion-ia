/**
 * T0 / Lot 0 — Le comparateur qui décide si une mesure volumétrique est rouge.
 *
 * ## Pourquoi ce fichier existe, plutôt qu'une poignée de `if` dans le script
 *
 * La règle de décision vivait dans `scripts/volumetrie/mesurer.ts`, et
 * `scripts/**` n'est pas dans l'`include` de Vitest : la seule garde du dépôt
 * qui décide si une surface admin part en production **n'était vérifiée par
 * aucun test**. Un fichier de test posé à côté du script aurait été un fichier
 * mort — il n'échoue pas non plus.
 *
 * La règle est donc ici, pure et sans entrée/sortie, et le script l'importe.
 *
 * ## Le défaut corrigé le 2026-08-16 : le plancher de bruit
 *
 * La première version déclarait une régression dès `ms > baseline × 1,4`. Les
 * mesures réelles au volume cible (1 200 sessions) tombent entre **7 et 17 ms**
 * — post-T2, les requêtes ne sont plus le goulot. À ces ordres de grandeur,
 * 1,4 × 7 ms = 9,8 ms : le bruit d'ordonnancement d'un runner GitHub partagé
 * franchit ce seuil sans qu'aucune ligne de code n'ait changé.
 *
 * 🔑 **Une garde qui crie à tort cesse d'être lue.** Elle ne devient pas
 * inoffensive en vieillissant : elle devient un rouge qu'on apprend à ignorer,
 * et le jour où elle a raison, personne ne la croit. Un faux positif répété
 * coûte plus cher que l'absence de garde, parce qu'il consomme la confiance des
 * autres gardes avec lui.
 *
 * D'où le plancher : **en dessous de {@link PLANCHER_BRUIT_MS}, seul le budget
 * compte.** Une sonde qui passe de 7 ms à 45 ms ne fait pas rougir — et c'est
 * délibéré : 45 ms reste à un dixième du budget de la page (450 ms), donc rien
 * d'observable pour l'utilisateur. Ce que le plancher NE désarme jamais, c'est
 * le budget lui-même : le dépassement de budget est rouge à toute valeur.
 */

/**
 * En dessous de ce temps, l'écart relatif à la baseline n'est pas un signal.
 *
 * 🔴 Ne pas relever ce plancher au-dessus du plus petit budget déclaré dans
 * `sondes-volumetriques.ts` (450 ms aujourd'hui) : il rendrait le budget
 * inatteignable et la garde entièrement muette. Un test le vérifie.
 */
export const PLANCHER_BRUIT_MS = 50;

/** Marge au-dessus de la baseline avant de crier à la régression. */
export const TOLERANCE_REGRESSION = 1.4;

export type Verdict =
  /** Aucune mesure committée : la surface part à l'aveugle. */
  | { etat: "sans_baseline"; rouge: true }
  /** Plus lente que ce que la page peut s'offrir. Rouge à toute valeur. */
  | { etat: "hors_budget"; rouge: true; budgetMs: number }
  /** Nettement plus lente qu'avant, ET assez lente pour que ce soit un signal. */
  | { etat: "regression"; rouge: true; baselineMs: number }
  | { etat: "ok"; rouge: false };

export function verdictSonde(args: {
  /** Médiane mesurée, en millisecondes. */
  ms: number;
  /** Budget de la sonde (`Sonde.budgetMs`). */
  budgetMs: number;
  /** Médiane committée dans la baseline, ou `null` si jamais mesurée. */
  baselineMs: number | null;
}): Verdict {
  const { ms, budgetMs, baselineMs } = args;

  if (baselineMs == null) {
    return { etat: "sans_baseline", rouge: true };
  }
  // Le budget passe AVANT le plancher : le plancher n'a le droit d'assouplir
  // que la comparaison relative, jamais la limite absolue de la page.
  if (ms > budgetMs) {
    return { etat: "hors_budget", rouge: true, budgetMs };
  }
  if (ms > PLANCHER_BRUIT_MS && ms > baselineMs * TOLERANCE_REGRESSION) {
    return { etat: "regression", rouge: true, baselineMs };
  }
  return { etat: "ok", rouge: false };
}

/** Rendu court du verdict, pour le tableau du job CI. */
export function libelleVerdict(v: Verdict): string {
  switch (v.etat) {
    case "sans_baseline":
      return "❌ AUCUNE BASELINE";
    case "hors_budget":
      return `❌ HORS BUDGET (${v.budgetMs} ms)`;
    case "regression":
      return `❌ RÉGRESSION (baseline ${v.baselineMs} ms)`;
    case "ok":
      return "✓";
  }
}
