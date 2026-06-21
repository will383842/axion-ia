// Stubs minimaux pour les templates emails introduits Sprint X.3 + X.7 + X.12.
//
// Ces stubs satisfont le typage `TemplateMap` (subject + component) pour que
// le routeur fonctionne dès maintenant. Le contenu HTML/copy définitif est
// livré Sprint X.13 (~20 templates) avec FR + EN distincts + design system
// complet (logo, hero, CTA terracotta, footer RGPD).
//
// V1 transitoire : chaque stub rend un email texte simple qui passe les anti-
// spam filters (Resend / Mailwizz / Zoho) — pas de mise en page riche mais
// fonctionnellement déclenchable par les Server Actions et crons BullMQ.

import type { ReactElement } from "react";
import type { Locale } from "../../../../prisma/generated/client";
import { EmailLayout } from "./_layout";

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function makeStub(
  subjectFr: string,
  subjectEn: string,
  introFr: string,
  introEn: string,
  detailsFn?: (p: Record<string, unknown>, locale: Locale) => ReactElement[],
): {
  subject: (locale: Locale, p: Record<string, unknown>) => string;
  component: (props: Props) => ReactElement;
} {
  return {
    subject: (locale) => (locale === "en" ? subjectEn : subjectFr),
    component: ({ locale, payload }) => {
      const lcl: "fr" | "en" = locale === "en" ? "en" : "fr";
      const isEn = lcl === "en";
      const intro = isEn ? introEn : introFr;
      const detailsEls = detailsFn ? detailsFn(payload, locale) : [];
      const contactName = typeof payload["contactName"] === "string" ? payload["contactName"] : "";
      const greeting = contactName
        ? isEn
          ? `Hello ${contactName},`
          : `Bonjour ${contactName},`
        : isEn
          ? "Hello,"
          : "Bonjour,";
      const title = isEn ? subjectEn : subjectFr;
      return (
        <EmailLayout locale={lcl} preview={intro.slice(0, 90)} title={title}>
          <p>{greeting}</p>
          <p>{intro}</p>
          {detailsEls}
          <p style={{ marginTop: 24 }}>
            {isEn ? "Best regards, the Axion-IA team." : "Cordialement, l'équipe Axion-IA."}
          </p>
        </EmailLayout>
      );
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Contract lifecycle — refondus en templates pleins (./contract-*.tsx, P1).
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// Cadrage reminders (Sprint X.12)
// ────────────────────────────────────────────────────────────────────

export const cadrageJ1Reminder = makeStub(
  "Rappel : votre cadrage Axion-IA demain",
  "Reminder: your Axion-IA scoping call tomorrow",
  "Pour rappel, votre call de cadrage est prévu demain. Pensez à préparer vos questions et le contexte business pertinent.",
  "Friendly reminder: your scoping call is scheduled for tomorrow. Please prepare your questions and any relevant business context.",
);

export const cadrageH2Reminder = makeStub(
  "Cadrage Axion-IA dans 2 heures",
  "Axion-IA scoping call in 2 hours",
  "Votre call de cadrage commence dans 2 heures. Le lien de visioconférence vous a été envoyé dans la convocation initiale.",
  "Your scoping call starts in 2 hours. The video link was included in the initial invitation.",
);

// ────────────────────────────────────────────────────────────────────
// Payment reminders + installments + disputed-notice — refondus en templates
// pleins (./payment-*.tsx, ./installment-*.tsx, ./disputed-notice.tsx, P1).
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// Booking lifecycle (Sprint X.12 + X.13)
// ────────────────────────────────────────────────────────────────────

export const bookingRescheduledByAdmin = makeStub(
  "Modification de votre réservation Axion-IA",
  "Your Axion-IA booking has been rescheduled",
  "Nous avons dû modifier la date de votre intervention. Veuillez consulter la nouvelle date ci-dessous.",
  "We had to reschedule your engagement. Please find the new date below.",
  (p, locale) => {
    const isEn = locale === "en";
    const date = typeof p["newDate"] === "string" ? p["newDate"] : "";
    return date
      ? [
          <p key="newdate">
            <strong>{isEn ? "New date" : "Nouvelle date"} :</strong> {date}
          </p>,
        ]
      : [];
  },
);

export const bookingJ1Reminder = makeStub(
  "Rappel : votre intervention Axion-IA demain",
  "Reminder: your Axion-IA engagement tomorrow",
  "Votre intervention démarre demain. Notre équipe sera sur place / en visio aux horaires convenus.",
  "Your engagement starts tomorrow. Our team will be on-site / remote as agreed.",
);

export const bookingCompletedThanks = makeStub(
  "Merci pour votre confiance — Axion-IA",
  "Thank you for trusting Axion-IA",
  "Votre intervention est terminée. Merci de nous avoir fait confiance. Nous serions ravis d'avoir votre retour.",
  "Your engagement is complete. Thank you for trusting us. We'd love to hear your feedback.",
);

// ────────────────────────────────────────────────────────────────────
// Quote lifecycle (Sprint X.12)
// ────────────────────────────────────────────────────────────────────

export const quoteReminder = makeStub(
  "Rappel : votre devis Axion-IA en attente",
  "Reminder: your Axion-IA quote awaits decision",
  "Votre devis vous a été envoyé il y a quelques jours et reste valable. Pour toute question, répondez simplement.",
  "Your quote was sent a few days ago and remains valid. Feel free to reply with any question.",
);

export const quoteExpired = makeStub(
  "Votre devis Axion-IA a expiré",
  "Your Axion-IA quote has expired",
  "Votre devis a atteint sa date de validité et n'est plus valable. Contactez-nous si vous souhaitez le réémettre.",
  "Your quote has reached its validity date and is no longer valid. Reach out if you'd like us to reissue it.",
);
