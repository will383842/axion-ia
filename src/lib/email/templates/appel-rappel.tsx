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
// ## Un seul gabarit pour trois moments, et pourquoi
//
// Les trois messages partagent le lieu, la durée, la signature et surtout **les
// liens d'annulation et de report**. Trois fichiers auraient signifié trois
// endroits où corriger ces liens — et c'est toujours celui qu'on oublie qui
// part. Seuls changent le titre, la phrase d'horaire et l'objet ; ils vivent
// dans `COPY[locale][moment]`.
//
// ## Ce qu'il porte, et pourquoi
//
// Le lien d'annulation et celui de report sont là à dessein, aux trois moments.
// Un message qui ne permet pas de se décommander produit des absences plutôt
// que des reports : une personne qui ne peut plus, et qui n'a pas de bouton, ne
// fait rien.

import { Text, Link } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

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
  cancelUrl?: string;
  rescheduleUrl?: string;
  moment?: MomentAppel;
}

const momentDe = (p: { moment?: MomentAppel }): MomentAppel => p.moment ?? "h1";

export const appelRappelSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const p = payload as unknown as Payload;
  const m = momentDe(p);
  if (locale === "fr") {
    if (m === "confirmation")
      return p.date
        ? `C'est confirmé : votre appel avec Axion-IA le ${p.date} à ${p.heure}`
        : `C'est confirmé : votre appel avec Axion-IA`;
    if (m === "j1") return `Votre appel avec Axion-IA, demain à ${p.heure ?? "l'heure prévue"}`;
    return `Votre appel avec Axion-IA à ${p.heure ?? "tout à l'heure"}`;
  }
  if (m === "confirmation")
    return p.date
      ? `Confirmed: your call with Axion-IA on ${p.date} at ${p.heure}`
      : `Confirmed: your call with Axion-IA`;
  if (m === "j1") return `Your call with Axion-IA, tomorrow at ${p.heure ?? "the agreed time"}`;
  return `Your call with Axion-IA at ${p.heure ?? "shortly"}`;
};

/** Ce qui ne dépend PAS du moment : lieu, attente, liens, signature. */
const COMMUN = {
  fr: {
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    lieu: (l: string) => `Nous vous appellerons au ${l}.`,
    // On dit ce qu'on va faire, pas ce qu'on attend. La personne n'a rien à préparer.
    attendu:
      "Rien à préparer de votre côté. On vous écoute, on répond à vos questions, et vous repartez avec un avis clair — même si la réponse est « ce n'est pas pour vous ».",
    // 🔴 Calendly envoie TOUJOURS son invitation d'agenda : sur la formule
    // gratuite, ce message n'est pas désactivable (vérifié par Will le
    // 2026-08-28, panneau « Calendar invitation » : « Upgrade to Standard »).
    // Le prospect reçoit donc deux messages à la réservation. Cette ligne les
    // articule au lieu de faire comme si l'autre n'existait pas — c'est ce qui
    // retire la sensation de doublon.
    invitationAgenda: "L'invitation d'agenda vous parvient séparément, par Calendly.",
    empeche: "Un imprévu ?",
    annuler: "Annuler",
    reporter: "Choisir un autre créneau",
    ou: " ou ",
  },
  en: {
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    lieu: (l: string) => `We will call you on ${l}.`,
    attendu:
      "Nothing to prepare on your side. We listen, we answer your questions, and you leave with a clear view — even if the answer is “this isn't for you”.",
    invitationAgenda: "Your calendar invitation arrives separately, from Calendly.",
    empeche: "Something came up?",
    annuler: "Cancel",
    reporter: "Pick another slot",
    ou: " or ",
  },
} as const;

/** Ce qui change d'un moment à l'autre : le titre, l'horaire, la signature. */
const COPY = {
  fr: {
    confirmation: {
      preview: "Votre appel avec Axion-IA est confirmé",
      title: "C'est confirmé",
      quand: (h: string, d: number, date?: string) =>
        date
          ? `Nous nous appelons le ${date} à ${h} (heure de Paris), pour ${d} minutes.`
          : `Nous nous appelons à ${h} (heure de Paris), pour ${d} minutes.`,
      signature: "À très vite,\nL'équipe Axion-IA",
    },
    j1: {
      preview: "Votre appel avec Axion-IA a lieu demain",
      title: "Votre appel a lieu demain",
      quand: (h: string, d: number) =>
        `Petit rappel : nous nous appelons demain à ${h} (heure de Paris), pour ${d} minutes.`,
      signature: "À demain,\nL'équipe Axion-IA",
    },
    h1: {
      preview: "Votre appel avec Axion-IA a lieu dans une heure",
      title: "Votre appel a lieu dans une heure",
      quand: (h: string, d: number) =>
        `Petit rappel : nous nous appelons à ${h} (heure de Paris), pour ${d} minutes.`,
      signature: "À tout à l'heure,\nL'équipe Axion-IA",
    },
  },
  en: {
    confirmation: {
      preview: "Your call with Axion-IA is confirmed",
      title: "You're all set",
      quand: (h: string, d: number, date?: string) =>
        date
          ? `We speak on ${date} at ${h} (Paris time), for ${d} minutes.`
          : `We speak at ${h} (Paris time), for ${d} minutes.`,
      signature: "Talk soon,\nThe Axion-IA team",
    },
    j1: {
      preview: "Your call with Axion-IA is tomorrow",
      title: "Your call is tomorrow",
      quand: (h: string, d: number) =>
        `A quick reminder: we speak tomorrow at ${h} (Paris time), for ${d} minutes.`,
      signature: "Talk tomorrow,\nThe Axion-IA team",
    },
    h1: {
      preview: "Your call with Axion-IA is in one hour",
      title: "Your call is in one hour",
      quand: (h: string, d: number) =>
        `A quick reminder: we speak at ${h} (Paris time), for ${d} minutes.`,
      signature: "Talk soon,\nThe Axion-IA team",
    },
  },
} as const;

export function AppelRappelEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const c = COMMUN[locale];
  const t = COPY[locale][momentDe(p)];
  return (
    <EmailLayout preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{c.intro(p.prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.quand(p.heure, p.dureeMinutes, p.date)}</Text>
      {p.lieu ? <Text style={emailStyles.paragraphStyle}>{c.lieu(p.lieu)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{c.attendu}</Text>
      {momentDe(p) === "confirmation" ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {c.invitationAgenda}
        </Text>
      ) : null}
      {p.cancelUrl || p.rescheduleUrl ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {c.empeche} {p.rescheduleUrl ? <Link href={p.rescheduleUrl}>{c.reporter}</Link> : null}
          {p.rescheduleUrl && p.cancelUrl ? c.ou : null}
          {p.cancelUrl ? <Link href={p.cancelUrl}>{c.annuler}</Link> : null}.
        </Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
    </EmailLayout>
  );
}
