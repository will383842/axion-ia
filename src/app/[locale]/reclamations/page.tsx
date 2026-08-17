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

const SLUG = "reclamations" as const;
// Date de dernière révision éditoriale de CETTE page. À mettre à jour à chaque
// révision de fond. Label affiché localisé ; `lastUpdatedIso` alimente
// <time dateTime>.
//
// 🔴 Audit blanc 2026-08-15 — la procédure publiée a été refondue ce jour
// (élargissement aux difficultés et aux aléas, section « Aléas survenus en
// cours de prestation », voies de recours externes : cf. `src/content/legal.ts`,
// entrée « reclamations »). La page affichait encore « 6 mai 2026 », date de
// l'alignement éditorial d'ensemble des pages légales. Une procédure
// substantiellement révisée qui affiche une date antérieure à sa révision est,
// à elle seule, un constat de document non maîtrisé.
const LAST_UPDATED_ISO = "2026-08-15";

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

export default async function Reclamations({ params }: Props) {
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
        lastUpdated={isFr ? "15 août 2026" : "August 15, 2026"}
        lastUpdatedIso={LAST_UPDATED_ISO}
        relatedLinks={[
          {
            href: "/reglement-interieur",
            label: isFr ? "Règlement intérieur" : "Internal regulations",
          },
          {
            href: "/conditions-generales",
            label: isFr ? "Conditions générales" : "Terms & conditions",
          },
          { href: "/contact", label: isFr ? "Contact" : "Contact" },
        ]}
      />
    </>
  );
}
