import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { FileText, BookOpen, Tag, RefreshCw } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

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
        ? "Guide IA opérationnel de 40 pages pour dirigeants et équipes : cas d'usage concrets, coûts réels, calcul du ROI, gouvernance, sécurité et écueils à éviter."
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

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/guide-ia", label: isFr ? "Guide IA" : "AI guide" }];

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

  // CreativeWork JSON-LD enrichi avec hasPart (chapters) — AEO/GEO 2026 :
  // expose la structure du guide aux LLMs pour citations granulaires
  // (« quel chapitre du guide Axion-IA traite des coûts ? »). Plus rich
  // que l'ancien Offer plat — combine Offer (gratuit) + CreativeWork
  // (table des matières structurée).
  const guideJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: isFr ? "Guide IA entreprise · 40 pages" : "Enterprise AI guide · 40 pages",
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/guide-ia`,
    publisher: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    numberOfPages: 40,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    },
    hasPart: chapters.map((title, idx) => ({
      "@type": "Chapter",
      position: idx + 1,
      name: title,
      isPartOf: { "@type": "CreativeWork", name: "Guide IA Axion-IA" },
    })),
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Lead magnet · gratuit" : "Lead magnet · free"}
        title={isFr ? "Guide IA entreprise · 40 pages" : "Enterprise AI guide · 40 pages"}
        titleEm={isFr ? "opérationnel" : "operational"}
        description={
          isFr
            ? "Tout ce qu'un dirigeant ou responsable opérations doit savoir avant de déployer l'IA en 2026. Téléchargement immédiat après inscription."
            : "Everything a CEO or operations lead must know before deploying AI in 2026. Instant download after signup."
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: FileText, label: isFr ? "40 pages PDF" : "40 PDF pages" },
              {
                icon: BookOpen,
                label: isFr ? `${chapters.length} chapitres` : `${chapters.length} chapters`,
              },
              { icon: Tag, label: isFr ? "100 % gratuit" : "100% free" },
              { icon: RefreshCw, label: isFr ? "MAJ semestrielle" : "Bi-annual updates" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section tone="halo-warm">
        <Container className="max-w-4xl">
          <Illustration
            slot="GUIDE-01-hero"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/guide-ia-hero.avif"
            caption={
              isFr
                ? "Couverture éditoriale — livre opérationnel ouvert sur table claire"
                : "Editorial cover — operational book open on a light table"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'une couverture de livre opérationnel ouverte, symbole du guide IA Axion-IA 40 pages."
                : "Editorial illustration of an open operational book cover, symbol of the 40-page Axion-IA AI guide."
            }
            priority
          />
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Sommaire" : "Contents"}>
        <Container className="max-w-3xl">
          <ol className="border-border divide-border space-y-0 divide-y border-y">
            {chapters.map((c, i) => (
              <li key={c} className="flex items-baseline gap-3 py-3">
                <span className="text-primary font-mono text-sm tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-fg-soft text-base">{c}</span>
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

      {/* P1-15 audit E2E NAV+CTA 2026-05-15 — sources externes E-E-A-T 2026.
          Booste signal AEO/GEO (citations Claude.ai/Perplexity/SGE) en pointant
          vers sources autoritaires INSEE/gouv.fr/EU AI Act. Tous les liens
          externes ont `rel="noopener noreferrer"` + `target="_blank"`
          (sécurité tabnabbing). Aucun lien vers concurrents directs. */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Sources & références" : "Sources & references"}
        title={isFr ? "Lectures complémentaires" : "Further reading"}
      >
        <Container className="max-w-3xl">
          <ul className="text-fg-soft space-y-3 text-base leading-relaxed">
            <li>
              <a
                href="https://artificialintelligenceact.eu/"
                target="_blank"
                rel="noopener noreferrer external"
                className="text-primary hover:underline"
              >
                EU AI Act — Texte officiel
              </a>
              {" — "}
              {isFr
                ? "obligations de transparence + classification des risques (entré en vigueur 2024, applicable progressivement 2025-2026)."
                : "transparency requirements + risk classification (in force 2024, phased rollout 2025-2026)."}
            </li>
            <li>
              <a
                href="https://www.insee.fr/fr/statistiques/8244185"
                target="_blank"
                rel="noopener noreferrer external"
                className="text-primary hover:underline"
              >
                INSEE — Tissu entrepreneurial français
              </a>
              {" — "}
              {isFr
                ? "données officielles PME/ETI référencées par toutes nos pages pSEO villes/régions."
                : "official SME / mid-market data referenced by all our city/region pSEO pages."}
            </li>
            <li>
              <a
                href="https://www.economie.gouv.fr/intelligence-artificielle"
                target="_blank"
                rel="noopener noreferrer external"
                className="text-primary hover:underline"
              >
                Ministère de l&apos;Économie — Plan France IA
              </a>
              {" — "}
              {isFr
                ? "feuille de route gouvernementale française 2024-2030."
                : "French government roadmap 2024-2030."}
            </li>
            <li>
              <a
                href="https://docs.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer external"
                className="text-primary hover:underline"
              >
                Anthropic — Documentation Claude
              </a>
              {" — "}
              {isFr
                ? "stack technique LLM que nous déployons en priorité (Claude Sonnet 4.6 / Opus 4.7)."
                : "the LLM technical stack we deploy first (Claude Sonnet 4.6 / Opus 4.7)."}
            </li>
          </ul>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="GUIDE-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/guide-ia-closing.avif"
            caption={
              isFr
                ? "Page tournée — passer du guide à l'application concrète"
                : "Turning the page — moving from guide to concrete application"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'une page de livre tournée, symbole du passage du guide à l'application IA concrète."
                : "Editorial illustration of a turning book page, symbolizing the move from guide to concrete AI application."
            }
          />
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Préfèrez parler en direct ?" : "Prefer talking directly?"}
        description={
          isFr
            ? "Réservez notre formation en groupe — identification de 3-5 quick-wins en une journée."
            : "Book our group training — identify 3-5 quick-wins in one day."
        }
        cta={
          <Cta href="/formations" variant="outline">
            {isFr ? "Voir nos formations" : "See our trainings"} →
          </Cta>
        }
      />

      <JsonLd data={guideJsonLd} />
    </>
  );
}
