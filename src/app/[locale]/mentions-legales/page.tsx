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
import {
  buildDeclarationActiviteSection,
  buildQualiopiCertificationsSection,
} from "@/components/qualiopi/certifications-section";
import { resolveLegalIdentity, buildLegalIdentitySections } from "@/lib/legal-identity";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "mentions-legales" as const;
// ISR : la section « Certifications & agréments » dépend de la config Qualiopi
// + du flag Phase B (lus au runtime). Au build stub.invalid ils sont vides →
// section absente ; une fois la Phase B activée en prod, l'ISR repeuple la page
// sous 1 h sans rebuild. Cohérent avec le mécanisme Phase A/B du repo.
export const revalidate = 3600;
// Date de dernière révision de FOND de cette page — à tenir à jour à chaque
// modification substantielle. Label affiché localisé ; `lastUpdatedIso`
// alimente <time dateTime>.
//
// 2026-07-30 : révision du paragraphe « médiation de la consommation ». La
// valeur précédente était calquée sur la déclaration d'accessibilité ; les
// deux pages évoluent séparément, elles ne sont plus liées.
const LAST_UPDATED_ISO = "2026-07-30";

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
  // Sections d'identité (« Éditeur » + « Directeur de la publication ») résolues
  // au runtime depuis le SiteSetting `legal_overrides` (même clé que les
  // factures). Préfixées aux sections statiques. ISR `revalidate=3600` →
  // mise à jour < 1 h dès que Will renseigne l'identité en console admin.
  const identity = await resolveLegalIdentity();
  const identitySections = buildLegalIdentitySections(identity, isFr);
  // Section « Déclaration d'activité » (NDA + mention L.6352-12) et section
  // « Certifications & agréments » (Qualiopi). DEUX sections distinctes, et
  // deux gardes distinctes : le NDA s'affiche dès que le numéro existe, la
  // certification seulement quand elle est réellement obtenue. Les confondre
  // avait rendu le NDA invisible jusqu'au 2026-08-17.
  const [declaration, certifs] = await Promise.all([
    buildDeclarationActiviteSection(isFr),
    buildQualiopiCertificationsSection(isFr),
  ]);
  const sections = [
    ...identitySections,
    ...copy.sections,
    ...(declaration ? [declaration] : []),
    ...(certifs ? [certifs] : []),
  ];
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
        lastUpdated={isFr ? "30 juillet 2026" : "July 30, 2026"}
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
          {
            href: "/accessibilite",
            label: isFr ? "Déclaration d'accessibilité" : "Accessibility statement",
          },
          { href: "/contact", label: isFr ? "Contact" : "Contact" },
        ]}
      />
    </>
  );
}
