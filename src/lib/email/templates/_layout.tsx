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
import { type ReactNode } from "react";
import type { ReviewStats } from "../review-stats";
// Module PUR (aucun import next/prisma) — sûr dans un rendu d'e-mail exécuté
// hors requête, dans le worker.
import { MENTION_NON_AGREMENT, NDA_NUMERO } from "@/server/qualiopi/legal/legal-mentions";
// Drapeau d'AFFIRMATION de la certification. Lecture `process.env` pure, aucun
// import next/prisma : compatible avec le rendu d'e-mail hors requête (worker).
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

/**
 * Stats avis injectées par `renderEmailTemplate` juste avant le rendu (valeurs
 * réelles depuis la DB). Défaut neutre = pas d'avis (build/stub) → le bandeau
 * masque la ligne avis.
 *
 * Volontairement un porteur au niveau module et NON un React Context :
 * `createContext` est une API Client-only, interdite dans un module importé
 * côté serveur (RSC) → cassait le build. Sûr contre les rendus concurrents :
 * `renderEmailTemplate` fait `setReviewStats(...)` puis `render(element)`, et le
 * parcours React (`renderToStaticMarkup`) est SYNCHRONE — il lit la valeur avant
 * que la boucle d'événements ne rende la main, donc aucune interleave possible.
 */
let CURRENT_REVIEW_STATS: ReviewStats = { count: 0, avg: 0 };
export function setReviewStats(stats: ReviewStats): void {
  CURRENT_REVIEW_STATS = stats;
}

const BRAND = "Axion-IA";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const LOGO_PILL = `${BASE_URL}/email/axion-ia-logo-pill.png`;
const QUALIOPI_LOCKUP = `${BASE_URL}/email/axion-qualiopi-lockup.png`;
const CONTACT_EMAIL = process.env.ADMIN_REPLY_FROM || "contact@axion-ia.com";

// Réseaux sociaux — footer de TOUS les emails (demande Will 2026-08-04).
// URLs publiques stables, en dur avec override env pour la page entreprise.
// Liens TEXTE et non icônes-images : bulletproof (pas de blocage d'images),
// accessible, et le libellé porte le nom — une icône muette ne dit pas QUI.
const SOCIALS = {
  linkedinCompany:
    process.env.COMPANY_LINKEDIN || "https://www.linkedin.com/company/axion-ia-france/",
  facebookCompany: "https://www.facebook.com/profile.php?id=61591668644032",
  linkedinWilliams: "https://www.linkedin.com/in/williamsjullin/",
  facebookWilliams: "https://www.facebook.com/profile.php?id=61586489122989",
} as const;
const REVIEW_URL = `${BASE_URL}/fr/avis`;
const LINKEDIN_SHARE = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(BASE_URL)}`;

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
const wrapper: React.CSSProperties = { margin: "0 auto", maxWidth: "1000px", width: "100%" };
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
  // maxWidth:100% OBLIGATOIRE — sinon le <Container> React Email impose son
  // défaut caché max-width:37.5em (600px) et plafonne le bloc de texte, quelle
  // que soit la largeur du wrapper. C'est CE défaut qui bloquait l'élargissement.
  maxWidth: "100%",
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
// Rangée réseaux sociaux du footer — un cran au-dessus du légal, même retenue.
const socialRowStyle: React.CSSProperties = {
  fontSize: "13px",
  color: C.muted,
  lineHeight: 1.6,
  margin: "0 0 10px 0",
  textAlign: "center",
};
const socialLinkStyle: React.CSSProperties = {
  color: C.orangeDeep,
  fontWeight: 700,
  textDecoration: "none",
};
// Blocs « boule de neige » (parrainage / demande d'avis) — opt-in, post-prestation.
const snowballCard: React.CSSProperties = {
  backgroundColor: C.bgEmail,
  border: `1px dashed ${C.orangeTint}`,
  borderRadius: "14px",
  padding: "16px 20px",
  margin: "14px 0 0 0",
  textAlign: "center",
};
const snowballTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: C.heading,
  margin: "0 0 4px 0",
};
const snowballText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.55,
  color: C.muted,
  margin: "0 0 8px 0",
};
const snowballLink: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: C.orangeDeep,
  textDecoration: "none",
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
  /** Bloc « boule de neige » — parrainage / demande d'avis (post-prestation). */
  snowball?: "referral" | "review" | "both";
  unsubscribeHref?: string;
  locale: "fr" | "en";
}

const TXT = {
  fr: {
    tagline: "Audit · Formation · Intégration · Sites web IA · Coaching",
    reviewsWord: "avis clients vérifiés",
    qualiopiAlt: "Organisme de formation certifié Qualiopi — Axion-IA",
    reviewTitle: "Votre avis nous aide énormément 🙏",
    reviewText:
      "30 secondes pour partager votre expérience — et aider d'autres dirigeants à franchir le pas de l'IA.",
    reviewCta: "Laisser un avis",
    referralTitle: "Un confrère pourrait en profiter ?",
    referralText:
      "Transférez-lui cet email, ou parlez d'Axion-IA autour de vous. Le bouche-à-oreille, c'est notre meilleure croissance.",
    referralCta: "Partager sur LinkedIn",
    legalForm: "SAS française",
    siret: "SIRET",
    vat: "TVA",
    nda: "NDA",
    contact: "Contact :",
    followBrand: "Suivez l'aventure Axion-IA",
    followFounder: "et Williams, son fondateur",
    rights: "Tous droits réservés.",
    unsubscribe: "Se désabonner",
  },
  en: {
    tagline: "Audit · Training · Integration · AI websites · Coaching",
    reviewsWord: "verified client reviews",
    qualiopiAlt: "Qualiopi-certified training organisation — Axion-IA",
    reviewTitle: "Your feedback means a lot 🙏",
    reviewText: "30 seconds to share your experience — and help other leaders take the AI leap.",
    reviewCta: "Leave a review",
    referralTitle: "Could a peer benefit from this?",
    referralText:
      "Forward this email, or spread the word about Axion-IA. Word of mouth is our best growth.",
    referralCta: "Share on LinkedIn",
    legalForm: "French company (SAS)",
    siret: "Reg. no.",
    vat: "VAT",
    nda: "Training provider reg. no.",
    contact: "Contact:",
    followBrand: "Follow the Axion-IA journey",
    followFounder: "and Williams, its founder",
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
  snowball,
  unsubscribeHref,
  locale,
}: EmailLayoutProps) {
  const t = TXT[locale];
  const rs = CURRENT_REVIEW_STATS;
  // Ligne avis RÉELLE (masquée sous 5 avis — même seuil que l'AggregateRating du site).
  const showReviews = rs.count >= 5 && rs.avg > 0;
  // 🔴 2026-08-19 — `trust` est un booléen de MISE EN PAGE (« ce gabarit affiche
  // un bandeau de confiance »), pas un drapeau de certification : six gabarits
  // (booking-completed-thanks, contract-signed, qualiopi-attestation-disponible,
  // qualiopi-suivi-j30, quote-signed, submission-reply) le passent en attribut
  // JSX nu. Le lockup « Organisme de formation certifié Qualiopi » partait donc
  // dans ces e-mails quoi qu'il arrive, alors que la certification n'est PAS
  // obtenue (6 non-conformités majeures au 2026-08-15) — cas qualifié d'ILLÉGAL
  // par l'en-tête de `server/qualiopi/config/flag.ts`.
  //
  // On conjugue les deux notions au lieu de remplacer l'une par l'autre : le
  // bandeau de confiance survit (il porte aussi la note avis, qui est vraie et
  // vérifiable), seule l'IMAGE de certification est conditionnée. Le bandeau
  // n'est rendu que s'il lui reste quelque chose à montrer, pour ne pas laisser
  // un cadre vide dans les clients mail.
  const afficherLockupQualiopi = isQualiopiCertificationObtenue();
  const avgFr = rs.avg.toFixed(1).replace(".", locale === "fr" ? "," : ".");
  const reviewLine = `★★★★★  ${avgFr}/5 — ${rs.count} ${t.reviewsWord}`;
  const orgLine = joinDefined([`${COMPANY.name} · ${t.legalForm}`, COMPANY.address], " — ");
  const idLine = joinDefined(
    [
      COMPANY.registration ? `${t.siret} ${COMPANY.registration}` : "",
      COMPANY.vat ? `${t.vat} ${COMPANY.vat}` : "",
      // 2026-08-17 — n° de déclaration d'activité. Les e-mails d'Axion-IA
      // portent des devis, des convocations et des relances : ce sont des
      // documents commerciaux d'un organisme de formation, la mention y est due.
      //
      // Constante de code, pas de configuration : ce pied de page est rendu dans
      // le worker, hors requête, sans accès garanti à la base — et le numéro ne
      // change pas.
      `${t.nda} ${NDA_NUMERO}`,
    ],
    "  ·  ",
  );
  // 🔴 Indissociable de la ligne ci-dessus, et jamais rendue sans elle. L'art.
  // L.6352-12 C. trav. interdit de faire état de l'enregistrement sans préciser
  // qu'il ne vaut pas agrément : publier le numéro seul dans un pied de page
  // commercial serait une infraction, pas un raccourci. Importée depuis la SSOT
  // des mentions plutôt que retapée — une formulation, un seul endroit.
  const ndaMention = MENTION_NON_AGREMENT;

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
            {trust && (afficherLockupQualiopi || showReviews) && (
              <Section style={trustBand} className="ax-trust">
                {afficherLockupQualiopi && (
                  <Img
                    src={QUALIOPI_LOCKUP}
                    width="340"
                    height="227"
                    alt={t.qualiopiAlt}
                    style={{ margin: "0 auto", display: "block", border: "0", maxWidth: "100%" }}
                  />
                )}
                {showReviews && <Text style={starsStyle}>{reviewLine}</Text>}
              </Section>
            )}
            {(snowball === "review" || snowball === "both") && (
              <Section style={snowballCard}>
                <Text style={snowballTitle} className="ax-heading">
                  {t.reviewTitle}
                </Text>
                <Text style={snowballText} className="ax-muted">
                  {t.reviewText}
                </Text>
                <Link href={REVIEW_URL} style={snowballLink}>
                  {t.reviewCta} →
                </Link>
              </Section>
            )}
            {(snowball === "referral" || snowball === "both") && (
              <Section style={snowballCard}>
                <Text style={snowballTitle} className="ax-heading">
                  {t.referralTitle}
                </Text>
                <Text style={snowballText} className="ax-muted">
                  {t.referralText}
                </Text>
                <Link href={LINKEDIN_SHARE} style={snowballLink}>
                  {t.referralCta} →
                </Link>
              </Section>
            )}
          </Container>

          {/* Footer social + légal */}
          <Section style={{ padding: "26px 12px 0 12px" }}>
            <Text style={socialRowStyle} className="ax-muted">
              {t.followBrand} —{" "}
              <Link href={SOCIALS.linkedinCompany} style={socialLinkStyle}>
                LinkedIn
              </Link>
              {" · "}
              <Link href={SOCIALS.facebookCompany} style={socialLinkStyle}>
                Facebook
              </Link>
              {" — "}
              {t.followFounder} :{" "}
              <Link href={SOCIALS.linkedinWilliams} style={socialLinkStyle}>
                LinkedIn
              </Link>
              {" · "}
              <Link href={SOCIALS.facebookWilliams} style={socialLinkStyle}>
                Facebook
              </Link>
            </Text>
            <Text style={footerStyle} className="ax-muted">
              {orgLine}
              {idLine ? (
                <>
                  <br />
                  {idLine}
                </>
              ) : null}
              <br />
              {ndaMention}
              <br />
              {t.contact}{" "}
              <Link
                href={`mailto:${CONTACT_EMAIL}`}
                style={{ color: C.orangeDeep, fontWeight: 600 }}
              >
                {CONTACT_EMAIL}
              </Link>
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
