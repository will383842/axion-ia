// Layout commun à TOUS les templates emails (refonte P0 2026-06-21).
//
// Pattern : un seul wrapper Html/Head/Body/Container avec brand header/footer.
// Chaque template spécifie : title, intro/body (children), cta. Tous les liens
// utilisent l'URL absolue (NEXT_PUBLIC_SITE_URL).
//
// P0 (corrige les 42 emails d'un coup) :
//   - Bouton CTA BULLETPROOF (composant <Button> React Email → padding/rayon
//     rendus via table + MSO conditional pour Outlook, qui aplatissait le <a>).
//   - <meta color-scheme: light dark> + style dark-mode-safe (plus d'inversion
//     sauvage des couleurs).
//   - Footer LÉGAL enrichi : raison sociale SAS française + adresse + SIRET/RCS
//     + n° TVA, lus depuis l'env (COMPANY_*), lignes omises si non renseignées.
//   - List-Unsubscribe conservé.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const BRAND = "Axion-IA";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

// Identité légale (SAS française) — depuis l'env, placeholders omis si vides.
const COMPANY = {
  name: process.env.COMPANY_NAME || "Axion-IA",
  address: process.env.COMPANY_ADDRESS || "",
  registration: process.env.COMPANY_REGISTRATION_NUMBER || "",
  vat: process.env.COMPANY_VAT_NUMBER || "",
} as const;

// Tokens visuels stricts (inline CSS only — pas de Tailwind dans l'email).
const COLORS = {
  text: "#1a1a1a",
  textMuted: "#6b6b6b",
  accent: "#1a4dd9",
  accentText: "#ffffff",
  border: "#e6e1d6",
  bgEmail: "#faf8f3",
  bgCard: "#ffffff",
} as const;

const main: React.CSSProperties = {
  backgroundColor: COLORS.bgEmail,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: COLORS.text,
  padding: "32px 0",
  margin: 0,
};
const container: React.CSSProperties = {
  margin: "0 auto",
  maxWidth: "560px",
  backgroundColor: COLORS.bgCard,
  borderRadius: "8px",
  border: `1px solid ${COLORS.border}`,
  padding: "32px",
};
const brandStyle: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: COLORS.textMuted,
  margin: "0 0 24px 0",
};
const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  margin: "0 0 12px 0",
  color: COLORS.text,
  lineHeight: 1.3,
};
const paragraphStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: COLORS.text,
  margin: "12px 0",
};
// Bouton bulletproof : @react-email/components <Button> génère un rendu
// table + MSO conditional → padding/rayon respectés sur Outlook (Word engine).
const ctaStyle: React.CSSProperties = {
  backgroundColor: COLORS.accent,
  color: COLORS.accentText,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 500,
};
const footerStyle: React.CSSProperties = {
  fontSize: "12px",
  color: COLORS.textMuted,
  lineHeight: 1.5,
  margin: "0",
};

// Style dark-mode-safe : signale aux clients qu'on supporte les 2 schémas et
// borne les couleurs (évite l'inversion automatique cassée de certains clients).
const DARK_MODE_STYLE = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .ax-body { background-color: #1a1815 !important; }
    .ax-card { background-color: #26221d !important; border-color: #3d362f !important; }
    .ax-text { color: #f7f3ea !important; }
    .ax-muted { color: #b8ad9d !important; }
  }
`;

export interface EmailLayoutProps {
  preview: string;
  title: string;
  children: ReactNode;
  cta?: { label: string; href: string };
  /** Footer bilingue. Lien de désabonnement optionnel. */
  unsubscribeHref?: string;
  locale: "fr" | "en";
}

const FOOTER_TEXT = {
  fr: {
    legalForm: "SAS française",
    siret: "SIRET",
    vat: "TVA",
    contact: "Contact :",
    rights: "Tous droits réservés.",
    unsubscribe: "Se désabonner",
  },
  en: {
    legalForm: "French company (SAS)",
    siret: "Reg. no.",
    vat: "VAT",
    contact: "Contact:",
    rights: "All rights reserved.",
    unsubscribe: "Unsubscribe",
  },
} as const;

/** Joint des fragments non vides avec un séparateur. */
function joinDefined(parts: Array<string | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

export function EmailLayout({
  preview,
  title,
  children,
  cta,
  unsubscribeHref,
  locale,
}: EmailLayoutProps) {
  const t = FOOTER_TEXT[locale];
  const orgLine = joinDefined([`${COMPANY.name} · ${t.legalForm}`, COMPANY.address], " — ");
  const idLine = joinDefined(
    [
      COMPANY.registration ? `${t.siret} ${COMPANY.registration}` : "",
      COMPANY.vat ? `${t.vat} ${COMPANY.vat}` : "",
    ],
    "  ·  ",
  );

  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_STYLE }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main} className="ax-body">
        <Container style={container} className="ax-card">
          <Text style={brandStyle} className="ax-muted">
            {BRAND}
          </Text>
          <Heading style={headingStyle} className="ax-text">
            {title}
          </Heading>
          {children}
          {cta && (
            <Section style={{ margin: "20px 0" }}>
              <Button href={cta.href} style={ctaStyle}>
                {cta.label}
              </Button>
            </Section>
          )}
          <Hr style={{ borderColor: COLORS.border, margin: "32px 0 16px 0" }} />
          <Text style={footerStyle} className="ax-muted">
            {orgLine}
            {idLine ? (
              <>
                <br />
                {idLine}
              </>
            ) : null}
            <br />
            {t.contact}{" "}
            <Link href={`${BASE_URL}/contact`} style={{ color: COLORS.accent }}>
              {BASE_URL.replace(/^https?:\/\//, "")}
            </Link>
            <br />© {new Date().getFullYear()} {COMPANY.name} — {t.rights}
            {unsubscribeHref && (
              <>
                <br />
                <Link href={unsubscribeHref} style={{ color: COLORS.textMuted }}>
                  {t.unsubscribe}
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = { paragraphStyle, headingStyle, ctaStyle, COLORS };
