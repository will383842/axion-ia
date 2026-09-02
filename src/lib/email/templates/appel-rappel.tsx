// Email — les trois messages d'un appel de découverte : confirmation, J-1, H-1.
//
// ## Pourquoi ce gabarit existe
//
// Avant lui, une personne qui réservait un appel ne recevait de nous
// **strictement rien**. Son seul signal était une invitation d'agenda émise par
// Google au nom du compte connecté à Calendly — que Gmail flanque d'un
// « expéditeur inconnu · Signaler comme spam ».
//
// Les rappels de Calendly relèvent des Workflows, une fonctionnalité payante.
// Ceux-ci sont les nôtres, et ils partent de `noreply@axion-ia.com`.
//
// ## 🔴 CE GABARIT NE CONFIRMAIT PAS — IL LE FAIT DEPUIS LE 2026-08-28
//
// La version du 2026-08-28 (matin) portait ici : « décision assumée, on
// N'AJOUTE PAS de confirmation, Calendly en envoie déjà une ». **Will a tranché
// l'inverse le même jour** : à la réservation, le prospect doit recevoir un
// message de NOUS, à notre charte.
//
// ## ⚠️ ET NON, ON NE PEUT PAS SUPPRIMER CELLE DE CALENDLY
//
// Will l'a vérifié dans le tableau de bord le 2026-08-28 : le panneau
// « Calendar invitation » affiche « Upgrade to Standard to edit your calendar
// invitations » et **n'a aucun interrupteur** — contrairement à « Email
// reminders » et « Email follow-up », désactivables en gratuit. L'invitation
// d'agenda part donc TOUJOURS. Le prospect reçoit deux messages à la
// réservation, et c'est assumé : passer au plan Standard coûterait ~144 €/an
// pour en retirer un.
//
// 🔑 **Conséquence directe : ce gabarit ne doit JAMAIS embarquer de `.ics`.**
// Une pièce jointe de notre côté, ajoutée à l'invitation Calendly qui part de
// toute façon, créerait **deux entrées d'agenda pour un seul rendez-vous** —
// un doublon dans le calendrier du prospect, ce qui est pire que deux e-mails.
// Un `.ics` avait été prévu puis abandonné pour cette raison ; ne pas le
// réintroduire sans avoir d'abord désactivé l'invitation Calendly.
//
// À la place, la confirmation porte une ligne qui ARTICULE les deux messages
// (« l'invitation d'agenda vous parvient séparément »). C'est ce qui retire la
// sensation de doublon, à défaut de retirer le doublon.
//
// ## 🔴 2026-09-02 — LA CONFIRMATION ÉTAIT « BOURRÉE D'INFOS EN VRAC »
//
// Constat de Will sur l'e-mail RÉELLEMENT reçu : cinq paragraphes gris
// indifférenciés — l'horaire, le lieu, un « Bonjour X, » coincé au milieu d'un
// paragraphe fourre-tout, l'invitation d'agenda, une ligne « Un imprévu ? », la
// signature. Aucune hiérarchie, donc aucun point d'entrée : le lecteur devait
// LIRE pour retrouver l'heure de son rendez-vous, là où il vient chercher une
// réponse en un coup d'œil.
//
// La confirmation (famille B) rend désormais :
//
//   1. un RÉCAPITULATIF encadré — quand / durée / format — construit en
//      `<Section>` (React Email en rend une `<table>`, seul assemblage sur
//      lequel Outlook 2016-2021 se comporte : son moteur est celui de Word, il
//      ne connaît ni flex ni grid) ;
//   2. la salutation APRÈS, jamais avant : les résumés d'Apple Intelligence /
//      Gemini / Copilot se construisent sur les premiers caractères du corps, et
//      un « Bonjour Jean, » en tête les consomme pour ne rien dire (§3.6) ;
//   3. « Ce qui se passe maintenant » — trois puces qui annoncent les messages
//      à venir. C'est le levier anti-abandon : un prospect qui ignore qu'une
//      invitation Calendly ET deux rappels vont suivre lit chaque nouveau
//      message comme une anomalie, et le doute précède l'absence ;
//   4. annuler / reporter VISIBLES, mais en secondaire — l'action attendue
//      d'une confirmation est de ne rien faire.
//
// ⚠️ **J-1 et H-1 n'ont PAS reçu ce traitement, et c'est délibéré.** Ils
// relèvent de la famille C : « trois lignes maximum, se lit en deux secondes »
// (§7.5). Le récapitulatif y ajouterait de la surface pour une information que
// le destinataire connaît déjà — il l'a lue à la confirmation. Ce qui sert à la
// réservation dégraderait le rappel.
//
// ## Un seul gabarit pour trois moments, et pourquoi
//
// Les trois messages partagent le lieu, la durée, la signature et surtout **les
// liens d'annulation et de report**. Trois fichiers auraient signifié trois
// endroits où corriger ces liens — et c'est toujours celui qu'on oublie qui
// part. Seuls changent le titre, la phrase d'horaire et l'objet ; ils vivent
// dans `COPY[locale][moment]`.
//
// ## ⚠️ LE BUDGET DE LIENS EST SATURÉ — MESURÉ, PAS ESTIMÉ
//
// Famille B = 9 URL distinctes (§5.4, `REGIME_FAMILLE` dans `_layout`). Une
// confirmation en visioconférence en consomme déjà **9** : le logo, le lien de
// réunion, annuler, reporter, quatre profils sociaux du pied, l'adresse de
// contact. **Aucun lien ne peut être ajouté ici sans en retirer un ailleurs.**
// La refonte du 2026-09-02 n'en introduit donc aucun : le récapitulatif et le
// bloc d'actions secondaires réemploient des URL déjà présentes — le budget
// compte les adresses DISTINCTES, pas leurs occurrences. Si un CTA paraît un
// jour indispensable, la question à trancher d'abord est ce qu'on enlève.
//
// ## Ce qu'il porte, et pourquoi
//
// Le lien d'annulation et celui de report sont là à dessein, aux trois moments.
// Un message qui ne permet pas de se décommander produit des absences plutôt
// que des reports : une personne qui ne peut plus, et qui n'a pas de bouton, ne
// fait rien.

import { Text, Link, Section } from "@react-email/components";
import { type ReactNode } from "react";
import { objetCompose } from "../objet-email";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";
import { canalDuRendezVous, type CanalRendezVous } from "@/server/calendly/canal";

/**
 * Le moment auquel ce message part.
 *
 * ⚠️ Défaut `"h1"` : les jobs `appel-rappel` mis en file AVANT cette version ne
 * portent pas de `moment`. Sans ce défaut, ils rendraient un titre vide au
 * moment d'être dépilés — un e-mail déjà accepté ne doit jamais casser parce
 * qu'on a enrichi le gabarit après coup.
 */
export type MomentAppel = "confirmation" | "j1" | "h1";

interface Payload {
  /** Prénom, ou nom complet si c'est tout ce que Calendly a transmis. */
  prenom: string;
  /** Heure de début, déjà formatée par l'appelant, en heure de Paris. */
  heure: string;
  /**
   * Date de début, déjà formatée par l'appelant (ex « mardi 2 septembre »).
   * Utilisée par la confirmation seule : à J-1 on dit « demain », à H-1 on ne
   * dit pas la date du tout — la répéter à une heure de l'appel est du bruit.
   */
  date?: string;
  /** Durée réelle du rendez-vous, en minutes, telle que Calendly la connaît. */
  dureeMinutes: number;
  /** Le numéro que le consultant appellera, ou le lieu du rendez-vous. */
  lieu?: string;
  /**
   * Le format du rendez-vous, quand l'appelant a pu le dériver proprement.
   *
   * 🔑 OPTIONNEL À DESSEIN. L'appelant qui dispose de la ligne complète
   * (`rappels-appel.ts`) le dérive du `type` que Calendly pose — la source de
   * vérité. Celui qui ne l'a pas l'omet, et le gabarit retombe alors sur la
   * forme de `lieu`, qui est le dernier recours documenté dans
   * `calendly/canal.ts`. Le rendre obligatoire forcerait un appelant qui ne
   * sait pas à inventer une valeur, ce qui est exactement le défaut que toute
   * cette chaîne cherche à éviter.
   */
  format?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  moment?: MomentAppel;
}

const momentDe = (p: { moment?: MomentAppel }): MomentAppel => p.moment ?? "h1";

/** Une chaîne non vide, ou `null`. Aucune branche ne doit rendre « undefined ». */
const texteOuNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * « vendredi 25 septembre à 11:30 », ou l'une des deux moitiés, ou rien.
 *
 * 🔴 CHAQUE MORCEAU EST FACULTATIF, ET LE RIEN EST UNE RÉPONSE. La charge
 * transite par une file BullMQ : rien ne garantit que `date` et `heure` soient
 * là au moment du rendu. L'interpolation naïve produisait « le undefined à
 * undefined » — le pire des trois cas, parce qu'il ne lève pas : il part.
 */
function quandTexte(locale: Locale, p: Payload): string | null {
  const date = texteOuNull(p.date);
  const heure = texteOuNull(p.heure);
  if (date && heure) return locale === "fr" ? `${date} à ${heure}` : `${date} at ${heure}`;
  return date ?? heure;
}

/** « 45 minutes », ou rien : une durée absente ou nulle ne s'invente pas. */
function dureeTexte(p: Payload): string | null {
  const d = p.dureeMinutes;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? `${d} minutes` : null;
}

export const appelRappelSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const p = payload as unknown as Payload;
  const m = momentDe(p);
  const quand = quandTexte(locale, p);
  if (locale === "fr") {
    // 🔑 `objetCompose` n'est appelé QUE s'il y a de quoi composer. Sans
    // horaire, « Confirmé : undefined » serait un objet parfaitement conforme à
    // la borne de longueur, et parfaitement faux — la garde ne mesure que sa
    // taille.
    if (m === "confirmation")
      return quand ? objetCompose("Confirmé :", quand) : `Votre rendez-vous est confirmé`;
    if (m === "j1") return `Rappel : rendez-vous demain à ${p.heure ?? "l'heure prévue"}`;
    return `Rendez-vous dans une heure, à ${p.heure ?? "l'heure prévue"}`;
  }
  if (m === "confirmation")
    return quand ? objetCompose("Confirmed:", quand) : `Your meeting is confirmed`;
  if (m === "j1") return `Reminder: meeting tomorrow at ${p.heure ?? "the agreed time"}`;
  return `Meeting in one hour, at ${p.heure ?? "the agreed time"}`;
};

/*
 * Phrases écrites UNE FOIS et réemployées à deux endroits.
 *
 * 🔑 Elles vivent hors de `COMMUN` parce qu'un littéral d'objet ne peut pas se
 * citer lui-même. Les recopier — la confirmation en reprend une moitié, les
 * rappels le tout — ferait deux textes tenus de dire la même chose, donc deux
 * textes qui divergeront à la première relecture de l'un des deux.
 */
const RIEN_A_PREPARER = {
  fr: "Rien à préparer de votre côté.",
  en: "Nothing to prepare on your side.",
} as const;
const DEROULE = {
  fr: "On vous écoute, on répond à vos questions, et vous repartez avec un avis clair — même si la réponse est « ce n'est pas pour vous ».",
  en: "We listen, we answer your questions, and you leave with a clear view — even if the answer is “this isn't for you”.",
} as const;
// 🔴 Calendly envoie TOUJOURS son invitation d'agenda : sur la formule gratuite,
// ce message n'est pas désactivable (vérifié par Will le 2026-08-28, panneau
// « Calendar invitation » : « Upgrade to Standard »). Le prospect reçoit donc
// deux messages à la réservation. Cette phrase les ARTICULE au lieu de faire
// comme si l'autre n'existait pas — c'est ce qui retire la sensation de doublon.
const INVITATION_AGENDA = {
  fr: "L'invitation d'agenda vous parvient séparément, par Calendly.",
  en: "Your calendar invitation arrives separately, from Calendly.",
} as const;

/** Ce qui ne dépend PAS du moment : lieu, attente, liens, signature. */
const COMMUN = {
  fr: {
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    // 🔑 Conditionnel au CANAL (2026-08-31). Le gabarit reçoit `lieu` — un
    // numéro ou un lien de réunion — et le canal en est DÉRIVÉ, jamais transmis
    // en double : deux champs qui doivent s'accorder finissent par diverger.
    // Promettre « nous vous appellerons » à quelqu'un qui attend un lien de
    // visio est exactement le genre d'erreur qu'aucun test de longueur ne voit.
    // 🔑 TROIS CAS, et un quatrième qui n'a pas de lieu du tout.
    //
    // Un lieu que rien ne permet de classer — « chez le client », une saisie
    // libre en console — ne doit affirmer NI l'un NI l'autre : on le mentionne,
    // sans promettre un canal qu'on ignore. Deux branches feraient retomber
    // l'inconnu sur « nous vous appellerons », c'est-à-dire sur une promesse
    // fausse, et rien ne le signalerait.
    lieuVisio: "Lien de la visioconférence :",
    // 🔴 LE CAS QUI N'EXISTAIT PAS. Calendly crée la conférence de façon
    // ASYNCHRONE : entre la réservation et la création du lien, il n'y a rien à
    // afficher. Se taire laisserait le prospect sans instruction ; inventer un
    // lien est impossible. On le renvoie donc vers l'invitation d'agenda, qui
    // portera le lien dès qu'il existera.
    lieuVisioSansLien:
      "Le lien de connexion figure dans l'invitation d'agenda que vous recevez séparément.",
    lieuTelephone: (l: string) => `Nous vous appellerons au ${l}.`,
    lieuIndetermine: (l: string) => `Lieu du rendez-vous : ${l}`,
    // On dit ce qu'on va faire, pas ce qu'on attend. La personne n'a rien à préparer.
    attendu: `${RIEN_A_PREPARER.fr} ${DEROULE.fr}`,
    deroule: DEROULE.fr,
    invitationAgenda: INVITATION_AGENDA.fr,
    // ── Récapitulatif (confirmation seule) ─────────────────────────────────
    // Libellés COURTS : rendus en petites capitales espacées, où chaque
    // caractère coûte le double de largeur. « Quand », pas « Date et heure du
    // rendez-vous » — qui passerait à la ligne sur un écran de 320 px.
    recapTitre: "Votre rendez-vous",
    recapQuand: "Quand",
    recapDuree: "Durée",
    recapFormat: "Format",
    recapLieu: "Lieu",
    // 🔑 Le fuseau est une PRÉCISION, pas une valeur : un prospect à Genève, à
    // Londres ou à Montréal qui ne le lit pas se trompe d'une à six heures — et
    // ne le découvre qu'au moment de ne pas être là.
    recapFuseau: "Heure de Paris",
    recapVisio: "Visioconférence",
    recapTelephone: "Téléphone",
    // ── Ce qui se passe maintenant (confirmation seule) ────────────────────
    maintenantTitre: "Ce qui se passe maintenant",
    maintenantPuces: [
      `${INVITATION_AGENDA.fr} C'est le même rendez-vous — vous n'avez rien à confirmer.`,
      "Nous vous écrivons la veille, puis une dernière fois une heure avant.",
      `${RIEN_A_PREPARER.fr} On part de votre situation, pas d'un questionnaire.`,
    ],
    empeche: "Un imprévu ?",
    annuler: "Annuler",
    reporter: "Choisir un autre créneau",
    ou: " ou ",
  },
  en: {
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    lieuVisio: "Video meeting link:",
    lieuVisioSansLien: "The joining link is in the calendar invitation you receive separately.",
    lieuTelephone: (l: string) => `We will call you on ${l}.`,
    lieuIndetermine: (l: string) => `Meeting location: ${l}`,
    attendu: `${RIEN_A_PREPARER.en} ${DEROULE.en}`,
    deroule: DEROULE.en,
    invitationAgenda: INVITATION_AGENDA.en,
    recapTitre: "Your meeting",
    recapQuand: "When",
    recapDuree: "Duration",
    recapFormat: "Format",
    recapLieu: "Location",
    recapFuseau: "Paris time",
    recapVisio: "Video meeting",
    recapTelephone: "Phone call",
    maintenantTitre: "What happens next",
    maintenantPuces: [
      `${INVITATION_AGENDA.en} Same meeting — nothing for you to confirm.`,
      "We write to you the day before, then once more an hour ahead.",
      `${RIEN_A_PREPARER.en} We start from your situation, not from a questionnaire.`,
    ],
    empeche: "Something came up?",
    annuler: "Cancel",
    reporter: "Pick another slot",
    ou: " or ",
  },
} as const;

type Copie = (typeof COMMUN)["fr"] | (typeof COMMUN)["en"];

/** Ce qui change d'un moment à l'autre : le titre, l'horaire, la signature. */
const COPY = {
  fr: {
    confirmation: {
      // Le pré-en-tête PROLONGE l'objet (§3.5) : l'objet dit la date, celui-ci
      // dit ce qu'on attend du lecteur — c'est-à-dire rien — et où sont les
      // deux liens qu'il pourrait chercher.
      preview: (d: string | null) =>
        d
          ? `${d}, rien à préparer. Les liens pour reporter ou annuler sont dans le message.`
          : `Rien à préparer. Les liens pour reporter ou annuler sont dans le message.`,
      eyebrow: "Rendez-vous de découverte",
      title: "C'est confirmé",
      signature: "À très vite,\nL'équipe Axion-IA",
    },
    j1: {
      preview: (d: string | null) =>
        d
          ? `${d}, rien à préparer. Un imprévu ? Le lien pour reporter est ici.`
          : `Rien à préparer. Un imprévu ? Le lien pour reporter est ici.`,
      title: "Votre rendez-vous a lieu demain",
      quand: (h: string, d: string | null) =>
        `Petit rappel : nous nous retrouvons demain à ${h} (heure de Paris)${d ? `, pour ${d}` : ""}.`,
      signature: "À demain,\nL'équipe Axion-IA",
    },
    h1: {
      preview: (d: string | null) =>
        d ? `${d}, rien à préparer de votre côté.` : `Rien à préparer de votre côté.`,
      title: "Votre rendez-vous a lieu dans une heure",
      quand: (h: string, d: string | null) =>
        `Petit rappel : nous nous retrouvons à ${h} (heure de Paris)${d ? `, pour ${d}` : ""}.`,
      signature: "À tout à l'heure,\nL'équipe Axion-IA",
    },
  },
  en: {
    confirmation: {
      preview: (d: string | null) =>
        d
          ? `${d}, nothing to prepare. Links to reschedule or cancel are inside.`
          : `Nothing to prepare. Links to reschedule or cancel are inside.`,
      eyebrow: "Discovery meeting",
      title: "You're all set",
      signature: "Talk soon,\nThe Axion-IA team",
    },
    j1: {
      preview: (d: string | null) =>
        d
          ? `${d}, nothing to prepare. Something came up? Reschedule inside.`
          : `Nothing to prepare. Something came up? Reschedule inside.`,
      title: "Your meeting is tomorrow",
      quand: (h: string, d: string | null) =>
        `A quick reminder: we meet tomorrow at ${h} (Paris time)${d ? `, for ${d}` : ""}.`,
      signature: "Talk tomorrow,\nThe Axion-IA team",
    },
    h1: {
      preview: (d: string | null) =>
        d ? `${d}, nothing to prepare on your side.` : `Nothing to prepare on your side.`,
      title: "Your meeting is in one hour",
      quand: (h: string, d: string | null) =>
        `A quick reminder: we meet at ${h} (Paris time)${d ? `, for ${d}` : ""}.`,
      signature: "Talk soon,\nThe Axion-IA team",
    },
  },
} as const;

/**
 * Une chaîne qui ressemble à un lien de réunion.
 *
 * 🔑 UN SEUL test, partagé par le récapitulatif (confirmation) et par la ligne
 * de lieu (J-1 / H-1). Deux expressions régulières pour la même question
 * finiraient par se contredire sur le cas tordu — et c'est le cas tordu qui
 * produit un e-mail absurde.
 */
const estUnLienDeReunion = (valeur: string): boolean => /^https?:\/\//i.test(valeur);

/**
 * Le format à annoncer : celui que l'appelant a dérivé, sinon celui que la forme
 * du lieu laisse deviner.
 *
 * On ne fait pas confiance à la chaîne reçue — le champ est typé `string` parce
 * que les charges d'e-mail transitent par une file et sont sérialisées. Une
 * valeur hors nomenclature retombe donc sur la déduction, jamais sur elle-même.
 */
function formatDuRendezVous(p: { lieu?: string; format?: string }): CanalRendezVous {
  if (p.format === "telephone" || p.format === "visio" || p.format === "inconnu") {
    return p.format;
  }
  return canalDuRendezVous(p.lieu);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles du récapitulatif et des blocs de la confirmation
//
// ⚠️ Tout est en ligne, et rien n'utilise flex ni grid : Outlook 2016-2021 rend
// le HTML avec le moteur de Word, qui ne connaît ni l'un ni l'autre — une carte
// en flex y retombe empilée sans marge, et personne ne le voit avant l'envoi.
// Les `<Section>` de React Email rendent des `<table>`, seul assemblage sur
// lequel les six clients cibles s'accordent.
// ─────────────────────────────────────────────────────────────────────────────

/** Fond ivoire + filet : la carte se détache sans peser comme un bloc plein. */
const carteRecap: React.CSSProperties = {
  backgroundColor: "#f6f1e8",
  border: `1px solid ${emailStyles.COLORS.border}`,
  borderRadius: "16px",
  padding: "20px 22px",
  margin: "0 0 26px 0",
};
const surtitreRecap: React.CSSProperties = {
  margin: "0 0 14px 0",
  fontSize: "11px",
  lineHeight: 1.4,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: emailStyles.COLORS.textMuted,
};
const libelleRecap: React.CSSProperties = {
  margin: "0 0 2px 0",
  fontSize: "11px",
  lineHeight: 1.4,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: emailStyles.COLORS.textMuted,
};
const valeurRecap: React.CSSProperties = {
  margin: 0,
  fontSize: "17px",
  lineHeight: 1.35,
  fontWeight: 600,
  color: "#241d15",
};
const precisionRecap: React.CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: "14px",
  lineHeight: 1.5,
  color: emailStyles.COLORS.textMuted,
  // Un lien de réunion ne doit pas élargir la colonne sur un écran de 320 px.
  wordBreak: "break-word",
};
/** Séparateur entre deux entrées — voir la note dans `RecapRendezVous`. */
const entreeSuivante: React.CSSProperties = {
  borderTop: `1px solid ${emailStyles.COLORS.border}`,
  paddingTop: "14px",
  marginTop: "14px",
};
const titreBloc: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "13px",
  lineHeight: 1.4,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: emailStyles.COLORS.textMuted,
};
const puceTexte: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: emailStyles.COLORS.text,
  margin: "0 0 8px 0",
};
const pucePoint: React.CSSProperties = {
  color: emailStyles.COLORS.terracotta,
  fontWeight: 700,
};
/** Actions secondaires : lisibles, séparées du corps, jamais en position de CTA. */
const blocSecondaire: React.CSSProperties = {
  margin: "24px 0 0 0",
  paddingTop: "16px",
  borderTop: `1px solid ${emailStyles.COLORS.border}`,
};
const texteSecondaire: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  lineHeight: 1.7,
  color: emailStyles.COLORS.textMuted,
};
/** Le lien reste VISIBLE (couleur + soulignement) même en position secondaire. */
const lienSecondaire: React.CSSProperties = {
  color: emailStyles.COLORS.accent,
  fontWeight: 700,
  textDecoration: "underline",
};

/** Une entrée du récapitulatif. `precision` est la ligne grise sous la valeur. */
type LigneRecap = { libelle: string; valeur: ReactNode; precision?: ReactNode };

/**
 * Les entrées du récapitulatif, dans l'ordre où le regard les cherche.
 *
 * 🔴 CHAQUE ENTRÉE PEUT MANQUER, ET UNE ENTRÉE MANQUANTE EST OMISE — jamais
 * remplie d'un tiret ni d'un « à préciser ». Un récapitulatif qui affiche
 * « Quand : — » a l'air cassé, et fait douter du reste ; un récapitulatif à
 * deux lignes a l'air complet.
 *
 * 🔑 Le format n'est PAS redérivé ici : il est calculé une fois par
 * `formatDuRendezVous` et passé en paramètre. Le redériver ferait un second
 * endroit où le canal se décide — exactement ce que `calendly/canal.ts` a été
 * écrit pour empêcher.
 */
function lignesRecap(
  locale: Locale,
  p: Payload,
  format: CanalRendezVous,
  c: Copie,
): readonly LigneRecap[] {
  const lignes: LigneRecap[] = [];

  const quand = quandTexte(locale, p);
  if (quand) lignes.push({ libelle: c.recapQuand, valeur: quand, precision: c.recapFuseau });

  const duree = dureeTexte(p);
  if (duree) lignes.push({ libelle: c.recapDuree, valeur: duree });

  const lieu = texteOuNull(p.lieu);

  if (format === "visio") {
    lignes.push({
      libelle: c.recapFormat,
      valeur: c.recapVisio,
      precision:
        lieu && estUnLienDeReunion(lieu) ? (
          // Le lien doit être CLIQUABLE : une URL posée dans un `<Text>` reste
          // du texte, que beaucoup de clients ne transforment pas. Un prospect
          // qui devrait recopier un lien Meet à la main, à l'heure du
          // rendez-vous, ne le fait pas — il ne vient pas.
          <Link href={lieu} style={{ color: emailStyles.COLORS.accent }}>
            {lieu}
          </Link>
        ) : (
          // Calendly crée la conférence de façon ASYNCHRONE : la confirmation
          // part environ une minute après la réservation (mesuré le
          // 2026-09-01), et le lien peut n'être pas prêt. On renvoie alors vers
          // l'invitation d'agenda, qui le portera — se taire laisserait le
          // prospect sans aucune instruction de connexion.
          c.lieuVisioSansLien
        ),
    });
    return lignes;
  }

  if (format === "telephone" && lieu) {
    lignes.push({
      libelle: c.recapFormat,
      valeur: c.recapTelephone,
      precision: c.lieuTelephone(lieu),
    });
    return lignes;
  }

  // Un lieu libre — « chez le client », saisi en console — se mentionne sans
  // affirmer de canal. Et un rendez-vous sans lieu du tout se TAIT : c'est
  // l'invitation Calendly qui fait foi, et inventer serait pire que le silence.
  if (lieu) lignes.push({ libelle: c.recapLieu, valeur: lieu });
  return lignes;
}

/**
 * Le bloc encadré qui répond en un coup d'œil : quand, combien de temps,
 * comment. Confirmation seulement — voir la note « famille C » en tête.
 *
 * Rend `null` quand il n'y a rien de sûr à afficher : un cadre vide dirait au
 * lecteur qu'une information a été perdue, ce qui est pire que son absence.
 */
function RecapRendezVous({
  locale,
  p,
  format,
  c,
}: {
  locale: Locale;
  p: Payload;
  format: CanalRendezVous;
  c: Copie;
}) {
  const lignes = lignesRecap(locale, p, format, c);
  if (lignes.length === 0) return null;

  return (
    <Section style={carteRecap}>
      <Text style={surtitreRecap}>{c.recapTitre}</Text>
      {lignes.map((ligne, i) => (
        // Filet de séparation plutôt qu'un simple espace : à trois entrées,
        // l'œil doit pouvoir sauter directement à la bonne sans relire.
        <Section key={ligne.libelle} style={i === 0 ? undefined : entreeSuivante}>
          <Text style={libelleRecap}>{ligne.libelle}</Text>
          <Text style={valeurRecap}>{ligne.valeur}</Text>
          {ligne.precision ? <Text style={precisionRecap}>{ligne.precision}</Text> : null}
        </Section>
      ))}
    </Section>
  );
}

/**
 * La ligne qui dit OÙ se tient le rendez-vous — J-1 et H-1 seulement.
 *
 * 🔑 Un composant, et non une chaîne, parce que le lien doit être cliquable :
 * une URL posée dans un `<Text>` reste du texte, et beaucoup de clients ne la
 * détectent pas.
 *
 * ⚠️ La confirmation ne passe PLUS par ici : elle rend la même information dans
 * `RecapRendezVous`. Les deux partagent les mêmes chaînes (`COMMUN`), le même
 * test d'URL (`estUnLienDeReunion`) et la même dérivation de canal — seule la
 * mise en page diffère, ce qui est le seul écart qu'on puisse tenir sans
 * risquer deux vérités sur le canal.
 */
function LigneLieu({
  lieu,
  format,
  c,
}: {
  lieu: string | undefined;
  format: CanalRendezVous;
  c: Copie;
}) {
  const valeur = (lieu ?? "").trim();

  if (format === "visio") {
    return estUnLienDeReunion(valeur) ? (
      <Text style={emailStyles.paragraphStyle}>
        {c.lieuVisio} <Link href={valeur}>{valeur}</Link>
      </Text>
    ) : (
      <Text style={emailStyles.paragraphStyle}>{c.lieuVisioSansLien}</Text>
    );
  }

  // Hors visio, une absence de lieu se tait : l'invitation Calendly fait foi,
  // et inventer une phrase serait pire que le silence.
  if (valeur === "") return null;

  return (
    <Text style={emailStyles.paragraphStyle}>
      {format === "telephone" ? c.lieuTelephone(valeur) : c.lieuIndetermine(valeur)}
    </Text>
  );
}

/**
 * Les liens d'annulation et de report.
 *
 * 🔑 VISIBLES, ET SECONDAIRES — les deux à la fois, et l'ordre des deux mots
 * compte. Visibles, parce qu'une personne empêchée qui ne trouve pas de bouton
 * ne fait rien : elle ne prévient pas, elle ne vient pas, et le créneau reste
 * bloqué jusqu'à l'heure. Secondaires, parce que l'action attendue d'une
 * confirmation est de ne rien faire : un bouton plein « Annuler » au milieu du
 * message suggérerait le contraire, et c'est le prospect hésitant qu'il
 * ferait basculer.
 *
 * ⚠️ AUCUN LIEN N'EST AJOUTÉ ICI : ce bloc réemploie `cancelUrl` et
 * `rescheduleUrl`, déjà comptés. Le budget de famille B est saturé (voir
 * l'en-tête du fichier) — y glisser une troisième adresse ferait rougir
 * `familles-email.spec.tsx`, ce qui est le comportement voulu.
 */
function ActionsSecondaires({ p, c, encadre }: { p: Payload; c: Copie; encadre: boolean }) {
  if (!p.cancelUrl && !p.rescheduleUrl) return null;
  const corps = (
    <Text style={encadre ? texteSecondaire : { ...texteSecondaire, margin: "14px 0" }}>
      {c.empeche}{" "}
      {p.rescheduleUrl ? (
        <Link href={p.rescheduleUrl} style={lienSecondaire}>
          {c.reporter}
        </Link>
      ) : null}
      {p.rescheduleUrl && p.cancelUrl ? c.ou : null}
      {p.cancelUrl ? (
        <Link href={p.cancelUrl} style={lienSecondaire}>
          {c.annuler}
        </Link>
      ) : null}
      .
    </Text>
  );
  // Le filet n'a de sens qu'après un corps structuré (confirmation). À J-1 et
  // H-1, où le message tient en trois lignes, il découperait un bloc de rien.
  return encadre ? <Section style={blocSecondaire}>{corps}</Section> : corps;
}

/**
 * « Ce qui se passe maintenant » — le bloc anti-abandon.
 *
 * 🔴 CE N'EST PAS DE LA COURTOISIE. Le prospect va recevoir, dans l'ordre :
 * cette confirmation, une invitation d'agenda Calendly qu'on ne peut pas
 * désactiver, un rappel J-1 et un rappel H-1. Sans cette annonce, chacun de ces
 * messages arrive comme une anomalie — « pourquoi deux invitations ? », « est-ce
 * que ma réservation a bugué ? » — et sur un rendez-vous non payant, le doute
 * ne produit pas un e-mail de question : il produit une absence.
 *
 * Puces en `<Section>` + `<Text>` plutôt qu'en `<ul>` : la puce native est
 * indentée différemment d'un client à l'autre, et Outlook y perd l'interlignage.
 * Le point est écrit à la main, en terracotta.
 */
function CeQuiSePasseMaintenant({ c }: { c: Copie }) {
  return (
    <Section style={{ margin: "26px 0 0 0" }}>
      <Text style={titreBloc}>{c.maintenantTitre}</Text>
      {c.maintenantPuces.map((puce) => (
        <Text key={puce} style={puceTexte}>
          <span style={pucePoint}>•</span> {puce}
        </Text>
      ))}
    </Section>
  );
}

export function AppelRappelEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const c = COMMUN[locale];
  const m = momentDe(p);
  // 🔑 UNE SEULE dérivation du canal pour tout le rendu, quelle que soit la
  // branche. La calculer dans chaque bloc rouvrirait la porte au défaut que
  // `le-rappel-nomme-le-bon-canal.spec.tsx` verrouille : deux endroits qui
  // décident du canal, et un e-mail qui promet un appel à qui attend un lien.
  const format = formatDuRendezVous(p);
  const duree = dureeTexte(p);

  // ── Famille B — la confirmation ────────────────────────────────────────────
  if (m === "confirmation") {
    const t = COPY[locale].confirmation;
    return (
      <EmailLayout
        famille="B"
        preview={t.preview(duree)}
        eyebrow={t.eyebrow}
        title={t.title}
        locale={locale}
      >
        {/* 🔑 LE RÉCAPITULATIF EN PREMIER, avant même la salutation. C'est ce
            que les résumés d'Apple Intelligence / Gemini / Copilot affichent
            dans la liste de la boîte de réception, et c'est la seule chose que
            le destinataire cherche en ouvrant. Un « Bonjour Jean, » en tête
            consommait ce résumé pour ne rien dire (§3.6). */}
        <RecapRendezVous locale={locale} p={p} format={format} c={c} />

        {/* La salutation vient APRÈS l'information, mais elle a désormais son
            propre paragraphe : elle était jusqu'ici collée en tête d'un
            paragraphe fourre-tout, entre l'horaire et l'invitation d'agenda, où
            elle ne saluait plus personne. */}
        <Text style={emailStyles.paragraphStyle}>
          {c.intro(p.prenom)}
          <br />
          {c.deroule}
        </Text>

        <CeQuiSePasseMaintenant c={c} />
        <ActionsSecondaires p={p} c={c} encadre />
        <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
      </EmailLayout>
    );
  }

  // ── Famille C — les rappels J-1 et H-1 ─────────────────────────────────────
  //
  // ⚠️ SOBRES À DESSEIN (§7.5). Le rappel H-1 « augmente le taux de présence de
  // 20 à 30 % », mais seulement s'il se lit en deux secondes : le récapitulatif
  // et le bloc « ce qui se passe maintenant » y coûteraient de la surface pour
  // une information déjà lue à la confirmation. Ne pas les propager ici.
  const t = COPY[locale][m === "j1" ? "j1" : "h1"];
  const heure = texteOuNull(p.heure) ?? (locale === "fr" ? "l'heure prévue" : "the agreed time");
  return (
    <EmailLayout famille="C" preview={t.preview(duree)} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.quand(heure, duree)}</Text>
      <LigneLieu lieu={p.lieu} format={format} c={c} />
      <Text style={emailStyles.paragraphStyle}>
        {c.intro(p.prenom)}
        <br />
        {c.attendu}
      </Text>
      <ActionsSecondaires p={p} c={c} encadre={false} />
      <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
    </EmailLayout>
  );
}
