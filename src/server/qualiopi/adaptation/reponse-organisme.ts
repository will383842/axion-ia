/**
 * Indicateur 10 — le BESOIN D'ADAPTATION DÉCLARÉ et la RÉPONSE DE L'ORGANISME.
 *
 * ## Le défaut que ce module ferme (constaté sur la seule session réelle, 2026-09)
 *
 * Une bénéficiaire répond « oui » au besoin d'adaptation dans son positionnement.
 * L'alerte `besoin_adaptation_declare` se lève, puis elle est close à la main :
 * après échange, aucune adaptation n'était nécessaire. Sur sa fiche,
 * `situationHandicap` repasse à `false`. Sur l'inscription,
 * `adaptationsRealisees` reste VIDE.
 *
 * Résultat, trois lectures qui ne se parlaient pas :
 *   · la console affiche « Besoin d'adaptation déclaré : oui » (le questionnaire) ;
 *   · le moteur de l'indicateur 10 ne comptait un besoin déclaré QUE sur
 *     `Trainee.situationHandicap` — décocher la fiche faisait donc DISPARAÎTRE
 *     le besoin de son dénominateur, en silence ;
 *   · rien, nulle part, ne gardait la RÉPONSE de l'organisme — ni « adaptation
 *     prévue », ni « aucune adaptation nécessaire ». L'alerte close ne prouve rien :
 *     elle dit qu'on a cliqué, pas ce qu'on a répondu.
 *
 * ## Les deux notions, écrites UNE fois
 *
 * **Besoin déclaré** (par inscription) : la fiche stagiaire porte
 * `situationHandicap` (portail « mon compte », console), OU un positionnement
 * RÉPONDU de cette inscription porte `besoinAdaptation: true` — lu par
 * `lirePositionnement`, qui écarte la saisie par l'organisme (la question n'y
 * est pas posée).
 *
 * **Réponse consignée** : `Enrollment.adaptationsRealisees` non vide. C'est la
 * colonne existante, déjà imprimée sur la fiche d'adaptation. « Aucune adaptation
 * nécessaire après échange » est une réponse à part entière : elle s'y consigne
 * avec le libellé {@link REPONSE_AUCUNE_ADAPTATION}. Sa DATE est celle du journal
 * d'activité (`qualiopi.enrollment.adaptations`), écrite par l'unique action qui
 * modifie la colonne.
 *
 * 🔑 L'alerte console, l'écran de session, le dossier d'audit de la session et
 * le moteur de conformité lisent CE module. Quatre recopies du prédicat
 * finiraient par dire quatre choses différentes — c'est exactement ce qui s'est
 * produit.
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9). Ce module ne lit JAMAIS le détail déclaré, ni
 * en clair ni chiffré : il ne voit que des booléens et la réponse de l'organisme.
 *
 * ⚠️ Module PUR : aucun import Prisma, Next ni `server-only`. Il est atteint par
 * le worker (règle d'alerte) ET par un composant client (écran de session).
 */

import { lirePositionnement } from "../positionnement/lecture-positionnement";

/**
 * Le libellé exact de la réponse « aucune adaptation nécessaire ». Écrit par le
 * serveur, jamais tapé : le dossier d'audit et l'écran le reconnaissent.
 */
export const REPONSE_AUCUNE_ADAPTATION =
  "Échange avec le bénéficiaire : aucune adaptation nécessaire.";

/** Code de l'alerte BALAYÉE (worker) : besoin déclaré, réponse non consignée. */
export const CODE_ALERTE_REPONSE_NON_CONSIGNEE = "adaptation_reponse_non_consignee";

/** Code de l'alerte née du GESTE du bénéficiaire (portail). */
export const CODE_ALERTE_BESOIN_DECLARE = "besoin_adaptation_declare";

/**
 * Au-delà de ce délai après la FIN d'une session, l'alerte ne se lève plus.
 *
 * Une alerte doit garder, pas tenir l'inventaire des regrets (même borne arrière
 * que `suivi_froid_manquant`, raccourcie : une réponse d'adaptation se consigne
 * avant la session, et soixante jours laissent le temps de régulariser un dossier
 * récent — la date de consignation, elle, dira la vérité sur le retard). Le moteur
 * de conformité et le dossier d'audit ne sont PAS bornés : ils constatent.
 */
export const FENETRE_REPONSE_ADAPTATION_APRES_FIN_JOURS = 60;

export interface InscriptionPourBesoin {
  /** `Trainee.situationHandicap` — déclaré au portail « mon compte » ou en console. */
  readonly situationHandicap: boolean;
  /** `reponses` BRUTES des positionnements RÉPONDUS de cette inscription. */
  readonly reponsesPositionnements: readonly unknown[];
}

/** Cette inscription porte-t-elle un besoin d'adaptation déclaré ? */
export function besoinAdaptationDeclare(inscription: InscriptionPourBesoin): boolean {
  if (inscription.situationHandicap) return true;
  return inscription.reponsesPositionnements.some(
    (r) => lirePositionnement(r).besoinAdaptation === true,
  );
}

/** La réponse de l'organisme est-elle consignée ? Une chaîne blanche ne compte pas. */
export function reponseAdaptationConsignee(adaptationsRealisees: string | null): boolean {
  return adaptationsRealisees !== null && adaptationsRealisees.trim() !== "";
}

/** La réponse consignée est-elle « aucune adaptation nécessaire » ? */
export function estReponseAucuneAdaptation(adaptationsRealisees: string | null): boolean {
  return adaptationsRealisees?.trim() === REPONSE_AUCUNE_ADAPTATION;
}

export type EtatReponseAdaptation =
  /** Aucun besoin déclaré, rien de consigné : rien à faire. */
  | "sans_besoin"
  /** Besoin déclaré, AUCUNE réponse : c'est le cas que l'auditrice tire en premier. */
  | "a_consigner"
  /** Une réponse est consignée (adaptation prévue ou « aucune adaptation »). */
  | "consignee";

export function etatReponseAdaptation(
  besoinDeclare: boolean,
  adaptationsRealisees: string | null,
): EtatReponseAdaptation {
  if (reponseAdaptationConsignee(adaptationsRealisees)) return "consignee";
  return besoinDeclare ? "a_consigner" : "sans_besoin";
}

/**
 * Fragment de `where` Prisma sur `Enrollment` : le besoin déclaré, en base.
 *
 * ⚠️ Le filtre JSON est POSITIF (`equals: true`), jamais une exclusion : en SQL,
 * une réponse sans la clé rendrait NULL et sortirait du compte (cf.
 * `pieces-remplies.ts`). Il ne sait pas écarter une saisie par l'organisme qui
 * porterait le booléen — cas qu'aucun formulaire ne produit. Les lecteurs qui
 * chargent les lignes confirment avec {@link besoinAdaptationDeclare}.
 */
export function whereBesoinAdaptationDeclare(): {
  OR: [
    { trainee: { situationHandicap: true } },
    {
      questionnaires: {
        some: {
          type: "positionnement";
          reponduAt: { not: null };
          reponses: { path: string[]; equals: true };
        };
      };
    },
  ];
} {
  return {
    OR: [
      { trainee: { situationHandicap: true } },
      {
        questionnaires: {
          some: {
            type: "positionnement",
            reponduAt: { not: null },
            reponses: { path: ["besoinAdaptation"], equals: true },
          },
        },
      },
    ],
  };
}

/** Action du journal d'activité écrite par l'unique écrivain de la colonne. */
export const ACTION_JOURNAL_ADAPTATIONS = "qualiopi.enrollment.adaptations";

export interface EntreeJournalAdaptation {
  readonly createdAt: Date;
  /** `changes.adaptationsRenseignees` : la colonne était-elle remplie après ce geste ? */
  readonly renseignee: boolean;
}

/**
 * Depuis quand la réponse ACTUELLE est-elle consignée ?
 *
 * Le début de la période ininterrompue de consignation qui dure encore : une
 * réponse effacée puis réécrite date de sa réécriture, et une simple retouche du
 * texte ne rajeunit pas une réponse posée avant la session. `null` si le journal
 * ne dit rien de la réponse en cours (écrite avant que le journal n'existe, ou
 * journal en échec — `logQualiopiActivity` est best-effort).
 */
export function debutConsignationCourante(
  entrees: readonly EntreeJournalAdaptation[],
): Date | null {
  const triees = [...entrees].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let depuis: Date | null = null;
  for (const e of triees) {
    if (!e.renseignee) depuis = null;
    else if (depuis === null) depuis = e.createdAt;
  }
  return depuis;
}

/** Situe la consignation par rapport au début de la session (même borne que le positionnement). */
export function consigneeAvantDebut(consigneeLe: Date, debutSession: Date): boolean {
  return consigneeLe.getTime() <= debutSession.getTime();
}
