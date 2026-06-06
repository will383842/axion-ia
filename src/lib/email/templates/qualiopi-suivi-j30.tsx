// Email — suivi post-formation J+30 (T15).
// Envoyé 30 jours après dateFin pour chaque enrollment présent/planifié.
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateFinFormation: string;
  lienPortail?: string;
  numeroSession: string;
}

export const qualiopiSuiviJ30Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Suivi J+30 — ${p.titreFormation ?? "Formation"} — Axion-IA`;
  }
  return `30-day follow-up — ${p.titreFormation ?? "Training"} — Axion-IA`;
};

export function QualiopiSuiviJ30Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/espace-stagiaire`;
  return (
    <EmailLayout
      preview="Un mois après votre formation — comment allez-vous ?"
      title="Suivi post-formation — 30 jours déjà"
      cta={{ label: "Accéder à mon espace", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      <Text style={emailStyles.paragraphStyle}>
        Il y a maintenant un mois que vous avez suivi la formation{" "}
        <strong>{p.titreFormation}</strong> (fin le {p.dateFinFormation}).
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Avez-vous pu mettre en pratique les acquis ? Des questions ou besoins d&apos;accompagnement
        supplémentaire ? Notre équipe est à votre disposition.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Retrouvez également vos documents (attestation, supports) dans votre espace stagiaire.
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Référence session : {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
