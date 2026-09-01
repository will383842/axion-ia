/**
 * Les liens d'annulation et de report qui mènent CHEZ NOUS.
 *
 * ## Le problème que ces liens remplacent
 *
 * Les e-mails envoient aujourd'hui vers `calendly.com/cancellations/…`. Ces
 * adresses sont des **URL-capacités** : les copier suffit pour annuler le
 * rendez-vous de quelqu'un, sans authentification d'aucune sorte. L'audit du
 * 2026-08-27 de ce dépôt les avait déjà classées comme telles.
 *
 * Nos liens ne doivent pas hériter de ce défaut par distraction. D'où une
 * signature, et trois décisions qui ne vont pas de soi.
 *
 * ## 1. 🔴 L'ADRESSE DE L'INVITÉ N'ENTRE PAS DANS LE JETON
 *
 * Le contenu d'un jeton de ce type est **signé, jamais chiffré** : il se relit
 * d'un décodage base64. Y mettre une adresse e-mail la remettrait dans l'URL —
 * donc dans l'historique du navigateur, les journaux du serveur et de
 * Cloudflare, et l'en-tête `Referer`. Ce serait contredire, dans la même
 * fonctionnalité, la doctrine écrite deux fois ailleurs dans ce parcours
 * (`reprise-formulaire.ts`, `appel/confirme/page.tsx`).
 *
 * On signe donc l'identifiant de NOTRE ligne en base. Il ne révèle ni
 * l'identité de l'invité, ni même un identifiant Calendly, et la ligne porte
 * déjà tout le reste — adresse, horaire, statut, liens de repli.
 *
 * ## 2. 🔴 LA DURÉE DE VIE VIENT DU RENDEZ-VOUS, PAS D'UN DÉFAUT
 *
 * `magic-token.ts` donne 24 h au scope `cancel`. Ce serait faux ici : la
 * confirmation part dès la réservation, et le rendez-vous peut être à trois
 * semaines. Le lien serait **mort avant que la personne en ait besoin** — alors
 * que l'e-mail lui promet, noir sur blanc, de pouvoir se décommander.
 *
 * On dérive donc la fenêtre de la donnée, exactement comme le fait déjà
 * `emargement` dans le même fichier : le plafond du scope devient un garde-fou
 * contre un appel qui oublierait `ttlMs`, jamais la fenêtre réelle.
 *
 * ## 3. ⚠️ UN LIEN TRANSFÉRÉ RESTE VALABLE, ET C'EST VOULU
 *
 * On ne lie pas le jeton à une session : personne n'en a sur ce site. Un
 * prospect qui demande à son assistante d'annuler doit pouvoir le faire. C'est
 * un arbitrage assumé, pas un oubli — et il est le même que celui des liens
 * Calendly qu'il remplace, à la signature près.
 *
 * ## ⚠️ CE QUE CES LIENS NE FONT PAS, ET QUI EST DANS LA PAGE
 *
 * Cliquer un de ces liens ne doit RIEN annuler. Un antivirus de messagerie
 * d'entreprise, ou le pré-chargement d'Outlook, émet des requêtes sans qu'un
 * humain ait cliqué. La page qu'ils ouvrent AFFICHE ; c'est un bouton qui AGIT.
 * Ce dépôt documente déjà ce raisonnement à propos de l'opposition vivier, en
 * précisant que l'inverse ne vaudrait pas pour une action irréversible.
 * Annuler un rendez-vous en est une : le créneau libéré peut être repris dans
 * la minute.
 */

import { signMagicToken, verifyMagicToken, type VerifyFailReason } from "@/lib/magic-token";

/** Les deux gestes qu'un lien peut porter. */
export type GesteRendezVous = "cancel" | "reschedule";

/**
 * Les champs cachés que les pages postent à leur action.
 *
 * 🔴 ILS VIVENT ICI, PAS DANS LE FICHIER `"use server"` DE L'ACTION. Next
 * transforme chaque export d'un tel fichier en point d'entrée réseau, et une
 * constante n'en est pas un : le fichier ENTIER cesse de compiler, sous un
 * message qui désigne la mauvaise cause (« Export X doesn't exist in target
 * module », alors que l'export existe). Ni `tsc` ni eslint ne voient cette
 * règle — seul `next build` la mesure, et la garde
 * `un-fichier-use-server-n-exporte-que-des-fonctions.spec.ts` la rattrape avant.
 */
export const CHAMP_JETON = "t";
export const CHAMP_LOCALE_ANNULATION = "locale";
/** Le créneau visé par un report. */
export const CHAMP_NOUVEAU_DEBUT = "debut";

/**
 * Marge ajoutée après l'heure du rendez-vous.
 *
 * Un lien qui expirerait à l'heure pile serait mort pendant le rendez-vous
 * lui-même. Deux heures couvrent la durée de l'échange et le temps de réagir
 * juste après.
 */
export const MARGE_APRES_MINUTES = 120;

/**
 * Fenêtre minimale, même pour un rendez-vous imminent.
 *
 * Sans plancher, un rendez-vous dans dix minutes produirait un lien qui expire
 * dans deux heures dix — c'est correct — mais un rendez-vous DÉJÀ PASSÉ
 * produirait une durée négative, donc un jeton mort-né. La page saurait le
 * dire, mais elle dirait « lien expiré » à quelqu'un dont le lien vient d'être
 * fabriqué, ce qui est incompréhensible.
 */
export const PLANCHER_MINUTES = 60;

/**
 * Plafond absolu, aligné sur le garde-fou des autres scopes longs.
 *
 * Il ne s'applique en pratique qu'à un rendez-vous fixé très loin. Il existe
 * pour qu'aucune donnée aberrante en base ne fabrique un lien éternel.
 */
export const PLAFOND_JOURS = 90;

/**
 * Durée de vie d'un lien, dérivée de l'heure du rendez-vous.
 *
 * Pure et exportée : c'est la seule décision non triviale du module, et elle
 * doit s'éprouver sans signer quoi que ce soit.
 */
export function dureeDeVieMs(debut: Date, maintenant: Date = new Date()): number {
  const brut = debut.getTime() - maintenant.getTime() + MARGE_APRES_MINUTES * 60_000;
  const plancher = PLANCHER_MINUTES * 60_000;
  const plafond = PLAFOND_JOURS * 86_400_000;
  return Math.min(Math.max(brut, plancher), plafond);
}

/** Le chemin de la page, sans le jeton. */
export function cheminDuGeste(locale: string, geste: GesteRendezVous): string {
  return geste === "cancel" ? `/${locale}/appel/annuler` : `/${locale}/appel/reporter`;
}

export interface DemandeDeLien {
  /** L'identifiant de NOTRE ligne `CalendlyEvent`. Jamais celui de l'invité. */
  readonly rendezVousId: string;
  /** Début du rendez-vous — c'est lui qui fixe la durée de vie. */
  readonly debut: Date;
  readonly locale: string;
  readonly geste: GesteRendezVous;
  /** Injectable pour les tests. */
  readonly maintenant?: Date;
}

/**
 * Fabrique le lien signé, chemin compris.
 *
 * ⚠️ Rend une adresse RELATIVE. L'origine est ajoutée par l'appelant, qui la
 * connaît (`SITE_URL`) — la coder ici obligerait ce module à connaître
 * l'environnement, et un lien d'e-mail construit sur une mauvaise origine est
 * un lien mort qu'on ne découvre qu'en production.
 */
export async function lienDuGeste(d: DemandeDeLien): Promise<string> {
  const jeton = await signMagicToken({
    scope: d.geste,
    // 🔑 `resourceId` et RIEN d'autre. Pas d'`email` : le contenu est lisible.
    resourceId: d.rendezVousId,
    ttlMs: dureeDeVieMs(d.debut, d.maintenant ?? new Date()),
  });
  return `${cheminDuGeste(d.locale, d.geste)}?t=${encodeURIComponent(jeton)}`;
}

/**
 * Ce que la page apprend d'un jeton.
 *
 * 🔑 `expire` a sa propre valeur, séparée d'`invalide`. Les deux mènent à un
 * refus, mais pas au même message : « ce lien a expiré, appelez-nous » est
 * actionnable, « lien invalide » ne l'est pas. Et surtout, une rotation du
 * secret rendrait `invalide` sur des liens parfaitement légitimes — les
 * distinguer est ce qui permettrait de s'en apercevoir.
 */
export type LectureDuLien =
  | { readonly ok: true; readonly rendezVousId: string }
  | { readonly ok: false; readonly raison: "expire" }
  | { readonly ok: false; readonly raison: "invalide" }
  /** Le jeton est valide mais porte l'autre geste. */
  | { readonly ok: false; readonly raison: "mauvais_geste" };

/**
 * Les échecs qui viennent d'une signature, par opposition à une expiration.
 *
 * ⚠️ `invalid_signature` figure ici, et c'est le cas qu'une rotation du secret
 * produirait EN MASSE, sur des liens déjà envoyés à des prospects. Le symptôme
 * serait « votre lien ne marche pas », indiscernable d'un lien tronqué par une
 * messagerie — et personne ne relierait une vague de plaintes à une rotation
 * faite trois jours plus tôt. C'est un coût à connaître AVANT de tourner
 * `AUTH_SECRET`, pas après.
 */
const ECHECS_DE_SIGNATURE: ReadonlySet<VerifyFailReason> = new Set([
  "malformed_token",
  "malformed_payload",
  "invalid_signature",
  "invalid_email",
]);

/** Vérifie un jeton et rend l'identifiant du rendez-vous. */
export async function lireLeLien(jeton: string, geste: GesteRendezVous): Promise<LectureDuLien> {
  const r = await verifyMagicToken(jeton, { scope: geste });
  if (r.ok) return { ok: true, rendezVousId: r.resourceId };
  if (r.reason === "expired") return { ok: false, raison: "expire" };
  if (r.reason === "scope_mismatch" || r.reason === "resource_mismatch") {
    // Un jeton d'annulation présenté comme un jeton de report, ou l'inverse.
    // C'est la séparation que `verifyMagicToken` assure et qu'il ne faut pas
    // laisser retomber dans « invalide » : elle signale un lien détourné, pas
    // un lien abîmé.
    return { ok: false, raison: "mauvais_geste" };
  }
  // 🔴 UN ÉCHEC DE SIGNATURE SE JOURNALISE, MÊME SI LE VISITEUR N'EN SAURA RIEN.
  //
  // Le premier jet écrivait ici un ternaire dont les deux branches rendaient la
  // même chose : le jeu `ECHECS_DE_SIGNATURE` était documenté puis inutilisé,
  // donc décoratif — exactement le genre de protection déclarée et inerte que
  // ce parcours a déjà produite trois fois.
  //
  // Ce qu'il doit faire : rendre VISIBLE une vague d'échecs de signature. Une
  // rotation d'`AUTH_SECRET` invaliderait d'un coup TOUS les liens déjà envoyés
  // à des prospects, et le symptôme serait « votre lien ne marche pas » —
  // indiscernable d'un lien tronqué par une messagerie. Sans cette trace,
  // personne ne relierait une vague de plaintes à une rotation faite trois
  // jours plus tôt.
  //
  // Le visiteur, lui, lit toujours « invalide » : la cause technique ne
  // l'intéresse pas et ne le concerne pas.
  if (ECHECS_DE_SIGNATURE.has(r.reason)) {
    console.warn(
      `[liens-rendez-vous] signature refusée (${r.reason}) sur un lien « ${geste} ». ` +
        `Si ce message se répète, vérifier une rotation récente d'AUTH_SECRET : ` +
        `elle invalide TOUS les liens déjà envoyés.`,
    );
  }
  return { ok: false, raison: "invalide" };
}
