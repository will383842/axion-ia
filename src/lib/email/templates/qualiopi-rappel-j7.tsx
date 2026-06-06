// Email — rappel J-7 avant le démarrage de la session (T15).
// Envoyé à tous les stagiaires inscrits 7 jours avant dateDebut.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  modalite: string;
  numeroSession: string;
  lienPortail?: string;
}

export const qualiopiRappelJ7Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Rappel J-7 — ${p.titreFormation ?? "Formation"} — Axion-IA`;
  }
  return `7-day reminder — ${p.titreFormation ?? "Training"} — Axion-IA`;
};

export function QualiopiRappelJ7Email({
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
      preview="Votre formation démarre dans 7 jours"
      title="Rappel — votre formation arrive !"
      cta={{ label: "Accéder à mon espace", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      <Text style={emailStyles.paragraphStyle}>
        Votre formation <strong>{p.titreFormation}</strong> démarre le{" "}
        <strong>{p.dateDebut}</strong> — {p.modalite} — {p.lieu}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        N&apos;oubliez pas de consulter votre convocation et les informations pratiques dans votre
        espace stagiaire avant la date de démarrage.
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Référence session : {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
