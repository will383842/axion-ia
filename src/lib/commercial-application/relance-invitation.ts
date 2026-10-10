// RAPPELS DE L'INVITATION À L'ÉCHANGE — la règle, en module PUR (2026-09-27).
//
// Décision de Will du 2026-09-27 : une personne invitée à réserver son échange
// de 15 minutes, qui ne réserve pas, reçoit DEUX rappels au plus — trois jours
// puis sept jours après l'invitation — et plus rien ensuite.
//
// Ce module ne lit rien et n'écrit rien : il dit, à partir d'un état déjà lu,
// s'il faut relancer, et quel badge la console affiche. La lecture en base vit
// dans `features/commercial-application/relance-invitation-etat.ts`, le passage
// quotidien dans `relances-invitation-apporteur.ts`.
//
// ⚠️ Il entre dans le graphe du worker d'e-mails (par le module d'état) : il
// n'importe que le moteur commun des campagnes, PUR lui aussi, et doit le rester.
//
// CAMP-0a (ADR 0066 § g) : `motifBloquant`, `decisionRelance` et
// `jobIdRelanceInvitation` sont des ENVELOPPES au-dessus du moteur commun
// (`lib/relances/campagne.ts`), à comportement identique — mêmes signatures,
// mêmes constantes, mêmes motifs, mêmes identifiants de job.

import {
  cleEnvoi,
  decisionCampagne,
  motifsBloquants,
  type DrapeauxCampagne,
  type MotifCampagne,
  type RegleCampagne,
} from "../relances/campagne";

/** Nom du gabarit des rappels — aussi la clé de lecture du journal (`EmailLog.template`). */
export const GABARIT_RELANCE_INVITATION = "apporteur-invitation-relance";

export type EtapeRelanceInvitation = "j3" | "j7";

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Premier rappel : trois jours pleins après la dernière invitation partie. */
export const DELAI_J3_MS = 3 * JOUR_MS;
/** Second et dernier rappel : sept jours pleins après la dernière invitation partie. */
export const DELAI_J7_MS = 7 * JOUR_MS;
/**
 * Écart minimal entre les deux rappels.
 *
 * Dans le cas normal il vaut quatre jours (J+3 → J+7) et ne mord jamais. Il
 * sert au RATTRAPAGE : une invitation partie avant le déploiement du passage
 * (ou un passage manqué) a déjà plus de sept jours au premier rappel — sans cet
 * écart, le second partirait le lendemain.
 */
export const ECART_MIN_ENTRE_RELANCES_MS = 3 * JOUR_MS;
/**
 * Au-delà, une invitation n'est plus relancée du tout. Un « ton créneau
 * t'attend » un mois après l'invitation ne rappelle plus rien : il surprend.
 */
export const AGE_MAX_INVITATION_MS = 14 * JOUR_MS;
/** Jamais plus de deux rappels par invitation. */
export const RELANCES_MAX = 2;

/** Préfixe des clés d'envoi (identifiants de job) des rappels d'invitation. */
const CAMPAGNE_RELANCE_INVITATION = "apporteur-invit-relance";

/**
 * Identifiant du job BullMQ d'un rappel. DÉTERMINISTE : un passage qui repasse
 * (worker redémarré, passage rejoué) ne pose pas un second job — BullMQ ignore
 * un job dont l'identifiant existe, et le journal (`journaliserEnAttente`)
 * n'écrit pas deux lignes pour le même identifiant.
 *
 * Il porte l'identifiant de l'INVITATION relancée, et pas seulement l'empreinte :
 * après un « Renvoyer quand même », la nouvelle invitation a ses propres rappels.
 * Sans lui, leurs jobs porteraient l'identifiant des anciens — ignorés par
 * BullMQ, et sans ligne de journal : le passage suivant les reposerait sans fin.
 *
 * 🔴 L'empreinte, jamais l'adresse (une clé Redis se lit dans n'importe quel
 * dump). Aucun `:` — BullMQ s'en sert comme séparateur.
 */
export function jobIdRelanceInvitation(
  etape: EtapeRelanceInvitation,
  empreinte: string,
  invitationId: string,
): string {
  return cleEnvoi(CAMPAGNE_RELANCE_INVITATION, `${empreinte}-${invitationId}`, etape);
}

/**
 * La règle des rappels, exprimée pour le moteur commun. Ni « une par jour »
 * ni fenêtre horaire : l'écart de trois jours suffit, et le passage
 * quotidien choisit son heure — c'est le comportement d'origine, inchangé.
 */
export const REGLE_RELANCE_INVITATION: RegleCampagne<EtapeRelanceInvitation> = {
  etapes: [
    { id: "j3", delaiMs: DELAI_J3_MS },
    { id: "j7", delaiMs: DELAI_J7_MS },
  ],
  ecartMinMs: ECART_MIN_ENTRE_RELANCES_MS,
  silenceApresMs: AGE_MAX_INVITATION_MS,
  max: RELANCES_MAX,
  unParJour: false,
  fenetre: null,
};

/** Ce qui, une fois lu, suffit à décider. */
export interface EtatRelanceInvitation {
  /** Date de la DERNIÈRE invitation partie de la personne (toutes ses lignes). */
  readonly derniereInvitation: Date;
  /** Rappels déjà tentés APRÈS cette invitation — journal ou corbeille, tout statut. */
  readonly relancesApres: readonly Date[];
  /** Un rendez-vous Calendly existe pour la personne — quel que soit son statut, annulé compris. */
  readonly reserve: boolean;
  /**
   * Une réponse a été échangée après l'invitation : faite par la maison
   * (composeur, « j'ai répondu ailleurs ») OU reçue de la personne — sa
   * réponse par e-mail, relevée dans la boîte Zoho (2026-09-27). Une réponse
   * AUTOMATIQUE (absence, accusé) ne compte pas.
   */
  readonly repondu: boolean;
  /** Une de ses fiches est archivée ou classée sans suite. */
  readonly close: boolean;
  /** La fiche invitée est supprimée, effacée (art. 17) ou sans adresse lisible. */
  readonly efface: boolean;
}

export type MotifSansRelance =
  "efface" | "reserve" | "repondu" | "close" | "trop-ancienne" | "termine" | "pas-encore";

export type DecisionRelance =
  | { readonly relancer: true; readonly etape: EtapeRelanceInvitation }
  | { readonly relancer: false; readonly motif: MotifSansRelance };

/** Le motif du moteur commun → le motif historique des rappels d'invitation. */
const MOTIF_APPORTEUR: Partial<Record<MotifCampagne, MotifSansRelance>> = {
  efface: "efface",
  "action-faite": "reserve",
  "reponse-humaine": "repondu",
  close: "close",
  "fenetre-depassee": "trop-ancienne",
  plafond: "termine",
  "pas-encore": "pas-encore",
};

/**
 * Priorité HISTORIQUE des motifs des rappels quand plusieurs sont vrais à la
 * fois (le moteur commun, lui, lit `close` avant `action-faite` et `plafond`
 * avant `fenetre-depassee`). Elle ne change que le motif affiché : dès qu'un
 * motif est présent, rien ne part, dans un ordre comme dans l'autre.
 */
const PRIORITE_APPORTEUR: readonly MotifSansRelance[] = [
  "efface",
  "reserve",
  "repondu",
  "close",
  "trop-ancienne",
  "termine",
];

function premierMotifApporteur(motifs: readonly MotifCampagne[]): MotifSansRelance | null {
  const presents = new Set(motifs.map((m) => MOTIF_APPORTEUR[m]));
  return PRIORITE_APPORTEUR.find((m) => presents.has(m)) ?? null;
}

function drapeaux(
  e: Pick<EtatRelanceInvitation, "efface" | "reserve" | "repondu" | "close">,
): DrapeauxCampagne {
  return {
    efface: e.efface,
    opposition: false,
    adresseMorte: false,
    close: e.close,
    actionFaite: e.reserve,
    reponseHumaine: e.repondu,
  };
}

/**
 * Ce qui BLOQUE toute relance, indépendamment du calendrier. Partagé par le
 * passage quotidien et par le filet du départ (worker d'e-mails) : les deux
 * disent non pour les mêmes raisons.
 */
export function motifBloquant(
  e: Pick<EtatRelanceInvitation, "efface" | "reserve" | "repondu" | "close">,
): Extract<MotifSansRelance, "efface" | "reserve" | "repondu" | "close"> | null {
  return premierMotifApporteur(motifsBloquants(drapeaux(e))) as Extract<
    MotifSansRelance,
    "efface" | "reserve" | "repondu" | "close"
  > | null;
}

/** Faut-il relancer aujourd'hui, et avec quel rappel ? */
export function decisionRelance(e: EtatRelanceInvitation, maintenant: Date): DecisionRelance {
  const etat = { ...drapeaux(e), origine: e.derniereInvitation, envois: e.relancesApres };
  const d = decisionCampagne({ etat, maintenant, regle: REGLE_RELANCE_INVITATION });
  if (d.envoyer) return { relancer: true, etape: d.etape };
  const motif =
    premierMotifApporteur(motifsBloquants(etat, REGLE_RELANCE_INVITATION, maintenant)) ??
    MOTIF_APPORTEUR[d.motif] ??
    "pas-encore";
  return { relancer: false, motif };
}

// ── La console ───────────────────────────────────────────────────────────

/** Les badges qui disent une DÉCISION de Will : ils priment sur tout badge de réponse. */
export function estBadgeDecision(b: BadgeSuivi | null): b is DecisionSuivi {
  return (
    b !== null &&
    (b.type === "retenu" || b.type === "non-retenu" || b.type === "a-revoir" || b.type === "absent")
  );
}

/** Ce que la liste des apporteurs sait du suivi d'une personne. */
export interface SuiviInvitation {
  /** Dernière invitation partie (ou en file), s'il y en a une. */
  readonly invitation: Date | null;
  /** Rappels partis (ou en file) après cette invitation, du plus ancien au plus récent. */
  readonly relances: readonly Date[];
  /** Échange apporteur rattaché à une de ses fiches : réservé (non annulé), annulé, ou rien. */
  readonly echange: "reserve" | "annule" | null;
  /**
   * Début du dernier échange NON annulé (2026-10-07) : la colonne « Étape » y
   * lit « Échange réservé » (à venir) ou « Échange fait » (passé). Absent : inconnu.
   */
  readonly echangeLe?: Date | null;
  /**
   * Dernière réponse HUMAINE reçue de la personne par e-mail après son
   * invitation (2026-09-27). Absente ou `null` : aucune.
   */
  readonly reponse?: Date | null;
  /**
   * L'issue de l'échange décidée par Will (2026-09-28) — retenu, non retenu,
   * à revoir, absent. Calculée par `decisionAffichee`
   * (`features/admin-rendezvous/issue-apporteur.ts`). Absente : aucune.
   */
  readonly decision?: DecisionSuivi | null;
}

/** L'issue d'un échange apporteur, telle que la liste l'affiche (2026-09-28). */
export type DecisionSuivi =
  | { readonly type: "retenu"; readonly le: Date }
  | { readonly type: "non-retenu"; readonly le: Date }
  | { readonly type: "a-revoir" }
  | { readonly type: "absent"; readonly le: Date | null };

export type BadgeSuivi =
  | DecisionSuivi
  | { readonly type: "echange-reserve" }
  | { readonly type: "a-repondu"; readonly le: Date }
  | { readonly type: "echange-annule" }
  | { readonly type: "rappel"; readonly numero: 1 | 2; readonly le: Date }
  | { readonly type: "invite"; readonly le: Date };

/**
 * Le badge qui remplace « Sans réponse », par ordre de priorité : DÉCISION
 * (retenu, non retenu, à revoir, absent — 2026-09-28) > échange réservé >
 * a répondu > échange annulé > rappel 2 > rappel 1 > invité. `null` : rien à
 * dire, la liste garde son badge.
 *
 * La décision passe AVANT « échange réservé » : un échange tenu reste
 * « programmé » dans Calendly, et c'est l'issue qu'il faut lire, pas la
 * réservation.
 *
 * « A répondu » passe AVANT « échange annulé » (décision Will, 2026-09-27) : une
 * personne qui a annulé puis écrit a dit quelque chose de plus récent que son
 * annulation — c'est son message qu'il faut lire.
 */
export function badgeSuiviInvitation(s: SuiviInvitation | undefined): BadgeSuivi | null {
  if (!s) return null;
  if (s.decision) return s.decision;
  if (s.echange === "reserve") return { type: "echange-reserve" };
  if (s.reponse) return { type: "a-repondu", le: s.reponse };
  if (s.echange === "annule") return { type: "echange-annule" };
  if (!s.invitation) return null;
  const n = s.relances.length;
  if (n >= 2) return { type: "rappel", numero: 2, le: s.relances[n - 1]! };
  if (n === 1) return { type: "rappel", numero: 1, le: s.relances[0]! };
  return { type: "invite", le: s.invitation };
}
