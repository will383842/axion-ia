/**
 * Content Generator — règles de détection d'anomalie (module PUR).
 *
 * Extrait de `content-monitoring-worker.ts` le 2026-09-01, après que **les deux
 * veilles de ce fichier se soient tues pendant quatre jours** d'arrêt total de
 * la production (28/08 → 01/09 : 54 jobs, 100 % d'échecs, zéro article publié,
 * zéro alerte). Les deux pannes étaient de nature différente, et aucune n'était
 * détectable en lisant le code sans connaître la cadence réelle :
 *
 *  - le **taux de rejet** exigeait plus de 5 jobs terminés en UNE HEURE. Depuis
 *    que le plafond global est à 15 contenus/jour (16/08), cela fait ~0,6 job
 *    par heure : le seuil était devenu **mathématiquement inatteignable** ;
 *  - la **chaîne à l'arrêt** comptait les jobs *lancés*, pas les contenus
 *    *produits*. L'orchestrateur lançait ses 15 échecs quotidiens, donc la
 *    veille voyait de l'activité et concluait au bon fonctionnement.
 *
 * 🔑 Deux leçons, écrites ici parce que c'est ici qu'on les relira :
 *   1. **baisser une cadence peut tuer une garde exprimée en volume horaire** —
 *      tout seuil qui dépend d'un débit doit être relu quand le débit change ;
 *   2. **une veille qui mesure le producteur ne voit jamais mourir le produit.**
 *
 * Aucun I/O ici : les compteurs sont fournis par l'appelant, les décisions se
 * testent sans mock.
 */

/** Seuils du taux de rejet. Exportés pour que les tests parlent des vraies valeurs. */
export const REJECT_RULES = {
  /** Règle A — pic court. Seuil d'origine, conservé tel quel. */
  shortWindowMinCompleted: 5,
  /** Règle B — taux soutenu sur 24 h, pour les cadences basses. */
  dayWindowMinCompleted: 5,
  /** Part d'échecs au-delà de laquelle on alerte, commune aux deux règles. */
  failureRatio: 0.5,
} as const;

/** Seuils de la chaîne à vide. */
export const STALL_RULES = {
  /**
   * Nombre minimal de jobs lancés sur 24 h avant de pouvoir conclure que la
   * chaîne tourne à vide. Évite d'alarmer un système simplement au repos ou
   * fraîchement démarré : on n'alerte que si l'on a demandé du travail et que
   * rien n'en est sorti.
   */
  dayWindowMinCreated: 5,
} as const;

export interface RejectCounters {
  /** Jobs terminés sur la dernière heure. */
  readonly totalRecent: number;
  /** Dont en échec. */
  readonly failedRecent: number;
  /** Jobs terminés sur les dernières 24 h. */
  readonly totalDay: number;
  /** Dont en échec. */
  readonly failedDay: number;
}

export interface RejectVerdict {
  readonly failed: number;
  readonly total: number;
  /** Libellé de la fenêtre qui a déclenché, pour le message d'alerte. */
  readonly fenetre: "1 h" | "24 h";
  /** Pourcentage d'échecs, arrondi. */
  readonly pct: number;
}

/**
 * Le taux de rejet justifie-t-il une alerte ?
 *
 * La règle A (pic sur 1 h) est évaluée EN PREMIER et reste identique à
 * l'originale : sur une cadence haute, un pic court doit rester le signal, plus
 * précis que la moyenne du jour. La règle B ne fait qu'ajouter la couverture
 * des cadences basses, là où A ne peut structurellement rien voir.
 *
 * @returns `null` si rien à signaler.
 */
export function evaluateRejectRate(c: RejectCounters): RejectVerdict | null {
  const picCourt =
    c.totalRecent > REJECT_RULES.shortWindowMinCompleted &&
    c.failedRecent / c.totalRecent > REJECT_RULES.failureRatio;
  if (picCourt) {
    return {
      failed: c.failedRecent,
      total: c.totalRecent,
      fenetre: "1 h",
      pct: Math.round((c.failedRecent / c.totalRecent) * 100),
    };
  }

  const tauxSoutenu =
    c.totalDay >= REJECT_RULES.dayWindowMinCompleted &&
    c.failedDay / c.totalDay > REJECT_RULES.failureRatio;
  if (tauxSoutenu) {
    return {
      failed: c.failedDay,
      total: c.totalDay,
      fenetre: "24 h",
      pct: Math.round((c.failedDay / c.totalDay) * 100),
    };
  }

  return null;
}

export interface StallCounters {
  /** Campagnes en cours. Aucune campagne = rien à surveiller. */
  readonly runningCampaigns: number;
  /** Jobs créés sur les 4 dernières heures. */
  readonly recentJobs: number;
  /** Jobs créés sur les dernières 24 h. */
  readonly createdDay: number;
  /**
   * Jobs ayant réellement PRODUIT un contenu sur 24 h, c'est-à-dire arrivés
   * dans un état où le contenu existe (`published`, `approved`, `needs_review`).
   * `failed` n'en fait pas partie — et `quality_improving` non plus : y rester
   * 24 h est aussi une panne.
   */
  readonly productiveDay: number;
  /**
   * Nombre de lancements que le plafond quotidien AUTORISAIT sur la fenêtre
   * (0 = le budget du jour était consommé, l'orchestrateur n'avait rien à
   * lancer).
   *
   * 🔴 2026-09-02 — sans ce compteur, la règle « rien lancé depuis 4 h »
   * hurlait tous les matins : la rafale RSS de minuit consomme 5 des 15
   * contenus du jour, le lissage horaire n'en rouvre pas avant 08:00, et à
   * 04:00 la console affichait « Chaîne de production à l'arrêt » sur une
   * chaîne parfaitement saine qui attendait son budget. Un orchestrateur qui
   * n'a pas le droit de lancer n'est pas un orchestrateur mort.
   */
  readonly budgetRoom: number;
}

export type StallReason =
  /** Plus rien n'est lancé : l'orchestrateur est mort. */
  | "rien_lance"
  /** On lance, mais rien n'en sort : la chaîne tourne à vide. */
  | "tourne_a_vide";

/**
 * La chaîne de production est-elle en panne ?
 *
 * @returns `null` si tout va bien.
 */
export function evaluatePipelineStall(c: StallCounters): StallReason | null {
  if (c.runningCampaigns <= 0) return null;
  if (c.recentJobs === 0) return c.budgetRoom > 0 ? "rien_lance" : null;
  if (c.createdDay >= STALL_RULES.dayWindowMinCreated && c.productiveDay === 0) {
    return "tourne_a_vide";
  }
  return null;
}
