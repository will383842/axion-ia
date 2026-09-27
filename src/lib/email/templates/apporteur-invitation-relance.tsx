// E-mail — RAPPEL de l'invitation à l'échange de 15 minutes, J+3 puis J+7
// (décision de Will du 2026-09-27).
//
// La personne a candidaté au réseau d'apporteurs d'affaires, Will a retenu sa
// candidature et lui a envoyé l'invitation (`apporteur-invitation-appel`) ;
// elle n'a pas réservé. Deux rappels, pas plus, et le second le dit. Ils ne
// partent JAMAIS si elle a réservé (même annulé), si on lui a répondu, si sa
// fiche est archivée, classée sans suite ou effacée — la règle et ses gardes
// vivent dans `features/commercial-application/relances-invitation-apporteur.ts`.
//
// Même châssis que l'invitation : famille B (lien d'opposition dans le pied de
// page), tutoiement, sans rangée sociale (le kit coûte deux liens, cf.
// `_kit-apporteur.tsx`). Le bouton porte le lien de réservation Calendly.
//
// Vocabulaire (anti-requalification, `docs/partners/ANTI-REQUALIFICATION.md`) :
// « échange », « candidature retenue » ; jamais « entretien », « poste »,
// « recrutement », « commercial », « vendre ».

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  /** Lien de réservation Calendly (`CALENDLY_APPORTEUR_URL`, validé au passage : https, calendly.com). */
  calendlyUrl: string;
  /** `j3` (premier rappel) ou `j7` (dernier). Toute autre valeur rend le premier. */
  etape?: string;
}

export const COPY_RELANCE_INVITATION = {
  fr: {
    subject: (dernier: boolean) =>
      dernier
        ? "Dernier rappel : ta candidature apporteur"
        : "Ton échange apporteur d'affaires t'attend",
    title: (dernier: boolean) => (dernier ? "Dernier rappel" : "Ton créneau t'attend"),
    preview: (dernier: boolean) =>
      dernier
        ? "Notre dernier message à ce sujet : l'échange de 15 minutes en visio reste ouvert."
        : "Ta candidature est retenue : il ne reste qu'à choisir le moment de notre échange de 15 minutes.",
    j3: (n: string) =>
      `${n ? `Bonjour ${n}, ta` : "Bonjour, ta"} candidature au réseau d'apporteurs d'affaires d'Axion-IA est retenue, et il ne te reste plus qu'à choisir le moment de notre échange de 15 minutes en visio. Les créneaux sont limités : réserve le tien en un clic avec le bouton ci-dessous.`,
    j7: (n: string) =>
      `${n ? `Bonjour ${n}, c'est` : "Bonjour, c'est"} notre dernier message à ce sujet : ta candidature est toujours retenue, et l'échange de 15 minutes en visio reste ouvert si tu veux découvrir le réseau. Si ce n'est pas le bon moment, aucun souci : sans réservation de ta part, on ne te relancera plus.`,
    kit: "Pour rappel, les documents pour préparer l'échange :",
    desinscription:
      "Si tu ne souhaites plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message.",
    cta: "Réserver mon créneau",
  },
  en: {
    subject: (dernier: boolean) =>
      dernier
        ? "Last reminder: your introducer application"
        : "Your business introducer call awaits",
    title: (dernier: boolean) => (dernier ? "Last reminder" : "Your slot is waiting"),
    preview: (dernier: boolean) =>
      dernier
        ? "Our last message on the subject: the 15-minute video call remains open."
        : "Your application has been selected: all that is left is to pick the time of our 15-minute call.",
    j3: (n: string) =>
      `${n ? `Hello ${n}, your` : "Hello, your"} application to Axion-IA's business introducer network has been selected, and all that is left is to choose the time of our 15-minute video call. Slots are limited: book yours in one click with the button below.`,
    j7: (n: string) =>
      `${n ? `Hello ${n}, this` : "Hello, this"} is our last message on the subject: your application is still selected, and the 15-minute video call remains open if you would like to discover the network. If now is not the right time, no problem: without a booking from you, we will not remind you again.`,
    kit: "As a reminder, the documents to prepare for the call:",
    desinscription:
      "If you no longer wish to hear from us, one click is enough: the link is at the bottom of this message.",
    cta: "Book my slot",
  },
} as const;

function estDernier(p: Record<string, unknown>): boolean {
  return p["etape"] === "j7";
}

export const apporteurInvitationRelanceSubject = (
  locale: Locale,
  p: Record<string, unknown>,
): string => COPY_RELANCE_INVITATION[locale === "fr" ? "fr" : "en"].subject(estDernier(p));

export function ApporteurInvitationRelanceEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY_RELANCE_INVITATION[locale === "fr" ? "fr" : "en"];
  const dernier = estDernier(payload);
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  return (
    <EmailLayout
      famille="B"
      preview={t.preview(dernier)}
      title={t.title(dernier)}
      cta={{ label: t.cta, href: p.calendlyUrl }}
      locale={locale}
      tutoiement
      sansReseauxSociaux
    >
      <Text style={emailStyles.paragraphStyle}>{dernier ? t.j7(prenom) : t.j3(prenom)}</Text>
      <BlocKitApporteur locale={locale === "fr" ? "fr" : "en"} intro={t.kit} />
      <Text style={emailStyles.paragraphStyle}>{t.desinscription}</Text>
    </EmailLayout>
  );
}
