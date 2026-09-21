// E-mail — l'échange de 15 minutes avec un candidat apporteur : confirmation,
// rappel la veille, rappel une heure avant (2026-09-21).
//
// ── Le trou que ce gabarit ferme ──────────────────────────────────────────
// Un CLIENT qui réserve un appel reçoit trois messages sur notre charte
// (`appel-rappel.tsx`) : confirmation, J-1, H-1. Un candidat apporteur, lui,
// ne recevait RIEN.
//
// 🔴 Et la raison écrite dans le code était FAUSSE. `rappels-appel.ts`
// justifiait le silence par « Calendly envoie sa propre confirmation ».
// Réglages relevés dans le compte le 2026-09-21, sur les DEUX event-types :
//   · Invitation dans le calendrier .... activée
//   · Rappels par e-mail ............... Off
//   · Suivis par e-mail ................ Off
//   · Workflows ........................ aucun
// Calendly envoie donc une INVITATION D'AGENDA, pas une confirmation. Le
// candidat ne recevait aucun e-mail de personne, et aucun rappel : quelqu'un
// qui réservait pour dans cinq jours n'avait plus de nouvelles jusqu'au jour J.
//
// ⚠️ Corollaire utile : rien n'est à désactiver côté Calendly avant de livrer
// ces trois messages. Il n'y a AUCUN doublon à craindre.
//
// ── Pourquoi un gabarit à part, et pas une variante du client ─────────────
// Les e-mails clients disent « votre appel de découverte » et vouvoient. Les
// réutiliser en levant simplement l'exclusion ferait dire au candidat qu'il est
// un prospect — exactement le vocabulaire que le tunnel vient de retirer
// (`le-tunnel-apporteur-ne-dit-jamais-agent-commercial`). Le CANAL, lui, est
// mutualisé : `rappels-appel.ts` porte les trois horloges, l'idempotence et le
// plafond pour les deux publics.
//
// Famille B, sans la rangée sociale : même arbitrage que les quatre autres
// e-mails du réseau (§5.4 — le budget de liens cède sur la notoriété, jamais
// sur l'action ni sur une mention exigée par la loi).
//
// Tutoiement : c'est la langue de tout le tunnel apporteur.

import { Link, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";

type Locale = "fr" | "en";

/** Les trois moments, repris tels quels de la mécanique client. */
export type MomentEchange = "confirmation" | "j1" | "h1";

interface Payload {
  /** Prénom, ou nom complet si c'est tout ce que Calendly a transmis. */
  prenom?: string;
  /** Heure de début, déjà formatée par l'appelant, en heure de Paris. */
  heure?: string;
  /** Date de début, formatée par l'appelant. Citée par la CONFIRMATION seule. */
  date?: string;
  /** Durée réelle, dérivée des deux bornes — jamais un chiffre écrit à la main. */
  dureeMinutes?: number;
  /** Le lien de la visioconférence, quand Calendly l'a déjà créé. */
  lieu?: string;
  moment?: MomentEchange;
}

const momentDe = (p: { moment?: MomentEchange }): MomentEchange => p.moment ?? "h1";

/** Une chaîne non vide, ou `null`. Aucune branche ne doit rendre « undefined ». */
const texteOuNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * « mardi 23 septembre à 11:30 », ou l'une des deux moitiés, ou rien.
 *
 * 🔴 CHAQUE MORCEAU EST FACULTATIF, ET LE RIEN EST UNE RÉPONSE. La charge
 * transite par une file : rien ne garantit que `date` et `heure` soient là au
 * rendu. L'interpolation naïve produit « le undefined à undefined » — le pire
 * des cas, parce qu'il ne lève pas : il part. Même règle que le gabarit client.
 */
function quandTexte(locale: Locale, p: Payload, avecDate: boolean): string | null {
  const date = avecDate ? texteOuNull(p.date) : null;
  const heure = texteOuNull(p.heure);
  if (date && heure) return locale === "fr" ? date + " à " + heure : date + " at " + heure;
  if (heure) return locale === "fr" ? "à " + heure : "at " + heure;
  return date;
}

const COPY = {
  fr: {
    confirmation: {
      title: "C'est noté, on se parle bientôt",
      preview: "Ton échange est confirmé. Le lien de connexion arrive avec l'invitation d'agenda.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Ton échange " +
            duree +
            " est confirmé, " +
            quand +
            ". On fait connaissance, on t'explique simplement comment ça marche, et tu poses toutes tes questions."
          : "Ton échange " +
            duree +
            " est confirmé. On fait connaissance, on t'explique simplement comment ça marche, et tu poses toutes tes questions.",
      apres: "Aucun engagement : tu décides après.",
    },
    j1: {
      title: "C'est demain",
      preview: "Petit rappel : notre échange, c'est demain.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Rappel : notre échange " + duree + " a lieu demain, " + quand + "."
          : "Rappel : notre échange " + duree + " a lieu demain.",
      apres: null,
    },
    h1: {
      title: "Dans une heure",
      preview: "Notre échange commence dans une heure.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Notre échange " + duree + " commence dans une heure, " + quand + "."
          : "Notre échange " + duree + " commence dans une heure.",
      apres: null,
    },
    duree: (m?: number) =>
      typeof m === "number" && m > 0 ? "de " + String(m) + " minutes" : "de 15 minutes",
    lienTitre: "Le lien de connexion : ",
    lienAbsent:
      "Le lien de la visioconférence se trouve dans l'invitation d'agenda reçue à la réservation.",
    replanifier: "Besoin de décaler ? Tu peux replanifier ou annuler depuis l'invitation d'agenda.",
    question: "Une question d'ici là ? Réponds simplement à cet e-mail.",
    intro: (n: string | null) => (n ? "Bonjour " + n + "," : "Bonjour,"),
  },
  en: {
    confirmation: {
      title: "All set, talk soon",
      preview: "Your call is confirmed. The joining link comes with the calendar invitation.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Your " +
            duree +
            " call is confirmed, " +
            quand +
            ". We get to know each other, explain simply how it works, and you ask anything you like."
          : "Your " +
            duree +
            " call is confirmed. We get to know each other, explain simply how it works, and you ask anything you like.",
      apres: "No commitment: you decide afterwards.",
    },
    j1: {
      title: "It is tomorrow",
      preview: "A quick reminder: our call is tomorrow.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Reminder: our " + duree + " call is tomorrow, " + quand + "."
          : "Reminder: our " + duree + " call is tomorrow.",
      apres: null,
    },
    h1: {
      title: "In one hour",
      preview: "Our call starts in one hour.",
      corps: (quand: string | null, duree: string) =>
        quand
          ? "Our " + duree + " call starts in one hour, " + quand + "."
          : "Our " + duree + " call starts in one hour.",
      apres: null,
    },
    duree: (m?: number) =>
      typeof m === "number" && m > 0 ? String(m) + "-minute" : "15-minute",
    lienTitre: "The joining link: ",
    lienAbsent: "The video link is in the calendar invitation you received when you booked.",
    replanifier: "Need to move it? You can reschedule or cancel from the calendar invitation.",
    question: "A question in the meantime? Just reply to this email.",
    intro: (n: string | null) => (n ? "Hello " + n + "," : "Hello,"),
  },
} as const;

/**
 * L'objet du message.
 *
 * 🔑 Composé SEULEMENT s'il y a de quoi composer : sans horaire, « Demain à
 * undefined » serait un objet parfaitement conforme à la borne de longueur, et
 * parfaitement faux. La garde ne mesure que sa taille.
 */
export const apporteurEchangeSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const l: Locale = locale === "fr" ? "fr" : "en";
  const c = COPY[l];
  const m = momentDe(p);
  const heure = texteOuNull(p.heure);
  if (l === "fr") {
    if (m === "confirmation") {
      const quand = quandTexte("fr", p, true);
      return quand ? "Échange confirmé : " + quand : c.confirmation.title;
    }
    if (m === "j1") return heure ? "Rappel : notre échange demain à " + heure : c.j1.title;
    return heure ? "Notre échange dans une heure, à " + heure : c.h1.title;
  }
  if (m === "confirmation") {
    const quand = quandTexte("en", p, true);
    return quand ? "Call confirmed: " + quand : c.confirmation.title;
  }
  if (m === "j1") return heure ? "Reminder: our call tomorrow at " + heure : c.j1.title;
  return heure ? "Our call in one hour, at " + heure : c.h1.title;
};

export function ApporteurEchangeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}): ReactElement {
  const p = payload as unknown as Payload;
  const l: Locale = locale === "fr" ? "fr" : "en";
  const c = COPY[l];
  const bloc = c[momentDe(p)];
  const duree = c.duree(p.dureeMinutes);
  const quand = quandTexte(l, p, momentDe(p) === "confirmation");
  const lien = texteOuNull(p.lieu);
  const lienUtilisable = lien !== null && /^https?:\/\//i.test(lien);

  return (
    <EmailLayout
      famille="B"
      sansReseauxSociaux
      locale={l}
      tutoiement
      title={bloc.title}
      preview={bloc.preview}
    >
      <Text style={emailStyles.paragraph}>{c.intro(texteOuNull(p.prenom))}</Text>
      <Text style={emailStyles.paragraph}>{bloc.corps(quand, duree)}</Text>
      {bloc.apres ? <Text style={emailStyles.paragraph}>{bloc.apres}</Text> : null}

      {/*
        🔴 LE LIEN N'EST PAS TOUJOURS LÀ. Calendly crée la conférence de façon
        asynchrone, et elle peut ne jamais arriver — connexion agenda expirée,
        quota, panne. On ne rend donc JAMAIS un lien vide : on renvoie vers
        l'invitation d'agenda, qui le portera s'il finit par exister. Même
        doctrine que `rappels-appel.ts`, qui alerte à H-1 sur ce cas précis.
      */}
      <Section>
        <Text style={emailStyles.paragraph}>
          {lienUtilisable ? (
            <>
              {c.lienTitre}
              <Link href={lien}>{lien}</Link>
            </>
          ) : (
            c.lienAbsent
          )}
        </Text>
      </Section>

      <Text style={emailStyles.paragraph}>{c.replanifier}</Text>
      <Text style={emailStyles.paragraph}>{c.question}</Text>
    </EmailLayout>
  );
}
