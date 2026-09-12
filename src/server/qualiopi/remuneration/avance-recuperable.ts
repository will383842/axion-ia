/**
 * Qualiopi — Le FIXE RÉCUPÉRABLE d'un formateur salarié (module PUR).
 *
 * Aucune lecture Prisma, aucune horloge : un calcul d'argent se teste sur des
 * nombres, pas sur une base.
 *
 * ── CE QUE CE MODULE CALCULE, ET POURQUOI IL N'EXISTAIT PAS ──────────────────
 *
 * Un formateur salarié touche un FIXE mensuel. Les commissions des formations
 * qu'il assure ne s'y ajoutent pas d'emblée : elles viennent d'abord
 * **rembourser ce fixe**. Il ne perçoit un complément qu'au-delà.
 *
 * 🔑 ET LE RETARD SE REPORTE. C'est le point que Will a tranché le 2026-09-12,
 * et c'est celui qui change tout : un mois où les commissions passent SOUS le
 * fixe creuse une **dette**, que les mois forts remboursent. Sans report, chaque
 * mois repartirait de zéro et un mois creux serait définitivement acquis au
 * salarié ; avec report, le fixe est une véritable AVANCE.
 *
 * Le dépôt ne savait rien faire de tout cela. `CompensationModel` propose quatre
 * modèles — taux journalier, taux horaire, commission sur CA, forfait — et ils
 * sont EXCLUSIFS : une règle est l'un OU l'autre, jamais « fixe + commission ».
 * Le fixe d'un salarié vit dans sa paie, hors de l'outil ; les commissions
 * étaient calculées en coût analytique et s'arrêtaient là. Personne ne savait
 * combien verser en plus, ni ce qui restait à rattraper.
 *
 * ── ⛔ CE QUE CE MODULE NE FAIT PAS, ET NE DOIT PAS FAIRE ────────────────────
 *
 * Il ne produit **aucune dette fournisseur**. Un salarié n'est pas payé sur
 * facture : le résultat est un montant à reporter en PAIE, pas une somme à
 * virer. Le transformer en relevé facturable fausserait la déclaration BPF, qui
 * compte la sous-traitance en filtrant sur `nature: honoraire_du`.
 *
 * Il ne décide pas non plus du brut ou du net, ni des cotisations : ce sont des
 * calculs de paie, et les inventer ici donnerait un chiffre faux avec l'air
 * d'être juste.
 */

/** Un mois de commissions, face au fixe de ce mois. */
export interface MoisCommissionne {
  readonly year: number;
  readonly month: number;
  /** Fixe mensuel de CE mois, en centimes. Peut varier (embauche, avenant). */
  readonly fixeCents: number;
  /** Commissions gagnées sur le mois, en centimes. */
  readonly commissionsCents: number;
}

export interface ResultatMois extends MoisCommissionne {
  /**
   * Dette d'avance À L'ENTRÉE du mois — ce que les mois précédents ont laissé
   * à rattraper.
   */
  readonly detteEntranteCents: number;
  /** Part des commissions qui rembourse la dette antérieure. */
  readonly remboursementCents: number;
  /**
   * Complément RÉELLEMENT dû au titre du mois, en plus du fixe. Jamais négatif :
   * on ne reprend pas un fixe déjà versé.
   */
  readonly complementCents: number;
  /** Dette d'avance À LA SORTIE du mois — reportée sur le mois suivant. */
  readonly detteSortanteCents: number;
}

/**
 * Déroule les mois DANS L'ORDRE et calcule, pour chacun, le complément dû et la
 * dette reportée.
 *
 * ⚠️ L'ORDRE DES MOIS EST SIGNIFIANT, et c'est la raison d'être de cette
 * fonction. Chaque mois dépend de la dette laissée par le précédent : on ne peut
 * pas calculer un mois isolément, ni sommer les mois indépendamment. Passer une
 * liste désordonnée donnerait un résultat faux **sans lever** — d'où le tri
 * explicite ci-dessous plutôt qu'une confiance dans l'appelant.
 *
 * ⚠️ Le complément n'est JAMAIS négatif. Un mois où les commissions restent sous
 * le fixe ne « reprend » pas ce qui a été versé : le salarié garde son fixe, et
 * l'écart devient une dette. Rendre un nombre négatif ici aurait laissé un
 * appelant le soustraire d'une paie.
 *
 * @param mois          les mois à dérouler, dans n'importe quel ordre.
 * @param detteInitiale dette déjà constituée avant le premier mois de la liste
 *                      (reprise d'un exercice antérieur). 0 par défaut.
 */
export function deroulerAvanceRecuperable(
  mois: readonly MoisCommissionne[],
  detteInitiale = 0,
): ResultatMois[] {
  const ordonnes = [...mois].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  let dette = Math.max(0, Math.round(detteInitiale));
  const out: ResultatMois[] = [];

  for (const m of ordonnes) {
    const fixe = Math.max(0, Math.round(m.fixeCents));
    const commissions = Math.max(0, Math.round(m.commissionsCents));
    const detteEntranteCents = dette;

    // L'excédent du mois : ce que les commissions font AU-DELÀ du fixe.
    const excedent = commissions - fixe;

    let remboursementCents = 0;
    let complementCents = 0;

    if (excedent <= 0) {
      // Mois creux : le fixe est acquis, l'écart s'ajoute à la dette.
      dette = detteEntranteCents + -excedent;
    } else {
      // Mois fort : l'excédent rembourse d'abord la dette, le reste se verse.
      remboursementCents = Math.min(excedent, detteEntranteCents);
      dette = detteEntranteCents - remboursementCents;
      complementCents = excedent - remboursementCents;
    }

    out.push({
      ...m,
      fixeCents: fixe,
      commissionsCents: commissions,
      detteEntranteCents,
      remboursementCents,
      complementCents,
      detteSortanteCents: dette,
    });
  }

  return out;
}

export interface SyntheseAvance {
  /** Complément dû sur le DERNIER mois déroulé — ce qu'il faut porter en paie. */
  readonly complementDuMoisCents: number;
  /** Dette restant à rattraper après le dernier mois. */
  readonly detteCents: number;
  /** Cumul des compléments versés sur la période déroulée. */
  readonly complementsCumulesCents: number;
  /** Le dernier mois déroulé, ou `null` si la liste était vide. */
  readonly dernierMois: ResultatMois | null;
}

/**
 * Le chiffre qu'un gestionnaire de paie attend : combien verser EN PLUS ce
 * mois-ci, et combien reste-t-il à rattraper.
 *
 * 🔑 On rend les DEUX. Le complément seul se lit « il n'a rien de plus » et
 * cache qu'il est en train de rembourser une avance — un salarié à qui l'on dit
 * « zéro » trois mois d'affilée sans lui montrer la dette ne comprend pas sa
 * rémunération, et c'est le genre d'opacité qui finit en litige.
 */
export function synthetiser(resultats: readonly ResultatMois[]): SyntheseAvance {
  const dernierMois =
    resultats.length === 0 ? null : (resultats[resultats.length - 1] as ResultatMois);
  return {
    complementDuMoisCents: dernierMois?.complementCents ?? 0,
    detteCents: dernierMois?.detteSortanteCents ?? 0,
    complementsCumulesCents: resultats.reduce((t, r) => t + r.complementCents, 0),
    dernierMois,
  };
}
