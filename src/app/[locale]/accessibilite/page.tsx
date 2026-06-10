import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { HANDICAP_PARTENAIRES } from "@/server/qualiopi/legal/legal-mentions";

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
        ? "Déclaration d'accessibilité · Axion-IA"
        : "Accessibility statement · Axion-IA",
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
          p: "Axion-IA s'engage à rendre son site axion-ia.com accessible conformément aux Web Content Accessibility Guidelines 2.2 niveau AA (WCAG 2.2 AA), au RGAA 4.1 et aux exigences de l'European Accessibility Act (EAA, Directive UE 2019/882).",
        },
        {
          h: "État de conformité",
          p: "Axion-IA vise la conformité WCAG 2.2 AA / RGAA 4.1. Un audit de conformité complet n'a pas encore été réalisé ; le niveau actuel est donc déclaré en conformité partielle / non audité à ce jour. Un audit indépendant via axe-core et tests d'assistance technique (NVDA, VoiceOver) est prévu pour mesurer le taux de conformité réel.",
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
          p: "Axion-IA is committed to making its axion-ia.com website accessible in accordance with Web Content Accessibility Guidelines 2.2 Level AA (WCAG 2.2 AA), RGAA 4.1, and the European Accessibility Act (EAA, EU Directive 2019/882).",
        },
        {
          h: "Conformance status",
          p: "Axion-IA aims for WCAG 2.2 AA / RGAA 4.1 conformance. A full conformance audit has not yet been carried out; the current level is therefore declared as partially conformant / not audited to date. An independent audit using axe-core and assistive-tech tests (NVDA, VoiceOver) is planned to measure the actual conformance level.",
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

  // WebPage JSON-LD (schema.org n'a pas de type dédié pour une déclaration
  // d'accessibilité — on utilise WebPage). Le BreadcrumbList est émis par
  // le composant Breadcrumbs ci-dessous, on ne le duplique pas.
  const canonicalPath = isFr ? "/accessibilite" : "/accessibility";
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/${loc}${canonicalPath}`,
    url: `${SITE_URL}/${loc}${canonicalPath}`,
    name: isFr ? "Déclaration d'accessibilité" : "Accessibility statement",
    inLanguage: loc,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    dateModified: SITE_EDITORIAL_DATE,
  };

  return (
    <>
      <JsonLd data={webPageJsonLd} />
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
          <p className="text-fg-muted mb-10 text-[11px] tracking-[0.16em] uppercase">
            {isFr ? "Dernière mise à jour : " : "Last updated: "}
            <time dateTime="2026-05-06">{isFr ? "6 mai 2026" : "May 6, 2026"}</time>
          </p>
          <div className="space-y-10">
            {sections.map((s) => (
              <section key={s.h} className="space-y-3">
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {s.h}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{s.p}</p>
              </section>
            ))}

            {/* Accessibilité des formations & situation de handicap (Qualiopi n°26).
                Distinct de l'accessibilité numérique ci-dessus : relais d'orientation
                pour les stagiaires en situation de handicap. */}
            <section className="space-y-3">
              <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                {isFr
                  ? "Accessibilité des formations & situation de handicap"
                  : "Training accessibility & disability"}
              </h2>
              <p className="text-fg-soft text-base leading-relaxed">
                {isFr
                  ? "Nous nous engageons à rendre nos formations accessibles à toutes et tous. Si vous êtes en situation de handicap ou avez des besoins spécifiques, notre référent handicap étudie avec vous les aménagements possibles — contactez-nous avant le début de la formation. Nous pouvons aussi vous orienter vers les relais spécialisés suivants :"
                  : "We are committed to making our training accessible to everyone. If you have a disability or specific needs, our disability officer will assess possible accommodations with you — please contact us before the training starts. We can also refer you to the following specialised bodies:"}
              </p>
              <ul className="text-fg-soft space-y-2 text-base leading-relaxed">
                {HANDICAP_PARTENAIRES.map((p) => (
                  <li key={p.nom}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta hover:text-terracotta-deep font-medium underline-offset-4 hover:underline"
                    >
                      {p.nom}
                    </a>{" "}
                    — {p.role}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <nav
            aria-label={isFr ? "Voir aussi" : "See also"}
            className="border-border mt-16 border-t pt-8"
          >
            <p className="text-fg-muted mb-4 text-[11px] tracking-[0.16em] uppercase">
              {isFr ? "Voir aussi" : "See also"}
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link
                  href="/contact"
                  className="text-terracotta hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
                >
                  {isFr ? "Contact" : "Contact"}
                </Link>
              </li>
              <li>
                <Link
                  href="/mentions-legales"
                  className="text-terracotta hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
                >
                  {isFr ? "Mentions légales" : "Legal notice"}
                </Link>
              </li>
            </ul>
          </nav>
        </Container>
      </Section>
    </>
  );
}
