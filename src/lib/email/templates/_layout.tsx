// Layout commun à TOUS les templates emails — refonte design 2026-07-09 (v2 énergique).
//
// Modifier CE fichier modernise les ~55 templates d'un coup.
//
// Direction : chaud + énergique, orange de marque en couleur héro, formes
// arrondies (pill), CTA pill orange avec glow, preuve Qualiopi. Best practices
// conservées : bouton bulletproof Outlook, color-scheme light dark + dark-mode
// safe, footer légal SAS (COMPANY_* env), List-Unsubscribe.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { createContext, useContext, type ReactNode } from "react";
import type { ReviewStats } from "../review-stats";

/**
 * Stats avis injectées par `renderEmailTemplate` (valeurs réelles depuis la DB).
 * Défaut neutre = pas d'avis (build/stub) → le bandeau masque la ligne avis.
 */
export const ReviewStatsContext = createContext<ReviewStats>({ count: 0, avg: 0 });

const BRAND = "Axion-IA";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const LOGO_PILL = `${BASE_URL}/email/axion-ia-logo-pill.png`;
const QUALIOPI_LOCKUP = `${BASE_URL}/email/axion-qualiopi-lockup.png`;
const LINKEDIN_URL = process.env.COMPANY_LINKEDIN || "";
const CONTACT_EMAIL = process.env.ADMIN_REPLY_FROM || "contact@axion-ia.com";

const COMPANY = {
  name: process.env.COMPANY_NAME || "Axion-IA",
  address: process.env.COMPANY_ADDRESS || "",
  registration: process.env.COMPANY_REGISTRATION_NUMBER || "",
  vat: process.env.COMPANY_VAT_NUMBER || "",
} as const;

// Palette — terracotta de marque (chaud, éditorial, pas orange criard), ivoire, serif.
const C = {
  text: "#241d15",
  muted: "#7a6f60",
  heading: "#1c150e",
  orange: "#c24a1b", // terracotta brique (accent éditorial du site) — CTA + accents
  orangeDeep: "#8c3010", // terracotta foncé — hover / glow
  orangeSoft: "#f7ebe2", // halo terracotta doux (bandeau confiance)
  orangeTint: "#ecd9c9",
  blue: "#1a4dd9", // liens texte inline (contraste)
  border: "#eee2d2",
  bgEmail: "#f6f1e8", // ivoire chaud
  card: "#ffffff",
  white: "#ffffff",
} as const;

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const main: React.CSSProperties = {
  backgroundColor: C.bgEmail,
  fontFamily: SANS,
  color: C.text,
  padding: "0 0 40px",
  margin: 0,
};
const topbar: React.CSSProperties = {
  height: "6px",
  lineHeight: "6px",
  fontSize: "1px",
  backgroundColor: C.orange,
  backgroundImage: `linear-gradient(90deg, ${C.orange} 0%, #d1561f 55%, ${C.orangeDeep} 100%)`,
};
const wrapper: React.CSSProperties = { margin: "0 auto", maxWidth: "700px", width: "100%" };
const header: React.CSSProperties = { padding: "26px 0 20px", textAlign: "center" };
const taglineStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: C.muted,
  fontWeight: 700,
  margin: "12px 0 0 0",
};
const card: React.CSSProperties = {
  backgroundColor: C.card,
  borderRadius: "20px",
  border: `1px solid ${C.border}`,
  padding: "38px 40px",
  boxShadow: "0 12px 34px -16px rgba(234,78,27,0.20), 0 2px 6px -2px rgba(36,29,21,0.06)",
};
const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 800,
  color: C.orange,
  margin: "0 0 12px 0",
};
const headingStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "29px",
  fontWeight: 700,
  margin: "0 0 18px 0",
  color: C.heading,
  lineHeight: 1.2,
};
const paragraphStyle: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: 1.7,
  color: C.text,
  margin: "14px 0",
};
// CTA pill orange + glow (bulletproof via <Button> React Email).
const ctaStyle: React.CSSProperties = {
  backgroundColor: C.orange,
  backgroundImage: `linear-gradient(180deg, #cf5527 0%, ${C.orange} 100%)`,
  color: C.white,
  padding: "16px 34px",
  borderRadius: "999px",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 700,
  fontFamily: SANS,
  boxShadow: "0 10px 22px -8px rgba(194,74,27,0.5)",
};
const trustBand: React.CSSProperties = {
  backgroundColor: C.orangeSoft,
  border: `1px solid ${C.orangeTint}`,
  borderRadius: "16px",
  padding: "18px 20px 14px",
  margin: "16px 0 0 0",
  textAlign: "center",
};
const starsStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: C.orangeDeep,
  letterSpacing: "0.02em",
  margin: "12px 0 0 0",
};
const footerStyle: React.CSSProperties = {
  fontSize: "12px",
  color: C.muted,
  lineHeight: 1.6,
  margin: 0,
  textAlign: "center",
};

const DARK_MODE_STYLE = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .ax-body { background-color: #15110c !important; }
    .ax-card { background-color: #221b13 !important; border-color: #3a3025 !important; }
    .ax-text { color: #f6efe3 !important; }
    .ax-heading { color: #fdf7ec !important; }
    .ax-muted { color: #b8ac99 !important; }
    .ax-trust { background-color: #2c1c12 !important; border-color: #5a3620 !important; }
  }
`;

export interface EmailLayoutProps {
  preview: string;
  title: string;
  children: ReactNode;
  cta?: { label: string; href: string };
  /** Surtitre (orange) au-dessus du titre. */
  eyebrow?: string;
  /** Bandeau confiance (Qualiopi + avis) — emails relationnels. */
  trust?: boolean;
  unsubscribeHref?: string;
  locale: "fr" | "en";
}

const TXT = {
  fr: {
    tagline: "Audit · Formation · Intégration · Sites web IA · Coaching",
    reviewsWord: "avis clients vérifiés",
    qualiopiAlt: "Organisme de formation certifié Qualiopi — Axion-IA",
    legalForm: "SAS française",
    siret: "SIRET",
    vat: "TVA",
    contact: "Contact :",
    follow: "LinkedIn",
    rights: "Tous droits réservés.",
    unsubscribe: "Se désabonner",
  },
  en: {
    tagline: "Audit · Training · Integration · AI websites · Coaching",
    reviewsWord: "verified client reviews",
    qualiopiAlt: "Qualiopi-certified training organisation — Axion-IA",
    legalForm: "French company (SAS)",
    siret: "Reg. no.",
    vat: "VAT",
    contact: "Contact:",
    follow: "LinkedIn",
    rights: "All rights reserved.",
    unsubscribe: "Unsubscribe",
  },
} as const;

function joinDefined(parts: Array<string | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

export function EmailLayout({
  preview,
  title,
  children,
  cta,
  eyebrow,
  trust,
  unsubscribeHref,
  locale,
}: EmailLayoutProps) {
  const t = TXT[locale];
  const rs = useContext(ReviewStatsContext);
  // Ligne avis RÉELLE (masquée sous 5 avis — même seuil que l'AggregateRating du site).
  const showReviews = rs.count >= 5 && rs.avg > 0;
  const avgFr = rs.avg.toFixed(1).replace(".", locale === "fr" ? "," : ".");
  const reviewLine = `★★★★★  ${avgFr}/5 — ${rs.count} ${t.reviewsWord}`;
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
        {/* Bandeau accent haut — énergie de marque */}
        <Section style={topbar}>&nbsp;</Section>

        <Container style={wrapper}>
          {/* En-tête : logo pill de marque */}
          <Section style={header}>
            <Link href={BASE_URL}>
              <Img
                src={LOGO_PILL}
                width="210"
                height="115"
                alt={BRAND}
                style={{ margin: "0 auto", display: "block", border: "0" }}
              />
            </Link>
            <Text style={taglineStyle} className="ax-muted">
              {t.tagline}
            </Text>
          </Section>

          {/* Carte de contenu */}
          <Container style={card} className="ax-card">
            {eyebrow && <Text style={eyebrowStyle}>{eyebrow}</Text>}
            <Heading style={headingStyle} className="ax-heading">
              {title}
            </Heading>
            {children}
            {cta && (
              <Section style={{ textAlign: "center", margin: "30px 0 8px 0" }}>
                <Button href={cta.href} style={ctaStyle}>
                  {cta.label} &nbsp;→
                </Button>
              </Section>
            )}
            {trust && (
              <Section style={trustBand} className="ax-trust">
                <Img
                  src={QUALIOPI_LOCKUP}
                  width="340"
                  height="227"
                  alt={t.qualiopiAlt}
                  style={{ margin: "0 auto", display: "block", border: "0", maxWidth: "100%" }}
                />
                {showReviews && <Text style={starsStyle}>{reviewLine}</Text>}
              </Section>
            )}
          </Container>

          {/* Footer social + légal */}
          <Section style={{ padding: "26px 12px 0 12px" }}>
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
              <Link
                href={`mailto:${CONTACT_EMAIL}`}
                style={{ color: C.orangeDeep, fontWeight: 600 }}
              >
                {CONTACT_EMAIL}
              </Link>
              {LINKEDIN_URL ? (
                <>
                  {"  ·  "}
                  <Link href={LINKEDIN_URL} style={{ color: C.orangeDeep, fontWeight: 600 }}>
                    {t.follow}
                  </Link>
                </>
              ) : null}
              <br />© {new Date().getFullYear()} {COMPANY.name} — {t.rights}
              {unsubscribeHref && (
                <>
                  <br />
                  <Link href={unsubscribeHref} style={{ color: C.muted }}>
                    {t.unsubscribe}
                  </Link>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  paragraphStyle,
  headingStyle,
  ctaStyle,
  COLORS: {
    text: C.text,
    textMuted: C.muted,
    accent: C.blue,
    terracotta: C.orange,
    border: C.border,
  },
  SERIF,
  SANS,
};
