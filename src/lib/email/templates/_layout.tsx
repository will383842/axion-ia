// Layout commun aux 8 templates emails (Sprint 15 / M8 step 4).
//
// Pattern : un seul wrapper Html/Head/Body/Container avec brand header/footer.
// Chaque template specifie : title, intro, body, cta. Tous les liens utilisent
// l'URL absolue (NEXT_PUBLIC_SITE_URL) pour fonctionner depuis Mailhog/PowerMTA.

import {
  Body,
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

// Tokens visuels stricts (sans Tailwind dans email — inline CSS only).
// Couleurs Editorial Premium v3 (ADR 0002) en hex pour clients email
// qui ne supportent pas les CSS variables.
const COLORS = {
  text: "#1a1a1a",
  textMuted: "#6b6b6b",
  accent: "#1a4dd9",
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
const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: COLORS.accent,
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 500,
  margin: "16px 0",
};
const footerStyle: React.CSSProperties = {
  fontSize: "12px",
  color: COLORS.textMuted,
  lineHeight: 1.5,
  margin: "0",
};

export interface EmailLayoutProps {
  preview: string;
  title: string;
  children: ReactNode;
  cta?: { label: string; href: string };
  /** Footer bilingue. Affiche "axion-ia.com", date, lien unsubscribe optionnel. */
  unsubscribeHref?: string;
  locale: "fr" | "en";
}

const FOOTER_TEXT = {
  fr: {
    company: "Axion-IA · cabinet IA opérationnel",
    address: "France (UE)",
    contact: "Contact :",
    rights: "Tous droits réservés.",
    unsubscribe: "Se désabonner",
  },
  en: {
    company: "Axion-IA · operational AI consultancy",
    address: "France (EU)",
    contact: "Contact:",
    rights: "All rights reserved.",
    unsubscribe: "Unsubscribe",
  },
} as const;

export function EmailLayout({
  preview,
  title,
  children,
  cta,
  unsubscribeHref,
  locale,
}: EmailLayoutProps) {
  const t = FOOTER_TEXT[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandStyle}>{BRAND}</Text>
          <Heading style={headingStyle}>{title}</Heading>
          {children}
          {cta && (
            <Section style={{ margin: "20px 0" }}>
              <Link href={cta.href} style={ctaStyle}>
                {cta.label}
              </Link>
            </Section>
          )}
          <Hr style={{ borderColor: COLORS.border, margin: "32px 0 16px 0" }} />
          <Text style={footerStyle}>
            {t.company}
            <br />
            {t.address}
            <br />
            {t.contact}{" "}
            <Link href={`${BASE_URL}/contact`} style={{ color: COLORS.accent }}>
              {BASE_URL.replace(/^https?:\/\//, "")}
            </Link>
            <br />© {new Date().getFullYear()} Axion-IA — {t.rights}
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
