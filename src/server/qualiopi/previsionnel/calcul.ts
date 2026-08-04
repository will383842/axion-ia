// Prévisionnel financier — logique PURE (aucune I/O, aucun accès Prisma), donc
// entièrement testable sans DB.
//
// Question métier : « combien vais-je encaisser, et QUAND ? ». On projette, mois
// par mois, cinq indicateurs qui répondent chacun à une sous-question :
//
//   - CA planifié            : chiffre d'affaires à venir (sessions vendues mais
//                              pas encore réalisées) → visibilité commerciale.
//   - CA réalisé             : chiffre d'affaires acquis (prestation faite) → base
//                              de la facturation à émettre.
//   - Encaissements attendus : trésorerie que je devrais recevoir (factures déjà
//                              émises, non payées), rangée au mois de leur ÉCHÉANCE
//                              → prévision de cash.
//   - Reste à facturer       : travail fait mais pas encore facturé → action à
//                              mener (émettre la facture) pour déclencher le cash.
//   - Impayés                : factures émises dont l'échéance est passée → relance.
//
// IMPORTANT (arrondis) : tous les montants restent en CENTIMES jusqu'à
// l'affichage. On additionne des entiers, on ne divise JAMAIS par 100 ici.
//
// Choix de fuseau : le mois d'un événement est calculé en Europe/Paris (comme le
// reste du planning, cf. `dayKeyInParis`) — une session du 1er à 00h30 heure de
// Paris appartient bien au mois parisien, pas au mois UTC de la veille.

import { dayKeyInParis } from "@/lib/calendar-grid";
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

/** Statuts miroir de `TrainingSessionStatut` (on ne dépend pas des types Prisma). */
export type SessionStatutPrev = "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

/**
 * Statuts miroir de `FactureFormationStatut`.
 *
 * 🔴 Le type ne listait que `brouillon | emise | payee | annulee`. Les deux
 * statuts manquants — `partiellement_payee` et `en_retard` — sont précisément
 * ceux d'une créance en cours de recouvrement. Le cast de `queries.ts` les
 * faisait entrer quand même à l'exécution, où ils tombaient dans le `continue`
 * du filtre : les colonnes « Encaissements attendus » et « Impayés » affichaient
 * donc ≈ 0 en permanence, le cron de 06:30 basculant en `en_retard` toute
 * facture échue. Un prévisionnel de trésorerie aveugle aux impayés.
 */
export type FactureStatutPrev =
  "brouillon" | "emise" | "partiellement_payee" | "en_retard" | "payee" | "annulee";

/**
 * Vue minimale d'une session nécessaire au prévisionnel. Type MIROIR volontaire :
 * la logique pure ignore d'où viennent les données (Prisma, mock de test…).
 */
export interface SessionPrevisionnel {
  /** Id session — sert à savoir si une session réalisée est déjà facturée. */
  id: string;
  /** Date de début : détermine le mois de rattachement du CA. */
  dateDebut: Date;
  statut: SessionStatutPrev;
  /** Montant HT en CENTIMES (jamais divisé avant agrégation). */
  montantHtCents: number;
}

/** Vue minimale d'une facture nécessaire au prévisionnel (type miroir). */
export interface FacturePrevisionnel {
  /** Session rattachée (null pour une facture 1-to-1 sans session collective). */
  sessionId: string | null;
  statut: FactureStatutPrev;
  /** Montant HT en CENTIMES. */
  montantHtCents: number;
  /**
   * Date d'échéance de paiement. C'est ELLE (et non `emiseAt`) qui range la
   * facture dans un mois : le prévisionnel de TRÉSORERIE répond à « quand vais-je
   * être payé ? », pas « quand ai-je facturé ? ». Null = échéance inconnue.
   */
  echeanceAt: Date | null;
}

/**
 * Une ligne de prévisionnel = un mois « YYYY-MM » et ses cinq montants (centimes).
 * Type miroir stable, consommé tel quel par la page RSC.
 */
export interface LignePrevisionnel {
  /** Mois de rattachement, format « YYYY-MM » (Europe/Paris). */
  mois: string;
  /** Sessions planifiées + en cours du mois (CA à venir). */
  caPlanifieCents: number;
  /** Sessions réalisées du mois (CA acquis). */
  caRealiseCents: number;
  /** Factures émises non payées dont l'échéance tombe ce mois (cash attendu). */
  encaissementsAttendusCents: number;
  /** Sessions réalisées du mois SANS facture émise/payée (à facturer). */
  resteAFacturerCents: number;
  /** Sous-ensemble des encaissements attendus dont l'échéance est déjà passée. */
  impayesCents: number;
}

/** Agrégat global (mêmes colonnes qu'une ligne, sans le mois). */
export type TotauxPrevisionnel = Omit<LignePrevisionnel, "mois">;

/** Clé mois « YYYY-MM » (Europe/Paris) d'une date. Pure (Intl, sans I/O). */
export function moisDe(date: Date): string {
  // `dayKeyInParis` renvoie « YYYY-MM-DD » ; les 7 premiers caractères = le mois.
  return dayKeyInParis(date).slice(0, 7);
}

/** Ligne à zéro pour un mois donné (utile aux mois vides de la fenêtre affichée). */
export function ligneVide(mois: string): LignePrevisionnel {
  return {
    mois,
    caPlanifieCents: 0,
    caRealiseCents: 0,
    encaissementsAttendusCents: 0,
    resteAFacturerCents: 0,
    impayesCents: 0,
  };
}

/**
 * Agrège sessions + factures en une ligne par mois, triée chronologiquement.
 *
 * Règles métier (chacune testée dans `calcul.spec.ts`) :
 *
 *  - **CA planifié** : sessions `planifiee` ou `en_cours`, rattachées au mois de
 *    `dateDebut`. Les `annulee`/`reportee` comptent 0 (elles ne génèreront pas de
 *    CA en l'état — une reportée reviendra sous une nouvelle date/session).
 *  - **CA réalisé** : sessions `realisee`, mois de `dateDebut`.
 *  - **Encaissements attendus** : factures OUVERTES au sens du SSOT
 *    `STATUTS_FACTURE_OUVERTE` — `emise`, `partiellement_payee` ET `en_retard`,
 *    c'est-à-dire toute facture émise non soldée —, rangées au mois de
 *    `echeanceAt`. `en_retard` n'est PAS une catégorie à part : c'est le même
 *    argent dû, avec une étiquette d'ancienneté posée par le cron quotidien.
 *    L'omettre vidait la colonne au lendemain de chaque échéance. Une facture
 *    émise SANS `echeanceAt` n'est rattachable à aucun mois → ignorée ici (et
 *    donc aussi hors impayés) ; le cron de retard reconstitue ces échéances.
 *    ⚠️ Le montant retenu reste le HT FACTURÉ, pas le reste dû : sur une facture
 *    `partiellement_payee`, l'acompte encaissé est donc encore compté en
 *    attendu. C'est une approximation connue (le prévisionnel ne lit pas les
 *    `Payment`), conservée telle quelle — la corriger suppose de faire entrer
 *    les encaissements dans ce module, ce qui est un chantier distinct.
 *  - **Reste à facturer** : sessions `realisee` du mois n'ayant AUCUNE facture
 *    ouverte ni `payee`. Une facture `brouillon`/`annulee` ne « facture » pas :
 *    la session reste à facturer. Rattaché au mois de la session. Une facture
 *    `en_retard`/`partiellement_payee` compte, elle, comme FACTURÉE : sans quoi
 *    la même session serait comptée deux fois — en reste à facturer ET en
 *    impayé — alors qu'elle est facturée et simplement non réglée.
 *  - **Impayés** : sous-ensemble des factures ouvertes dont `echeanceAt` est
 *    strictement antérieure à `now`. Même mois de rattachement que l'encaissement
 *    attendu correspondant (l'impayé est donc COMPTÉ AUSSI dans les encaissements
 *    attendus — c'est une colonne d'alerte, pas une catégorie disjointe).
 *
 * @param now Référence temporelle pour juger de l'antériorité d'une échéance
 *   (injectée pour rester pure et déterministe en test).
 */
export function agregerParMois(
  sessions: SessionPrevisionnel[],
  factures: FacturePrevisionnel[],
  now: Date,
): LignePrevisionnel[] {
  const parMois = new Map<string, LignePrevisionnel>();
  const ligne = (mois: string): LignePrevisionnel => {
    let l = parMois.get(mois);
    if (l === undefined) {
      l = ligneVide(mois);
      parMois.set(mois, l);
    }
    return l;
  };

  // Ensemble des sessions considérées comme « déjà facturées » : au moins une
  // facture OUVERTE (émise, partiellement payée, en retard) ou PAYÉE. Sert au
  // calcul du reste à facturer. Les factures brouillon/annulée n'entrent pas ici
  // (elles ne facturent rien réellement).
  //
  // 🔴 `partiellement_payee` et `en_retard` manquaient : une session facturée et
  // impayée retombait en « reste à facturer » — soit un DOUBLE COMPTAGE (la même
  // session pesait à la fois en travail à facturer et en impayé), et une
  // invitation à réémettre une facture qui existe déjà.
  const sessionsFacturees = new Set<string>();
  for (const f of factures) {
    if (f.sessionId !== null && (estFactureOuverte(f.statut) || f.statut === "payee")) {
      sessionsFacturees.add(f.sessionId);
    }
  }

  for (const s of sessions) {
    const mois = moisDe(s.dateDebut);
    if (s.statut === "planifiee" || s.statut === "en_cours") {
      ligne(mois).caPlanifieCents += s.montantHtCents;
    } else if (s.statut === "realisee") {
      const l = ligne(mois);
      l.caRealiseCents += s.montantHtCents;
      // Réalisée mais pas encore facturée (aucune facture émise/payée) → à facturer.
      if (!sessionsFacturees.has(s.id)) {
        l.resteAFacturerCents += s.montantHtCents;
      }
    }
    // annulee / reportee : aucun montant compté.
  }

  for (const f of factures) {
    // « Émise et non soldée » = les trois statuts OUVERTS (SSOT). brouillon,
    // payee et annulee sont exclus des encaissements attendus (payee = déjà
    // encaissé ; brouillon/annulee = rien n'est dû).
    if (!estFactureOuverte(f.statut)) continue;
    // Sans échéance, impossible de placer la facture sur la frise → ni attendu ni
    // impayé (on ne peut juger de son antériorité). Choix documenté.
    if (f.echeanceAt === null) continue;

    const l = ligne(moisDe(f.echeanceAt));
    l.encaissementsAttendusCents += f.montantHtCents;
    // Échéance strictement passée → impayé (colonne d'alerte, sous-ensemble).
    if (f.echeanceAt.getTime() < now.getTime()) {
      l.impayesCents += f.montantHtCents;
    }
  }

  // Tri chronologique : les clés « YYYY-MM » se comparent lexicographiquement.
  return [...parMois.values()].sort((a, b) => a.mois.localeCompare(b.mois));
}

/** Somme colonne par colonne d'un ensemble de lignes (agrégat global affiché). */
export function totaux(lignes: LignePrevisionnel[]): TotauxPrevisionnel {
  const t: TotauxPrevisionnel = {
    caPlanifieCents: 0,
    caRealiseCents: 0,
    encaissementsAttendusCents: 0,
    resteAFacturerCents: 0,
    impayesCents: 0,
  };
  for (const l of lignes) {
    t.caPlanifieCents += l.caPlanifieCents;
    t.caRealiseCents += l.caRealiseCents;
    t.encaissementsAttendusCents += l.encaissementsAttendusCents;
    t.resteAFacturerCents += l.resteAFacturerCents;
    t.impayesCents += l.impayesCents;
  }
  return t;
}
