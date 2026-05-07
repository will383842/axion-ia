import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/accessibilite",
    title:
      locale === "fr"
        ? "Déclaration d'accessibilité · AxionIA"
        : "Accessibility statement · AxionIA",
    description:
      locale === "fr"
        ? "Déclaration de conformité WCAG 2.2 AA, audits, voies de recours."
        : "WCAG 2.2 AA conformance statement, audits, redress mechanisms.",
    alternates: { fr: "/accessibilite", en: "/accessibility" },
  });
}

export default async function AccessibilityPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: isFr ? "/accessibilite" : "/accessibility",
      label: isFr ? "Accessibilité" : "Accessibility",
    },
  ];

  const sections = isFr
    ? [
        {
          h: "Engagement",
          p: "AxionIA OÜ s'engage à rendre son site axion-ia.com accessible conformément aux Web Content Accessibility Guidelines 2.2 niveau AA (WCAG 2.2 AA), au RGAA 4.1 et aux exigences de l'European Accessibility Act (EAA, Directive UE 2019/882).",
        },
        {
          h: "État de conformité",
          p: "Le site est en conformité partielle avec WCAG 2.2 AA. Un audit indépendant via axe-core et tests assistance technique (NVDA, VoiceOver) est planifié au Sprint 21 pour mesure complète de la conformité.",
        },
        {
          h: "Contenus non accessibles connus",
          p: "Les pages programmatiques en cours d'enrichissement (catégories blog, articles d'aide) disposent de fixtures minimales. Le walkthrough utilisateur final reste à valider en runtime — Sprint 21.",
        },
        {
          h: "Voies de recours",
          p: "Pour signaler un problème d'accessibilité ou demander une version alternative d'un contenu, contactez-nous à accessibilite@axion-ia.com. Réponse sous 5 jours ouvrés. En l'absence de réponse satisfaisante, vous pouvez saisir le Défenseur des droits (France) ou l'autorité équivalente de votre État membre UE.",
        },
        {
          h: "Technologies utilisées",
          p: "Le site repose sur Next.js 16, React 19.2, Tailwind v4, semantic HTML5, ARIA 1.2. Le contenu est servi en HTML statique partiellement pré-rendu (SSG), avec des îles client justifiées pour les interactions (calendrier, simulateur, formulaires).",
        },
        {
          h: "Date de mise à jour",
          p: "Cette déclaration a été établie le 6 mai 2026 et sera mise à jour après chaque audit Sprint 21 et après chaque évolution majeure du site.",
        },
      ]
    : [
        {
          h: "Commitment",
          p: "AxionIA OÜ is committed to making its axion-ia.com website accessible in accordance with Web Content Accessibility Guidelines 2.2 Level AA (WCAG 2.2 AA), RGAA 4.1, and the European Accessibility Act (EAA, EU Directive 2019/882).",
        },
        {
          h: "Conformance status",
          p: "The site partially conforms with WCAG 2.2 AA. An independent audit using axe-core and assistive-tech tests (NVDA, VoiceOver) is scheduled in Sprint 21 for complete conformance measurement.",
        },
        {
          h: "Known non-accessible content",
          p: "Programmatic pages currently being enriched (blog categories, help articles) have minimal fixtures. Final user walkthrough is to be validated at runtime — Sprint 21.",
        },
        {
          h: "Redress mechanisms",
          p: "To report an accessibility issue or request an alternative version of content, contact accessibilite@axion-ia.com. Response within 5 business days. If response is unsatisfactory, you may file a complaint with the Défenseur des droits (France) or the equivalent authority in your EU member state.",
        },
        {
          h: "Technologies used",
          p: "The site is built on Next.js 16, React 19.2, Tailwind v4, semantic HTML5, ARIA 1.2. Content is served as partially pre-rendered static HTML (SSG), with justified client islands for interactions (calendar, simulator, forms).",
        },
        {
          h: "Last updated",
          p: "This statement was last updated on May 6, 2026 and will be updated after each Sprint 21 audit and each major site evolution.",
        },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Conformité" : "Conformance"}
        title={isFr ? "Déclaration" : "Accessibility"}
        titleEm={isFr ? "d'accessibilité" : "statement"}
        description={
          isFr
            ? "WCAG 2.2 AA, RGAA 4.1, European Accessibility Act."
            : "WCAG 2.2 AA, RGAA 4.1, European Accessibility Act."
        }
      />

      <Section>
        <Container className="max-w-3xl">
          <div className="space-y-10">
            {sections.map((s) => (
              <section key={s.h} className="space-y-3">
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {s.h}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{s.p}</p>
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
