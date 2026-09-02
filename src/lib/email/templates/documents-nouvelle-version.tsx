// Email — nouvelle version d'un document d'intervention publiée.
// Notifie les destinataires (formateurs / commerciaux, listes admin) SANS
// compte requis : informe du « Quoi de neuf » ET fournit des liens de
// téléchargement signés (source éditable + PDF) valables ~14 jours.
// FR canonique.

import { Text, Button, Link, Section } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  interventionLabel: string;
  slotTitre: string;
  version: number;
  familleLabel: string;
  changeNote?: string;
  /** Liens R2 signés (TTL ~14 j) — absents si R2 non configuré. */
  sourceUrl?: string;
  pdfUrl?: string;
  sourceFormat?: string;
  /** URL de l'espace ressources passwordless (consultation permanente). */
  portalUrl?: string;
}

export const documentsNouvelleVersionSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const doc = p.slotTitre ?? "Document";
  if (locale === "fr") {
    return objetCompose("Mise à jour —", `${doc} (${p.interventionLabel ?? ""})`);
  }
  return objetCompose("Updated —", `${doc} (${p.interventionLabel ?? ""})`);
};

// Lot 4 (2026-09-02) : le secondaire écrasait la couleur de fond mais
// héritait du DÉGRADÉ terracotta de `ctaStyle` — il restait orange. Et les deux
// « boutons » étaient des <Link> en ligne : pas bulletproof Outlook, et un
// padding vertical qui ne gonfle pas une boîte en ligne (cible < 44 px).
const secondaryBtn: React.CSSProperties = {
  ...emailStyles.ctaStyle,
  backgroundColor: emailStyles.COLORS.textMuted,
  backgroundImage: "none",
  boxShadow: "none",
  marginLeft: "8px",
};

export function DocumentsNouvelleVersionEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const hasDownload = Boolean(p.sourceUrl || p.pdfUrl);
  const sourceLabel = p.sourceFormat
    ? `Télécharger la source (.${p.sourceFormat})`
    : "Télécharger la source";
  return (
    <EmailLayout
      famille="C"
      preview={`Version ${p.version} — ${p.changeNote ?? "liens de téléchargement valables 14 jours"}`}
      title="Un document a été mis à jour"
      locale={locale}
    >
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

      {hasDownload ? (
        <>
          <Section style={{ margin: "8px 0 4px 0" }}>
            {p.sourceUrl ? (
              <Button href={p.sourceUrl} style={emailStyles.ctaStyle} className="ax-cta">
                {sourceLabel}
              </Button>
            ) : null}
            {p.pdfUrl ? (
              <Button
                href={p.pdfUrl}
                style={p.sourceUrl ? secondaryBtn : emailStyles.ctaStyle}
                className="ax-cta"
              >
                Télécharger le PDF
              </Button>
            ) : null}
          </Section>
          <Text
            style={{
              ...emailStyles.paragraphStyle,
              fontSize: "13px",
              color: emailStyles.COLORS.textMuted,
            }}
          >
            Liens valables 14 jours. Document interne — merci de ne pas le transférer hors de
            l&apos;équipe.
          </Text>
        </>
      ) : (
        <Text style={emailStyles.paragraphStyle}>
          Le document est disponible auprès de l&apos;administration.
        </Text>
      )}

      {p.portalUrl ? (
        <Text style={emailStyles.paragraphStyle}>
          Retrouvez à tout moment <strong>tous vos documents à jour</strong> dans votre{" "}
          <Link href={p.portalUrl} style={{ color: emailStyles.COLORS.textMuted }}>
            espace ressources
          </Link>{" "}
          (connexion par e-mail, sans mot de passe).
        </Text>
      ) : null}

      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Pensez à utiliser la dernière version pour vos prochaines interventions. Cette notification
        est envoyée automatiquement à la publication d&apos;une nouvelle version.
      </Text>
    </EmailLayout>
  );
}
