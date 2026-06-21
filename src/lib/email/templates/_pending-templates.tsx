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
// Contract lifecycle (Sprint X.3 + X.12 reminders)
// ────────────────────────────────────────────────────────────────────

export const contractVersionUpdated = makeStub(
  "Mise à jour de votre contrat Axion-IA",
  "Update to your Axion-IA contract",
  "Une nouvelle version de votre contrat a été préparée. Vous pouvez la consulter via le lien DocuSeal envoyé séparément.",
  "A new version of your contract is ready. Please review it through the DocuSeal link sent separately.",
  (p, locale) => {
    const isEn = locale === "en";
    const reason = typeof p["reason"] === "string" ? p["reason"] : "";
    return reason
      ? [
          <p key="reason">
            <strong>{isEn ? "Reason" : "Motif"} :</strong> {reason}
          </p>,
        ]
      : [];
  },
);

export const contractSent = makeStub(
  "Votre contrat Axion-IA est prêt à signer",
  "Your Axion-IA contract is ready to sign",
  "Votre contrat est disponible à la signature électronique via DocuSeal. Vous recevrez sous peu un email dédié avec le lien de signature.",
  "Your contract is now available for electronic signature via DocuSeal. You'll shortly receive a dedicated email with the signing link.",
);

export const contractSigned = makeStub(
  "Contrat signé avec succès — Axion-IA",
  "Contract signed successfully — Axion-IA",
  "Merci ! Votre contrat est signé par les deux parties. Vous recevrez le PDF final dans quelques instants.",
  "Thank you! Your contract is now signed by both parties. You'll receive the final PDF shortly.",
);

export const contractRefused = makeStub(
  "Votre contrat Axion-IA — décision",
  "Your Axion-IA contract — outcome",
  "Nous avons pris note de votre décision concernant le contrat. Pour toute question, répondez simplement à cet email.",
  "We've recorded your decision regarding the contract. For any question, simply reply to this email.",
);

export const contractReminder = makeStub(
  "Rappel : votre contrat Axion-IA en attente de signature",
  "Reminder: your Axion-IA contract awaits signature",
  "Votre contrat n'a pas encore été signé. Le lien DocuSeal reste actif. Si vous rencontrez une difficulté, contactez-nous.",
  "Your contract hasn't been signed yet. The DocuSeal link is still active. If you face any issue, please reach out.",
);

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
// Payment reminders (Sprint X.12)
// ────────────────────────────────────────────────────────────────────

export const paymentReminderJ7 = makeStub(
  "Échéance Axion-IA dans 7 jours",
  "Axion-IA payment due in 7 days",
  "Pour information, le solde de votre intervention sera dû dans 7 jours. Vous recevrez la facture détaillée sous peu.",
  "Heads up: the balance for your engagement is due in 7 days. You'll receive the detailed invoice shortly.",
);

export const paymentOverdueJ1 = makeStub(
  "Paiement en retard — Axion-IA",
  "Payment overdue — Axion-IA",
  "Nous n'avons pas encore reçu votre règlement. Si le paiement a été émis, merci de nous transmettre la référence virement.",
  "We haven't received your payment yet. If it's been issued, please share the transfer reference.",
);

export const paymentOverdueJ15 = makeStub(
  "Relance ferme — Paiement Axion-IA en retard",
  "Firm reminder — Axion-IA payment overdue",
  "Votre paiement présente un retard de 15 jours. Merci de régulariser sous 48h pour éviter toute mesure de recouvrement.",
  "Your payment is now 15 days overdue. Please settle within 48 hours to avoid further recovery action.",
);

export const paymentOverdueJ30 = makeStub(
  "Dernière relance avant recouvrement — Axion-IA",
  "Final notice before recovery — Axion-IA",
  "Votre paiement présente un retard de 30 jours. Sans règlement sous 7 jours, votre dossier sera transmis à notre service recouvrement.",
  "Your payment is now 30 days overdue. Without settlement within 7 days, your file will be escalated to recovery.",
);

// ────────────────────────────────────────────────────────────────────
// Installment overdue (D59 / Sprint X.13)
// ────────────────────────────────────────────────────────────────────

export const installmentOverdueSoft = makeStub(
  "Échéance en attente — Axion-IA",
  "Installment pending — Axion-IA",
  "Une échéance de votre échéancier reste en attente de règlement. Merci d'effectuer le paiement dès que possible.",
  "An installment on your payment schedule is awaiting settlement. Please proceed at your earliest convenience.",
);

export const installmentOverdueFirm = makeStub(
  "Relance ferme — échéance Axion-IA",
  "Firm reminder — Axion-IA installment",
  "Votre échéance reste impayée. Sans régularisation rapide, l'ensemble du solde devient exigible immédiatement.",
  "Your installment remains unpaid. Without prompt settlement, the full balance becomes immediately due.",
);

// disputedNotice : refondu en template plein → ./disputed-notice.tsx (P1).

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
