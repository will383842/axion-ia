// Email — nouvelle version d'un document d'intervention publiée.
// Notifie les destinataires (formateurs / commerciaux, listes admin) sans
// compte requis. Informe du « Quoi de neuf ». FR canonique.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  interventionLabel: string;
  slotTitre: string;
  version: number;
  familleLabel: string;
  changeNote?: string;
}

export const documentsNouvelleVersionSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const doc = p.slotTitre ?? "Document";
  if (locale === "fr") {
    return `Mise à jour — ${doc} (${p.interventionLabel ?? ""}) — Axion-IA`;
  }
  return `Updated — ${doc} (${p.interventionLabel ?? ""}) — Axion-IA`;
};

export function DocumentsNouvelleVersionEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  return (
    <EmailLayout
      preview={`Nouvelle version : ${p.slotTitre ?? "document"}`}
      title="Un document a été mis à jour"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour,</Text>
      <Text style={emailStyles.paragraphStyle}>
        Une nouvelle version (<strong>v{p.version}</strong>) du document{" "}
        <strong>{p.slotTitre}</strong> est disponible pour <strong>{p.interventionLabel}</strong> (
        {p.familleLabel}).
      </Text>
      {p.changeNote ? (
        <Text style={emailStyles.paragraphStyle}>
          <strong>Quoi de neuf :</strong> {p.changeNote}
        </Text>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Pensez à utiliser la dernière version pour vos prochaines interventions. Cette notification
        est envoyée automatiquement à la publication d&apos;une nouvelle version.
      </Text>
    </EmailLayout>
  );
}
