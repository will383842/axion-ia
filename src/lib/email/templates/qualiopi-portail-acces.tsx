// Email — lien d'accès à l'espace stagiaire (re-demande self-service).
// Envoyé quand un participant demande lui-même un nouveau lien d'accès depuis
// la page /portail/demander-acces (token expiré ou perdu).
// ⚠️ Aucune mention de financement public (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  lienPortail: string;
}

export const qualiopiPortailAccesSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre lien d'accès à votre espace — Axion-IA"
    : "Your access link to your space — Axion-IA";

export function QualiopiPortailAccesEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      preview="Votre lien d'accès à votre espace stagiaire"
      title="Votre lien d'accès"
      cta={{ label: "Accéder à mon espace", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      <Text style={emailStyles.paragraphStyle}>
        Vous avez demandé un nouveau lien d'accès à votre espace stagiaire, où vous retrouvez vos{" "}
        <strong>attestations</strong> et vos <strong>questionnaires</strong>.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Ce lien est personnel et valable 90 jours. Si vous n'êtes pas à l'origine de cette demande,
        vous pouvez ignorer cet email.
      </Text>
    </EmailLayout>
  );
}
