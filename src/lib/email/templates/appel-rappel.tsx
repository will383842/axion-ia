// Email — rappel une heure avant l'appel de découverte.
//
// ## Pourquoi ce gabarit existe
//
// Avant lui, une personne qui réservait un appel ne recevait de nous
// **strictement rien** : ni confirmation, ni rappel. Son seul signal était une
// invitation d'agenda émise par Google au nom du compte connecté à Calendly —
// que Gmail flanque d'un « expéditeur inconnu · Signaler comme spam ».
//
// Les rappels de Calendly relèvent des Workflows, une fonctionnalité payante.
// Celui-ci est le nôtre, et il part de `noreply@axion-ia.com`.
//
// ## 🔴 CE GABARIT NE CONFIRME PAS — IL RAPPELLE
//
// Décision assumée : on N'AJOUTE PAS de confirmation à la réservation. Calendly
// en envoie déjà une (l'invitation d'agenda), et en doubler une seconde ne
// rendrait pas la première moins mauvaise — cela ferait deux messages pour un
// rendez-vous. Ce qui manquait vraiment, c'est le rappel : Calendly gratuit n'en
// envoie aucun, et un appel réservé trois semaines à l'avance s'oublie.
//
// ⚠️ Corollaire : ce message est le PREMIER que la personne reçoive de nous. Il
// se présente donc, au lieu de supposer qu'on se connaît.
//
// ## Ce qu'il porte, et pourquoi
//
// Le lien d'annulation et celui de report sont là à dessein. Un rappel qui ne
// permet pas de se décommander produit des absences plutôt que des reports :
// une personne qui ne peut plus, et qui n'a pas de bouton, ne fait rien.

import { Text, Link } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom, ou nom complet si c'est tout ce que Calendly a transmis. */
  prenom: string;
  /** Heure de début, déjà formatée par l'appelant, en heure de Paris. */
  heure: string;
  /** Durée réelle du rendez-vous, en minutes, telle que Calendly la connaît. */
  dureeMinutes: number;
  /** Le numéro que le consultant appellera, ou le lieu du rendez-vous. */
  lieu?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
}

export const appelRappelSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const p = payload as unknown as Payload;
  return locale === "fr"
    ? `Votre appel avec Axion-IA à ${p.heure ?? "tout à l'heure"}`
    : `Your call with Axion-IA at ${p.heure ?? "shortly"}`;
};

const COPY = {
  fr: {
    preview: "Votre appel avec Axion-IA a lieu dans une heure",
    title: "Votre appel a lieu dans une heure",
    intro: (n: string) => `Bonjour ${n},`,
    quand: (h: string, d: number) =>
      `Petit rappel : nous nous appelons à ${h} (heure de Paris), pour ${d} minutes.`,
    lieu: (l: string) => `Nous vous appellerons au ${l}.`,
    // On dit ce qu'on va faire, pas ce qu'on attend. La personne n'a rien à préparer.
    attendu:
      "Rien à préparer de votre côté. On vous écoute, on répond à vos questions, et vous repartez avec un avis clair — même si la réponse est « ce n'est pas pour vous ».",
    empeche: "Un imprévu ?",
    annuler: "Annuler",
    reporter: "Choisir un autre créneau",
    ou: " ou ",
    signature: "À tout à l'heure,\nL'équipe Axion-IA",
  },
  en: {
    preview: "Your call with Axion-IA is in one hour",
    title: "Your call is in one hour",
    intro: (n: string) => `Hello ${n},`,
    quand: (h: string, d: number) =>
      `A quick reminder: we speak at ${h} (Paris time), for ${d} minutes.`,
    lieu: (l: string) => `We will call you on ${l}.`,
    attendu:
      "Nothing to prepare on your side. We listen, we answer your questions, and you leave with a clear view — even if the answer is “this isn't for you”.",
    empeche: "Something came up?",
    annuler: "Cancel",
    reporter: "Pick another slot",
    ou: " or ",
    signature: "Talk soon,\nThe Axion-IA team",
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
  const t = COPY[locale];
  return (
    <EmailLayout preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.quand(p.heure, p.dureeMinutes)}</Text>
      {p.lieu ? <Text style={emailStyles.paragraphStyle}>{t.lieu(p.lieu)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{t.attendu}</Text>
      {p.cancelUrl || p.rescheduleUrl ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.empeche} {p.rescheduleUrl ? <Link href={p.rescheduleUrl}>{t.reporter}</Link> : null}
          {p.rescheduleUrl && p.cancelUrl ? t.ou : null}
          {p.cancelUrl ? <Link href={p.cancelUrl}>{t.annuler}</Link> : null}.
        </Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
    </EmailLayout>
  );
}
