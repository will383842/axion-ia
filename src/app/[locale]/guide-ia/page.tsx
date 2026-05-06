import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/guide-ia",
    title:
      locale === "fr"
        ? "Guide IA entreprise · 40 pages · gratuit"
        : "Enterprise AI guide · 40 pages · free",
    description:
      locale === "fr"
        ? "Guide IA opérationnel 40 pages : usages, coûts, ROI, gouvernance, écueils."
        : "40-page operational AI guide: use cases, costs, ROI, governance, pitfalls.",
    alternates: { fr: "/guide-ia", en: "/ai-guide" },
  });
}

export default async function AiGuidePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const offerJsonLd = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: isFr ? "Guide IA entreprise · 40 pages" : "Enterprise AI guide · 40 pages",
    inLanguage: locale,
    price: "0",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
    url: `${SITE_URL}/${locale}/guide-ia`,
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Guide IA" : "AI guide", href: "/guide-ia" },
    ],
  });

  const chapters = isFr
    ? [
        "Comprendre l'IA générative en 2026",
        "Usages B2B prouvés (chatbot, OCR, RAG, agents)",
        "Coûts réels : OpenAI vs open-source vs custom",
        "Gouvernance données + souveraineté UE",
        "ROI : comment mesurer, par quoi commencer",
        "Écueils fréquents (8 anti-patterns à éviter)",
      ]
    : [
        "Understanding generative AI in 2026",
        "Proven B2B use cases (chatbot, OCR, RAG, agents)",
        "Real costs: OpenAI vs open-source vs custom",
        "Data governance + EU sovereignty",
        "ROI: how to measure, where to start",
        "Common pitfalls (8 anti-patterns to avoid)",
      ];

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Lead magnet · gratuit" : "Lead magnet · free"}
        title={
          isFr
            ? "Guide IA entreprise · 40 pages opérationnelles"
            : "Enterprise AI guide · 40 operational pages"
        }
        description={
          isFr
            ? "Tout ce qu'un dirigeant ou responsable opérations doit savoir avant de déployer l'IA en 2026. Téléchargement immédiat après inscription."
            : "Everything a CEO or operations lead must know before deploying AI in 2026. Instant download after signup."
        }
      />

      <Section eyebrow={isFr ? "Sommaire" : "Contents"}>
        <Container className="max-w-3xl">
          <ol className="border-border divide-border space-y-0 divide-y border-y">
            {chapters.map((c, i) => (
              <li key={c} className="flex items-baseline gap-3 py-3">
                <span className="text-primary font-mono text-sm tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-base text-gray-700">{c}</span>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Recevoir le PDF" : "Get the PDF"}>
        <Container className="max-w-2xl">
          <NewsletterForm
            labels={
              isFr
                ? {
                    email: "Email professionnel",
                    consent:
                      "J'accepte de recevoir le guide PDF et la newsletter mensuelle. Désinscription en un clic.",
                    submit: "Recevoir le guide",
                    sending: "Envoi…",
                    success: "Guide envoyé. Vérifiez votre boîte (et les spams).",
                    failure: "Erreur. Réessayez ou écrivez à contact@axion-ia.com.",
                  }
                : {
                    email: "Professional email",
                    consent:
                      "I agree to receive the PDF guide and monthly newsletter. One-click unsubscribe.",
                    submit: "Get the guide",
                    sending: "Sending…",
                    success: "Guide sent. Check your inbox (and spam).",
                    failure: "Error. Try again or email contact@axion-ia.com.",
                  }
            }
          />
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Préfèrez parler en direct ?" : "Prefer talking directly?"}
        description={
          isFr
            ? "Réservez l'Essentielle 490 € — identification de 3-5 quick-wins en une journée."
            : "Book the Essential €490 — identify 3-5 quick-wins in one day."
        }
        cta={
          <Cta href="/interventions/essentielle" variant="outline">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
      />

      <JsonLd data={offerJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
