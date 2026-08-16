/**
 * Lot 14 (T3b) — LE ROUTAGE DES ALERTES À L'ÉCHELLE. Module PUR.
 *
 * ## Le défaut que ce module ferme
 *
 * Vérifié dans `notifications-service.ts` avant ce lot : **toute** alerte
 * partait à **une seule adresse**, choisie par
 * `QUALIOPI_ALERTE_EMAIL ?? WEEKLY_REPORT_EMAIL ?? "williamsjullin@gmail.com"`
 * — un e-mail par alerte, `jobId` par alerte.
 *
 * À un formateur et trois sessions, c'était une notification. À cent
 * formateurs, des centaines d'entreprises et 400 alertes ouvertes, c'est une
 * boîte de réception qu'on n'ouvre plus. **Une alerte que personne ne lit ne
 * garde rien** : elle constate, elle ne garde pas — exactement le reproche fait
 * aux deux alertes d'émargement, et la raison pour laquelle la stagiaire du
 * premier dossier réel n'a jamais pu signer.
 *
 * Le plan (Lot 14) demande trois choses. Ce module porte les deux qui se
 * décident sans base de données :
 *
 *   1. **un destinataire dérivé** — le guichet responsable de l'acte, jamais un
 *      canal global (`guichetPourCode`) ;
 *   2. **l'agrégation** — dix échéances du même type le même jour font un
 *      message, pas dix (`regrouperAlertes`).
 *
 * La troisième (désescalade) existait déjà : `synchroniserAlertes` résout les
 * codes à `resolutionAuto: true` dont la condition a disparu. Ce lot ne la
 * refait pas ; il la teste (`routage.spec.ts` § désescalade).
 *
 * ## Pourquoi le guichet vit dans le CATALOGUE et pas dans une table à part
 *
 * 🔴 Une table de routage séparée serait une seconde liste à tenir à jour. Le
 * jour où quelqu'un ajoute un code d'alerte sans l'y inscrire, l'alerte part
 * au guichet par défaut — c'est-à-dire nulle part en particulier, et on
 * retombe exactement dans le canal global qu'on vient de supprimer, en croyant
 * l'avoir supprimé.
 *
 * En faisant de `guichet` un champ **obligatoire** de `AlerteCatalogueEntry`,
 * c'est **TypeScript** qui refuse le code sans destinataire, à la compilation,
 * sur la machine de celui qui l'écrit. Aucune liste à tenir, aucun défaut par
 * défaut. (C'est la leçon de `HABILITATIONS` : une frontière recopiée à sept
 * endroits finit par diverger là où on a oublié de la durcir.)
 */

import type { RoleAdmin } from "@/server/auth/habilitations";
import { ALERTE_CATALOGUE } from "./catalogue";
import type { AlerteNiveau } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Les guichets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * À qui l'alerte s'adresse — par la NATURE DE L'ACTE qu'elle réclame, pas par
 * son niveau de gravité.
 *
 * ⚠️ Un guichet n'est pas un niveau hiérarchique. `critique` dit « il faut
 * sursauter » ; le guichet dit « qui a la main ». Les deux sont orthogonaux :
 * une alerte critique peut relever du secrétariat (une session en cours sans
 * dispositif de signature) et une alerte `info` de la direction (un devis
 * expiré sans suite).
 */
export type GuichetAlerte =
  /**
   * Le responsable qualité — conformité RNQ, sous-traitants, veille,
   * réclamations, accueil du handicap, BPF en préparation. Le rôle existe
   * depuis le Lot 10 (#609) ; c'est la condition posée par le plan §14.4.
   */
  | "qualite"
  /**
   * Le secrétariat — tout ce qui n'engage pas l'organisme : créer, convoquer,
   * relancer, émettre des liens, classer. C'est la colonne « n'engage rien »
   * de `habilitations.ts`, celle qui se délègue et s'automatise.
   */
  | "administratif"
  /**
   * La direction — ce qui ENGAGE : contresigner, conclure, facturer, encaisser,
   * la relation financeur, et la perte de certification. Même frontière que
   * `HABILITATIONS`, vue depuis les alertes.
   */
  | "direction"
  /**
   * Le formateur nommé par la cible de l'alerte — quand l'acte manquant est
   * le sien : son CV, ses supports, son évaluation des acquis.
   *
   * 🔴 Ce guichet ne résout PAS vers l'extérieur par défaut. Voir
   * `destinataires.ts` : écrire à cent formateurs sous-traitants au sujet d'un
   * manquement de conformité est une décision commerciale, pas un effet de
   * bord technique. Tant qu'elle n'est pas prise, l'alerte va au guichet
   * qualité **en nommant le formateur**, et la dégradation est DÉCLARÉE.
   */
  | "formateur";

/** Tous les guichets, pour les tests d'exhaustivité et les boucles d'envoi. */
export const GUICHETS: readonly GuichetAlerte[] = [
  "qualite",
  "administratif",
  "direction",
  "formateur",
] as const;

/** Intitulé humain — il apparaît en tête du message groupé. */
export const LIBELLE_GUICHET: Readonly<Record<GuichetAlerte, string>> = {
  qualite: "Responsable qualité",
  administratif: "Secrétariat",
  direction: "Direction",
  formateur: "Formateur concerné",
};

/**
 * Quels rôles admin desservent quel guichet.
 *
 * 🔴 Dérivé de `RoleAdmin` (SSOT du Lot 10) et non d'une liste de chaînes : si
 * un rôle disparaît ou est renommé, ceci ne compile plus. Une liste de chaînes
 * aurait continué à router vers un rôle qui n'existe plus — en silence.
 *
 * `super_admin` et `admin` figurent dans les trois guichets internes : ce sont
 * les comptes qui peuvent tout, et un guichet sans titulaire doit toujours
 * avoir quelqu'un derrière (cf. `destinataires.ts`, repli déclaré).
 */
export const ROLES_PAR_GUICHET: Readonly<Record<GuichetAlerte, ReadonlyArray<RoleAdmin>>> = {
  qualite: ["responsable_qualite", "admin", "super_admin"],
  administratif: ["secretaire", "admin", "super_admin"],
  direction: ["admin", "super_admin"],
  // Le guichet formateur n'a pas de rôle admin : son titulaire est une personne
  // désignée par la CIBLE de l'alerte, pas par un rôle. Le repli est explicite
  // dans `destinataires.ts` et non une liste vide qu'on interpréterait.
  formateur: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Le routage d'un code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le guichet d'un code d'alerte.
 *
 * Retourne `undefined` pour un code ABSENT du catalogue. 🔴 On ne renvoie
 * volontairement pas un guichet par défaut : un code hors catalogue est déjà un
 * défaut connu de ce domaine (des alertes émises sans entrée de catalogue
 * restaient ouvertes pour toujours, corrigé le 2026-08-05). Lui inventer un
 * destinataire masquerait le défaut au lieu de le montrer. L'appelant décide —
 * et `alertes-routage.spec.ts` vérifie que l'évaluateur n'en émet aucun.
 */
export function guichetPourCode(code: string): GuichetAlerte | undefined {
  return ALERTE_CATALOGUE[code]?.guichet;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'agrégation
// ─────────────────────────────────────────────────────────────────────────────

/** Ce qu'il faut savoir d'une alerte pour la router et la grouper. */
export interface AlerteARouter {
  readonly id: string;
  readonly code: string;
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  readonly cibleId?: string | null;
}

/** Un message à envoyer : un guichet, un code, N alertes. */
export interface LotAlertes {
  readonly guichet: GuichetAlerte;
  readonly code: string;
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  /** Les alertes couvertes par ce message. Toujours au moins une. */
  readonly alertes: ReadonlyArray<AlerteARouter>;
  /**
   * `true` si le message part tout de suite, `false` s'il attend le résumé
   * quotidien. Voir {@link estImmediat}.
   */
  readonly immediat: boolean;
}

/**
 * Un `critique` part seul et tout de suite ; le reste attend le résumé.
 *
 * 🔴 La ligne est là et pas ailleurs pour une raison écrite dans le catalogue :
 * « réserver `critique` aux manquements rend les alertes critiques crédibles —
 * c'est à celles-là qu'on doit sursauter ». Si `important` réveillait aussi, le
 * niveau ne voudrait plus rien dire, et on retomberait sur le canal unique,
 * juste avec plus d'adresses.
 */
export function estImmediat(niveau: AlerteNiveau): boolean {
  return niveau === "critique";
}

/**
 * Groupe les alertes en messages — **le cœur du lot**.
 *
 * Une clé de groupe = `(guichet, code)`. Dix `facture_impayee_j30` le même
 * matin font UN message qui liste dix factures, pas dix messages qui disent
 * chacun « une facture est impayée ».
 *
 * ⚠️ On ne groupe PAS par guichet seul. Un message qui mélangerait
 * « certification expirée » et « CV de formateur périmé » obligerait le lecteur
 * à trier lui-même, et le tri est précisément ce qu'on lui enlève. Un message,
 * une situation, N occurrences.
 *
 * 🔴 Les alertes dont le code est absent du catalogue ne sont PAS silencieuses.
 * Elles sortent dans `sansGuichet` : les taire reproduirait, à l'envoi, le
 * défaut qu'on a corrigé à la résolution — une alerte qui existe et que
 * personne ne voit.
 *
 * Déterministe : à entrée égale, sortie égale (tri par guichet, puis code).
 * Sans quoi deux exécutions produiraient deux ordres et aucun test ne tiendrait.
 */
export function regrouperAlertes(alertes: ReadonlyArray<AlerteARouter>): {
  lots: LotAlertes[];
  sansGuichet: AlerteARouter[];
} {
  const parCle = new Map<string, { guichet: GuichetAlerte; alertes: AlerteARouter[] }>();
  const sansGuichet: AlerteARouter[] = [];

  for (const a of alertes) {
    const guichet = guichetPourCode(a.code);
    if (guichet === undefined) {
      sansGuichet.push(a);
      continue;
    }
    const cle = `${guichet}::${a.code}`;
    const groupe = parCle.get(cle);
    if (groupe) groupe.alertes.push(a);
    else parCle.set(cle, { guichet, alertes: [a] });
  }

  const lots: LotAlertes[] = [];
  for (const [, groupe] of parCle) {
    const premiere = groupe.alertes[0]!;
    lots.push({
      guichet: groupe.guichet,
      code: premiere.code,
      // Le niveau du lot est le PLUS HAUT de ses membres. Prendre celui de la
      // première ferait dépendre l'urgence du message de l'ordre de lecture en
      // base — une alerte critique pourrait attendre le résumé du lendemain
      // parce qu'une alerte `info` du même code est arrivée avant elle.
      niveau: niveauMax(groupe.alertes),
      titre: premiere.titre,
      alertes: groupe.alertes,
      immediat: estImmediat(niveauMax(groupe.alertes)),
    });
  }

  lots.sort((x, y) => x.guichet.localeCompare(y.guichet) || x.code.localeCompare(y.code));
  return { lots, sansGuichet };
}

/** Ordre de gravité — `critique` gagne toujours. */
const ORDRE_NIVEAU: Readonly<Record<AlerteNiveau, number>> = {
  info: 0,
  important: 1,
  critique: 2,
};

function niveauMax(alertes: ReadonlyArray<AlerteARouter>): AlerteNiveau {
  return alertes.reduce<AlerteNiveau>(
    (pire, a) => ((ORDRE_NIVEAU[a.niveau] ?? 0) > (ORDRE_NIVEAU[pire] ?? 0) ? a.niveau : pire),
    "info",
  );
}

/**
 * Clé d'idempotence d'un lot, pour le `jobId` BullMQ.
 *
 * 🔴 Elle porte le JOUR, pas l'identifiant d'alerte : c'est ce qui fait qu'un
 * second passage du cron le même jour ne renvoie pas le même résumé. La clé
 * par alerte (`qualiopi-alerte-interne-{id}`) ne pouvait pas dédupliquer un
 * message qui en couvre dix.
 *
 * Elle porte AUSSI le nombre d'alertes : si une onzième facture tombe dans
 * l'après-midi, le résumé de dix n'est plus le bon message, et il doit pouvoir
 * repartir. Sans ce compteur, la déduplication quotidienne masquerait toute
 * aggravation jusqu'au lendemain.
 */
export function cleIdempotenceLot(lot: LotAlertes, jour: string): string {
  return `qualiopi-alertes-${lot.guichet}-${lot.code}-${jour}-${lot.alertes.length}`;
}
