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

import { formaterInstantParis, lirePositionnement } from "../positionnement/lecture-positionnement";

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
  /**
   * Besoin déclaré, AUCUNE réponse qui le couvre : c'est le cas que l'auditrice
   * tire en premier. Couvre aussi la réponse ANTÉRIEURE à une nouvelle
   * déclaration (cf. {@link reponseAnterieureALaDerniereDeclaration}).
   */
  | "a_consigner"
  /** Une réponse est consignée (adaptation prévue ou « aucune adaptation »). */
  | "consignee";

/**
 * Les DATES du circuit d'une inscription, lues au journal et au positionnement
 * (`journal-consignation.ts`). Aucune ne porte de contenu : ce sont des instants.
 */
export interface HorodatageCircuitAdaptation {
  /** Début de la période de consignation qui dure encore (première écriture). */
  readonly consigneeDepuis: Date | null;
  /** Dernière écriture de la réponse actuelle — celle dont le texte est affiché. */
  readonly derniereConsignationLe: Date | null;
  /** Dernière déclaration d'un besoin qui concerne cette inscription. */
  readonly derniereDeclarationLe: Date | null;
}

export const HORODATAGE_CIRCUIT_VIDE: HorodatageCircuitAdaptation = {
  consigneeDepuis: null,
  derniereConsignationLe: null,
  derniereDeclarationLe: null,
};

/** Forme sérialisée (ISO) des dates du circuit, pour un composant client. */
export interface HorodatageCircuitSerialise {
  readonly consigneeDepuis: string | null;
  readonly derniereConsignationLe: string | null;
  readonly derniereDeclarationLe: string | null;
}

export function serialiserHorodatage(h: HorodatageCircuitAdaptation): HorodatageCircuitSerialise {
  return {
    consigneeDepuis: h.consigneeDepuis?.toISOString() ?? null,
    derniereConsignationLe: h.derniereConsignationLe?.toISOString() ?? null,
    derniereDeclarationLe: h.derniereDeclarationLe?.toISOString() ?? null,
  };
}

export function lireHorodatageSerialise(
  s: HorodatageCircuitSerialise | undefined,
): HorodatageCircuitAdaptation {
  if (s === undefined) return HORODATAGE_CIRCUIT_VIDE;
  const date = (v: string | null): Date | null => (v === null ? null : new Date(v));
  return {
    consigneeDepuis: date(s.consigneeDepuis),
    derniereConsignationLe: date(s.derniereConsignationLe),
    derniereDeclarationLe: date(s.derniereDeclarationLe),
  };
}

/**
 * 🔴 2026-09-15 (relecture #1095) — une NOUVELLE déclaration rouvre le circuit.
 *
 * Scénario constaté à la relecture : « oui » au positionnement, l'organisme
 * consigne « aucune adaptation nécessaire », puis la même personne déclare un
 * VRAI besoin depuis « mon compte » (ou la fiche est cochée en console). La
 * colonne restait non vide, donc « consignée » : l'indicateur 10 restait vert,
 * la règle balayée se taisait, et l'alerte du geste était écartée par le
 * dédoublonnage. Le vrai besoin n'avait reçu aucune réponse, et rien ne le
 * disait.
 *
 * Une réponse ne couvre que les déclarations qui la PRÉCÈDENT. Elle n'est pas
 * effacée pour autant : le texte reste dans la colonne et dans le journal — la
 * trace de ce qui a été répondu, et quand, est une preuve en soi.
 *
 * ⚠️ Une réponse NON DATÉE face à une déclaration datée ne prouve pas y
 * répondre : elle est rouverte (échec fermé). Le journal de consignation existe
 * depuis que la colonne a un écrivain, donc ce cas ne vise en pratique qu'un
 * journal en échec — et reconsigner suffit à le refermer.
 */
export function reponseAnterieureALaDerniereDeclaration(
  adaptationsRealisees: string | null,
  horodatage: HorodatageCircuitAdaptation,
): boolean {
  if (!reponseAdaptationConsignee(adaptationsRealisees)) return false;
  const declaration = horodatage.derniereDeclarationLe;
  if (declaration === null) return false;
  const consignation = horodatage.derniereConsignationLe;
  if (consignation === null) return true;
  return declaration.getTime() > consignation.getTime();
}

export function etatReponseAdaptation(
  besoinDeclare: boolean,
  adaptationsRealisees: string | null,
  horodatage: HorodatageCircuitAdaptation,
): EtatReponseAdaptation {
  if (reponseAdaptationConsignee(adaptationsRealisees)) {
    return besoinDeclare &&
      reponseAnterieureALaDerniereDeclaration(adaptationsRealisees, horodatage)
      ? "a_consigner"
      : "consignee";
  }
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

/**
 * Quand la réponse ACTUELLE a-t-elle été écrite pour la dernière fois ?
 *
 * C'est la date du texte affiché : `null` si la dernière entrée est un
 * effacement, ou si le journal ne dit rien.
 */
export function derniereConsignation(entrees: readonly EntreeJournalAdaptation[]): Date | null {
  const triees = [...entrees].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const derniere = triees[triees.length - 1];
  return derniere !== undefined && derniere.renseignee ? derniere.createdAt : null;
}

/** Situe la consignation par rapport au début de la session (même borne que le positionnement). */
export function consigneeAvantDebut(consigneeLe: Date, debutSession: Date): boolean {
  return consigneeLe.getTime() <= debutSession.getTime();
}

function situerParRapportAuDebut(instant: Date, debutSession: Date): string {
  return consigneeAvantDebut(instant, debutSession)
    ? "avant le début de la session"
    : "APRÈS le début de la session";
}

/**
 * La date d'une réponse consignée, dite honnêtement (écran de session ET dossier).
 *
 * 🔴 2026-09-15 (relecture #1095, D2) — la date « avant le début » était celle
 * de la PREMIÈRE écriture d'une période continue. Un texte d'attente saisi avant
 * la session puis réécrit après était donc présenté « avant le début » à côté du
 * texte final. La date située est désormais celle de la DERNIÈRE écriture — celle
 * du texte affiché ; la première réponse, si elle est plus ancienne, est dite à
 * côté, avec sa propre position. Aucune des deux n'efface l'autre.
 */
export function decrireDateConsignation(
  horodatage: HorodatageCircuitAdaptation,
  debutSession: Date | null,
): string {
  const derniere = horodatage.derniereConsignationLe;
  if (derniere === null) return "consignée (date non tracée au journal)";
  const situer = (d: Date): string =>
    debutSession === null ? "" : `, ${situerParRapportAuDebut(d, debutSession)}`;
  const premiere = horodatage.consigneeDepuis;
  const base = `consignée le ${formaterInstantParis(derniere)}${situer(derniere)}`;
  if (premiere === null || premiere.getTime() >= derniere.getTime()) return base;
  return `${base} (texte actuel ; première réponse le ${formaterInstantParis(premiere)}${situer(premiere)})`;
}

/**
 * Quand un besoin a-t-il été déclaré pour la dernière fois, pour CETTE inscription ?
 *
 * Deux sources datées, et seulement elles :
 *   · `Questionnaire.reponduAt` d'un positionnement de l'inscription qui répond
 *     « oui » (lu par `lirePositionnement`, qui écarte la saisie par l'organisme) ;
 *   · le journal `ACTION_JOURNAL_DECLARATION_BESOIN` de la personne — « mon
 *     compte », positionnement, console. Une déclaration faite APRÈS la fin de la
 *     session ne la concerne pas : elle ne rouvre pas un dossier clos.
 *
 * ⚠️ `trainees.updated_at` n'est PAS une source : il bouge à chaque retouche de
 * la fiche (nom, consentement, anonymisation), et daterait une déclaration qui
 * n'a jamais eu lieu.
 */
export function derniereDeclarationPourInscription(input: {
  readonly positionnements: readonly { reponses: unknown; reponduAt: Date | null }[];
  readonly declarationsStagiaire: readonly Date[];
  readonly finSession: Date | null;
}): Date | null {
  let derniere: Date | null = null;
  const retenir = (d: Date): void => {
    if (derniere === null || d.getTime() > derniere.getTime()) derniere = d;
  };
  for (const q of input.positionnements) {
    if (q.reponduAt !== null && lirePositionnement(q.reponses).besoinAdaptation === true) {
      retenir(q.reponduAt);
    }
  }
  for (const d of input.declarationsStagiaire) {
    if (input.finSession === null || d.getTime() <= input.finSession.getTime()) retenir(d);
  }
  return derniere;
}

/**
 * Action du journal d'activité qui DATE une déclaration de besoin d'adaptation.
 * Cible `Trainee`. `changes` ne porte que l'origine — jamais le détail.
 */
export const ACTION_JOURNAL_DECLARATION_BESOIN = "qualiopi.trainee.besoin_adaptation.declare";

/**
 * D'où vient le geste. `portail_mon_compte` = déclaration d'une situation de
 * handicap ou d'un problème de santé (elle coche `Trainee.situationHandicap`) ;
 * `portail_mon_compte_amenagement` = besoin d'aménagement SANS handicap (elle ne
 * la coche pas — cf. `besoin-sans-handicap.ts`).
 *
 * ⚠️ Écrite seulement, jamais relue à ce jour : `lireCircuitAdaptation` ne
 * sélectionne que `targetId` et `createdAt`. Ajouter une valeur est donc sans
 * risque pour la fenêtre où le worker et l'app tournent deux versions.
 */
export type OrigineDeclarationBesoin =
  "portail_positionnement" | "portail_mon_compte" | "portail_mon_compte_amenagement" | "console";
