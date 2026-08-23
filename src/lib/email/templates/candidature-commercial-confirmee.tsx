// Email — accusé de réception candidature commerciale (tunnel sans CV,
// Mémorial de l'Isère 2026-08-12).
//
// Ton : chaleureux, TUTOIEMENT (cohérent avec le formulaire, qui tutoie de
// bout en bout). Rappelle le poste, annonce la suite (si retenue → premier
// échange en visio de 15 à 30 minutes) et donne un délai indicatif.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom du candidat (le tutoiement appelle le prénom seul). */
  contactName?: string;
  submissionId?: string;
}

const COPY = {
  fr: {
    title: "On a bien reçu ta candidature",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci d'avoir pris ces quelques minutes : ta candidature de commercial indépendant Axion-IA est bien arrivée, et elle sera lue avec attention — c'est promis, pas par un robot.",
    // 🔴 2026-08-23 — cette phrase disait « Si ton profil est retenu, on te
    // recontacte […]. Compte quelques jours ouvrés pour notre retour. » Deux
    // défauts, tous deux corrigés ici :
    //   1. Elle promettait un DÉLAI CHIFFRÉ (« quelques jours ouvrés »).
    //      Règle Will du 2026-08-23 : une offre ne s'engage jamais sur un
    //      délai de réponse — un délai annoncé et non tenu détruit exactement
    //      la confiance qu'il cherchait à créer, et c'est intenable dès que le
    //      volume monte.
    //   2. « Si ton profil est retenu, on te recontacte » impliquait que les
    //      NON-retenus ne recevraient rien — en contradiction directe avec
    //      l'annonce Le Bon Coin, qui promet « on répond à TOUTES les
    //      candidatures » (cf. docs/annonce-leboncoin-recrutement.md §2.5).
    next: "On répond à toutes les candidatures : la tienne aura une réponse, quoi qu'il arrive. Si ton profil correspond, on te proposera un premier échange en visio de 15 à 30 minutes. On revient vers toi dans les prochaines semaines.",
    spam: "Pense à vérifier tes spams si tu n'as pas de nouvelles : nos emails s'y égarent parfois.",
    cta: "Découvrir Axion-IA",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "We received your application",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thanks for taking a few minutes: your application to become an independent Axion-IA sales rep has arrived, and it will be read carefully — by a human, promise.",
    next: "We answer every application: yours will get a reply either way. If your profile is a match, we will offer you a first 15-30 minute video call. We will come back to you in the coming weeks.",
    spam: "Check your spam folder if you do not hear from us: our emails sometimes end up there.",
    cta: "Discover Axion-IA",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const candidatureCommercialConfirmeeSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "On a bien reçu ta candidature — Axion-IA"
    : "We received your application — Axion-IA";

export function CandidatureCommercialConfirmeeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  // Le formulaire envoie le prénom seul ; si un nom complet arrive quand même,
  // on ne garde que le premier mot — « Bonjour Jean Dupont, » sonne administratif.
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: `${baseUrl}/${locale}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.spam}</Text>
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
