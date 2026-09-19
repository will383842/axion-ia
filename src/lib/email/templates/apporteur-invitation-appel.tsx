// E-mail — INVITATION à un échange de 15 minutes, envoyée par Will depuis la
// console à une personne intéressée par le réseau d'apporteurs d'affaires
// (2026-09-19).
//
// ── Pourquoi un envoi MANUEL ──────────────────────────────────────────────
// Le lien de réservation n'est pas distribué automatiquement : envoyé à chaque
// personne qui laisse son adresse, il saturerait l'agenda de Will. Il part
// donc, un par un, aux personnes qu'il choisit — depuis la fiche du contact
// (Contacts › Commercial) ou au moment d'une saisie manuelle.
//
// Contenu : l'invitation (CTA = le créneau Calendly), le kit apporteur
// (document de présentation + catalogue), et — si la personne n'a pas encore
// envoyé son dossier — le lien pour le compléter.
//
// Vocabulaire (anti-requalification, `docs/partners/ANTI-REQUALIFICATION.md`) :
// « échange », « faire connaissance », « recommander » ; jamais « entretien »,
// « poste », « recrutement », « commercial », « vendre ». Et « aucun
// engagement » : la personne décide après.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  /** Lien de réservation Calendly (validé à l'envoi : https, calendly.com). */
  calendlyUrl: string;
  /** Présent seulement si le dossier complet n'est pas encore arrivé. */
  dossierUrl?: string;
}

const COPY = {
  fr: {
    title: "Et si on en parlait 15 minutes ?",
    preview: "Choisis le moment qui t'arrange : 15 minutes en visio pour faire connaissance.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci pour ton intérêt pour le réseau d'apporteurs d'affaires d'Axion-IA. On te propose un échange de 15 minutes en visio : faire connaissance, t'expliquer simplement comment ça marche et répondre à tes questions. Aucun engagement : tu décides après.",
    creneau: "Choisis toi-même le moment qui t'arrange, en un clic, avec le bouton ci-dessous.",
    dossier:
      "Si tu ne l'as pas encore fait, tu peux aussi compléter ton dossier — trois minutes, sans CV. Tes coordonnées sont déjà remplies : ",
    dossierLien: "compléter mon dossier",
    cta: "Choisir mon créneau",
  },
  en: {
    title: "How about a 15-minute chat?",
    preview: "Pick the time that suits you: 15 minutes on video to get acquainted.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thank you for your interest in Axion-IA's network of business introducers. We suggest a 15-minute video call: get acquainted, explain simply how it works and answer your questions. No commitment: you decide afterwards.",
    creneau: "Pick the time that suits you, in one click, with the button below.",
    dossier:
      "If you have not done it yet, you can also complete your file — three minutes, no resume. Your details are already filled in: ",
    dossierLien: "complete my file",
    cta: "Pick my slot",
  },
} as const;

export const apporteurInvitationAppelSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string => COPY[locale === "fr" ? "fr" : "en"].title;

export function ApporteurInvitationAppelEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const dossierUrl =
    typeof p.dossierUrl === "string" && p.dossierUrl.length > 0 ? p.dossierUrl : null;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: p.calendlyUrl }}
      locale={locale}
      tutoiement
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <BlocKitApporteur locale={locale} />
      {dossierUrl ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.dossier}
          <a href={dossierUrl} style={{ color: emailStyles.COLORS.terracotta }}>
            {t.dossierLien}
          </a>
          .
        </Text>
      ) : null}
      {/* Juste au-dessus du bouton, qui porte le lien de réservation. */}
      <Text style={emailStyles.paragraphStyle}>{t.creneau}</Text>
    </EmailLayout>
  );
}
