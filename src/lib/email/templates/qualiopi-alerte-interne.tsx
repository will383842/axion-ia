// Email — alerte interne Qualiopi (T15 — notifierAlerteInterne).
// Destinataire : équipe Axion-IA (admin). NE PAS envoyer aux stagiaires.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  niveau: string; // "critique" | "important" | "info"
  code: string;
  titre: string;
  message: string;
  cibleType?: string;
  cibleId?: string;
  createdAt: string;
}

export const qualiopiAlerteInterneSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const prefix =
    p.niveau === "critique" ? "[CRITIQUE]" : p.niveau === "important" ? "[IMPORTANT]" : "[INFO]";
  return `${prefix} Alerte Qualiopi — ${p.titre ?? p.code} — Axion-IA`;
};

export function QualiopiAlerteInterneEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const niveauLabel =
    p.niveau === "critique" ? "CRITIQUE" : p.niveau === "important" ? "IMPORTANT" : "INFO";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const alertesHref = `${baseUrl}/fr/admin-dev-x7k2n9/qualiopi/alertes`;
  return (
    <EmailLayout
      preview={`Alerte ${niveauLabel} — ${p.titre ?? p.code}`}
      title={`Alerte ${niveauLabel} — ${p.titre ?? p.code}`}
      cta={{ label: "Voir les alertes", href: alertesHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>Code :</strong> {p.code}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{p.message}</Text>
      {p.cibleType && p.cibleId && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          Entité : {p.cibleType} / {p.cibleId}
        </Text>
      )}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Générée le : {p.createdAt}
      </Text>
    </EmailLayout>
  );
}
