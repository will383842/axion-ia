import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUTOMATISATIONS, getAutomatisationByLocaleSlug } from "@/content/automatisations";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Slugs traduits par locale : EN utilise `customer-service` au lieu de
// `service-client` (cf. `automatisations.ts` `pathEn`). On émet ici les
// params correspondant au slug DE LA LOCALE, pas le slug FR canonique.
export function generateStaticParams() {
  return AUTOMATISATIONS.flatMap((cat) =>
    routing.locales.map((locale) => ({
      locale,
      slug: (locale === "fr" ? cat.pathFr : cat.pathEn).split("/").pop()!,
    })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const cat = getAutomatisationByLocaleSlug(slug);
  if (!cat) return {};
  const c = cat[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? cat.pathFr : cat.pathEn,
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { fr: cat.pathFr, en: cat.pathEn },
  });
}

export default async function AutomatisationCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const cat = getAutomatisationByLocaleSlug(slug);
  if (!cat) notFound();
  const copy = cat[loc];

  // Breadcrumb href doit pointer sur le path local (FR ou EN), pas
  // hardcoder le path FR — sinon le breadcrumb HTML EN pointe vers
  // une URL FR (anti-pattern hreflang).
  const detailPath = isFr ? cat.pathFr : cat.pathEn;
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/implementation",
      label: isFr ? "Implémentation IA" : "AI implementation",
    },
    { href: detailPath, label: copy.cardTitle },
  ];

  // Service JSON-LD — la page représente une catégorie d'automatisations
  // proposées comme service (pattern aligné /audit, /interventions). Sans
  // priceEur car le devis est forfaitaire variable par item.
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: detailPath,
    name: copy.metaTitle,
    description: copy.metaDescription,
    serviceType: isFr ? "Automatisation IA" : "AI automation",
    area: "FR/EU",
  });

  // ItemList JSON-LD — expose les automatisations du catalogue de la
  // catégorie au crawler (AEO/GEO 2026 : LLMs résolvent « quelles
  // automatisations IA AxionIA sur la fonction X ? »). Items sans URL
  // car ils n'ont pas de page dédiée — name + description suffisent
  // pour citabilité.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.itemsTitle,
    url: `${SITE_URL}/${loc}${detailPath}`,
    numberOfItems: copy.items.length,
    itemListElement: copy.items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: item.title,
        description: item.benefit,
        audience: { "@type": "Audience", audienceType: item.audience },
      },
    })),
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={copy.eyebrow}
        title={copy.pageTitle}
        titleEm={copy.pageTitleEm}
        description={copy.pageDescription}
      />

      <Section
        eyebrow={isFr ? "Catalogue" : "Catalogue"}
        title={copy.itemsTitle}
        description={copy.intro}
      >
        <ul className="grid gap-6 md:grid-cols-2">
          {copy.items.map((item, idx) => (
            <li
              key={idx}
              className="border-border bg-paper relative flex flex-col gap-4 rounded-2xl border p-7 transition-shadow hover:shadow-lg sm:p-8"
            >
              <span
                aria-hidden="true"
                className="text-fg-muted absolute top-6 right-6 text-xs font-medium tracking-[0.18em] uppercase"
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3
                className="text-fg max-w-[85%] text-[1.4rem] leading-tight font-medium"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.title}
              </h3>
              <p className="text-fg-soft text-base leading-relaxed">{item.benefit}</p>
              <p className="text-terracotta-deep border-border mt-auto border-t pt-3 text-xs font-medium tracking-wide uppercase">
                {item.audience}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        tone="sand"
        eyebrow={isFr ? "Sur mesure" : "Custom"}
        title={copy.customTitle}
        description={copy.customDescription}
      >
        <div className="flex flex-wrap gap-4">
          <Cta href="/contact" size="lg">
            {isFr ? "Décrire mon besoin" : "Describe my need"} →
          </Cta>
          <Cta href="/audit" size="lg" variant="outline">
            {isFr ? "Commencer par un audit" : "Start with an audit"}
          </Cta>
        </div>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Forfait fixe · sans abonnement" : "Fixed fee · no subscription"}
        title={isFr ? "Vous payez une fois." : "You pay"}
        titleEm={isFr ? "C'est à vous." : "once."}
        titleTail={isFr ? "" : " It's yours."}
        description={
          isFr
            ? "Devis ferme avant de démarrer. Livraison entre 2 et 6 semaines selon la complexité. Formation incluse. Pas de maintenance mensuelle imposée."
            : "Firm quote before kick-off. Delivery in 2 to 6 weeks depending on complexity. Training included. No imposed monthly maintenance."
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Demander un devis" : "Request a quote"} →
          </Cta>
        }
        tone="mocha"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
