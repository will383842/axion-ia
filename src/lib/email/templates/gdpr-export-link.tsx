// Email — lien magique pour export RGPD self-service (Sprint 24 / D2).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  exportUrl: string;
  expiresHours: number;
}

const COPY = {
  fr: {
    title: "Export de vos données — lien d'accès",
    // Le pré-en-tête porte la durée de validité : c'est ce qui décide d'ouvrir
    // maintenant. Fonction plutôt que chaîne, pour reprendre le vrai délai.
    preview: (h: number) => `Lien personnel et unique, valable ${h} heures. Format JSON.`,
    intro: "Bonjour,",
    body: (h: number) =>
      `Vous avez demandé un export de vos données personnelles. Cliquez sur le bouton ci-dessous dans les ${h} heures pour télécharger votre export au format JSON. Ce lien est unique et personnel.`,
    safety:
      "Si vous n'avez pas fait cette demande, ignorez ce message. Aucune donnée ne sera transmise tant que le lien n'a pas été utilisé.",
    cta: "Télécharger mon export",
  },
  en: {
    title: "Your data export — access link",
    preview: (h: number) => `Personal, single-use link, valid for ${h} hours. JSON format.`,
    intro: "Hello,",
    body: (h: number) =>
      `You have requested an export of your personal data. Click the button below within ${h} hours to download your export as JSON. This link is unique and personal.`,
    safety:
      "If you didn't request this, please ignore this email. No data is transferred until the link is used.",
    cta: "Download my export",
  },
} as const;

export const gdprExportLinkSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Votre export RGPD" : "Your GDPR export";

export function GdprExportLinkEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout
      famille="A"
      preview={t.preview(p.expiresHours)}
      title={t.title}
      cta={{ label: t.cta, href: p.exportUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.body(p.expiresHours)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.safety}
      </Text>
    </EmailLayout>
  );
}
