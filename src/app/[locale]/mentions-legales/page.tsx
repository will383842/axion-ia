import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { LegalPageTemplate } from "@/components/sections/LegalPageTemplate";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getLegal } from "@/content/legal";
import { buildProductMetadata } from "@/lib/seo";
import { buildQualiopiCertificationsSection } from "@/components/qualiopi/certifications-section";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "mentions-legales" as const;
// ISR : la section « Certifications & agréments » dépend de la config Qualiopi
// + du flag Phase B (lus au runtime). Au build stub.invalid ils sont vides →
// section absente ; une fois la Phase B activée en prod, l'ISR repeuple la page
// sous 1 h sans rebuild. Cohérent avec le mécanisme Phase A/B du repo.
export const revalidate = 3600;
// Date de dernière révision éditoriale des pages légales (alignée sur la
// déclaration d'accessibilité, 6 mai 2026). À mettre à jour à chaque révision
// de fond. Label affiché localisé ; `lastUpdatedIso` alimente <time dateTime>.
const LAST_UPDATED_ISO = "2026-05-06";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const p = getLegal(SLUG);
  const c = p[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? p.pathFr : p.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: p.pathFr, en: p.pathEn },
  });
}

export default async function MentionsLegales({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const p = getLegal(SLUG);
  const copy = p[loc];
  // Section « Certifications & agréments » dérivée de la config Qualiopi —
  // `null` hors Phase B (cf. buildQualiopiCertificationsSection). Append aux
  // sections statiques sans muter `content/legal.ts`.
  const certifs = await buildQualiopiCertificationsSection(isFr);
  const sections = certifs ? [...copy.sections, certifs] : copy.sections;
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: isFr ? p.pathFr : p.pathEn, label: copy.title }];
  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <LegalPageTemplate
        isFr={isFr}
        locale={loc}
        canonicalPath={isFr ? p.pathFr : p.pathEn}
        title={copy.title}
        {...(copy.titleEm !== undefined ? { titleEm: copy.titleEm } : {})}
        intro={copy.intro}
        sections={sections}
        lastUpdated={isFr ? "6 mai 2026" : "May 6, 2026"}
        lastUpdatedIso={LAST_UPDATED_ISO}
        relatedLinks={[
          {
            href: "/conditions-generales",
            label: isFr ? "Conditions générales" : "Terms & conditions",
          },
          {
            href: "/politique-confidentialite",
            label: isFr ? "Politique de confidentialité" : "Privacy policy",
          },
          { href: "/contact", label: isFr ? "Contact" : "Contact" },
        ]}
      />
    </>
  );
}
