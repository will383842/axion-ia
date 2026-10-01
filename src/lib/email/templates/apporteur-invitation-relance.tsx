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
// page), vouvoiement, sans rangée sociale (le kit coûte deux liens, cf.
// `_kit-apporteur.tsx`), signature du fondateur (§6.1, sans téléphone). Le
// bouton porte le lien de réservation Calendly.
//
// Vocabulaire (anti-requalification, `docs/partners/ANTI-REQUALIFICATION.md`) :
// « échange », « candidature retenue » ; jamais « entretien », « poste »,
// « recrutement », « commercial », « vendre ».
//
// ── Variante `offre` (2026-09-28) ─────────────────────────────────────────
// Une personne qui a postulé à une OFFRE D'EMPLOI salariée et à qui Will a
// proposé le réseau n'a JAMAIS candidaté au réseau : « votre candidature est
// retenue » serait faux. Ses rappels parlent de la proposition, et le dernier
// précise que sa candidature à l'offre n'est pas concernée. « offre » désigne
// l'offre d'emploi à laquelle elle a postulé, jamais l'activité d'apporteur.

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
  /** Titre de l'offre d'emploi (variante `offre`, cf. l'invitation). Présent, même vide : variante. */
  offreEmploi?: string;
}

export const COPY_RELANCE_INVITATION = {
  fr: {
    // ≤ 45 caractères (§3.4) : « d'affaires » ne tient plus au vouvoiement.
    subject: (dernier: boolean) =>
      dernier
        ? "Dernier rappel : votre candidature apporteur"
        : "Votre échange apporteur vous attend",
    title: (dernier: boolean) => (dernier ? "Dernier rappel" : "Votre créneau vous attend"),
    preview: (dernier: boolean) =>
      dernier
        ? "Notre dernier message à ce sujet : l'échange de 15 minutes en visio reste ouvert."
        : "Votre candidature est retenue : il ne reste qu'à choisir le moment de notre échange de 15 minutes.",
    j3: (n: string) =>
      `${n ? `Bonjour ${n}, votre` : "Bonjour, votre"} candidature au réseau d'apporteurs d'affaires d'Axion-IA est retenue, et il ne vous reste plus qu'à choisir le moment de notre échange de 15 minutes en visio. Les créneaux sont limités : réservez le vôtre en un clic avec le bouton ci-dessous.`,
    j7: (n: string) =>
      `${n ? `Bonjour ${n}, c'est` : "Bonjour, c'est"} notre dernier message à ce sujet : votre candidature est toujours retenue, et l'échange de 15 minutes en visio reste ouvert si vous souhaitez découvrir le réseau. Si ce n'est pas le bon moment, aucun souci : sans réservation de votre part, nous ne vous relancerons plus.`,
    kit: "Pour rappel, de quoi préparer l'échange :",
    desinscription:
      "Si vous ne souhaitez plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message.",
    cta: "Réserver mon créneau",
    // Variante `offre` (2026-09-28).
    subjectOffre: (dernier: boolean) =>
      dernier
        ? "Dernier rappel : l'échange sur le réseau"
        : "Votre échange sur le réseau vous attend",
    previewOffre: (dernier: boolean) =>
      dernier
        ? "Notre dernier message à ce sujet : l'échange de 15 minutes en visio reste ouvert."
        : "Il ne reste qu'à choisir le moment de notre échange de 15 minutes sur le réseau d'apporteurs d'affaires.",
    j3Offre: (n: string, o: string) =>
      `${n ? `Bonjour ${n}, suite` : "Bonjour, suite"} à votre candidature ${o ? `à notre offre « ${o} »` : "à l'une de nos offres d'emploi"}, nous vous avons proposé de découvrir aussi notre réseau d'apporteurs d'affaires indépendants. Si la proposition vous intéresse, il ne vous reste plus qu'à choisir le moment de notre échange de 15 minutes en visio, en un clic avec le bouton ci-dessous.`,
    j7Offre: (n: string, o: string) =>
      `${n ? `Bonjour ${n}, c'est` : "Bonjour, c'est"} notre dernier message au sujet du réseau d'apporteurs d'affaires : l'échange de 15 minutes en visio reste ouvert si vous souhaitez le découvrir. Si ce n'est pas le bon moment, aucun souci : sans réservation de votre part, nous ne vous relancerons plus. Votre candidature ${o ? `à notre offre « ${o} »` : "à notre offre d'emploi"}, elle, n'est pas concernée par ce message.`,
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
    kit: "As a reminder, to prepare for the call:",
    desinscription:
      "If you no longer wish to hear from us, one click is enough: the link is at the bottom of this message.",
    cta: "Book my slot",
    subjectOffre: (dernier: boolean) =>
      dernier ? "Last reminder: the network call" : "Your call about the network awaits",
    previewOffre: (dernier: boolean) =>
      dernier
        ? "Our last message on the subject: the 15-minute video call remains open."
        : "All that is left is to pick the time of our 15-minute call about the business introducer network.",
    j3Offre: (n: string, o: string) =>
      `${n ? `Hello ${n}, following` : "Hello, following"} your application ${o ? `to our “${o}” opening` : "to one of our job openings"}, we offered you to also discover our network of independent business introducers. If the proposal interests you, all that is left is to choose the time of our 15-minute video call, in one click with the button below.`,
    j7Offre: (n: string, o: string) =>
      `${n ? `Hello ${n}, this` : "Hello, this"} is our last message about the business introducer network: the 15-minute video call remains open if you would like to discover it. If now is not the right time, no problem: without a booking from you, we will not remind you again. Your application ${o ? `to our “${o}” opening` : "to our job opening"} is not affected by this message.`,
  },
} as const;

function estDernier(p: Record<string, unknown>): boolean {
  return p["etape"] === "j7";
}

/** Titre de l'offre (variante `offre`), ou `null` hors variante. Lecture défensive. */
function lireOffre(p: Record<string, unknown>): string | null {
  const o = p["offreEmploi"];
  return typeof o === "string" ? o.trim() : null;
}

export const apporteurInvitationRelanceSubject = (
  locale: Locale,
  p: Record<string, unknown>,
): string => {
  const t = COPY_RELANCE_INVITATION[locale === "fr" ? "fr" : "en"];
  return lireOffre(p) !== null ? t.subjectOffre(estDernier(p)) : t.subject(estDernier(p));
};

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
  const offre = lireOffre(payload);
  const texte =
    offre !== null
      ? dernier
        ? t.j7Offre(prenom, offre)
        : t.j3Offre(prenom, offre)
      : dernier
        ? t.j7(prenom)
        : t.j3(prenom);
  return (
    <EmailLayout
      famille="B"
      preview={offre !== null ? t.previewOffre(dernier) : t.preview(dernier)}
      title={t.title(dernier)}
      cta={{ label: t.cta, href: p.calendlyUrl }}
      locale={locale}
      sansReseauxSociaux
      // 2026-09-27 (Will) : signé du fondateur — bloc §6.1 du châssis, sans
      // téléphone. Il ajoute deux liens (rendez-vous, LinkedIn) : le message en
      // porte alors 8 pour un budget de 9 en famille B, mesuré par
      // `le-rappel-de-l-invitation-dit-son-etape.spec.tsx`.
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{texte}</Text>
      <BlocKitApporteur locale={locale === "fr" ? "fr" : "en"} intro={t.kit} />
      <Text style={emailStyles.paragraphStyle}>{t.desinscription}</Text>
    </EmailLayout>
  );
}
