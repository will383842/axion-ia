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

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "conditions-generales" as const;
// Date de dernière révision de FOND de cette page — à tenir à jour, les CGV
// renvoyant elles-mêmes à cette date pour déterminer la version applicable.
// Label affiché localisé ; `lastUpdatedIso` alimente <time dateTime>.
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

export default async function ConditionsGenerales({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const p = getLegal(SLUG);
  const copy = p[loc];
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
        sections={copy.sections}
        lastUpdated={isFr ? "30 juillet 2026" : "July 30, 2026"}
        lastUpdatedIso={LAST_UPDATED_ISO}
        relatedLinks={[
          { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
          {
            href: "/politique-confidentialite",
            label: isFr ? "Politique de confidentialité" : "Privacy policy",
          },
        ]}
      />
    </>
  );
}
