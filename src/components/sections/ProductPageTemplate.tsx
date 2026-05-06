import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { ProductHero } from "./ProductHero";
import { FeatureGrid } from "./FeatureGrid";
import { ProcessSteps } from "./ProcessSteps";
import { MetricsRow } from "./MetricsRow";
import { FaqBlock } from "./FaqBlock";
import { CtaBlock } from "./CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";

interface ProductPageTemplateProps {
  accent: "primary" | "purple" | "orange" | "green";
  copy: {
    eyebrow: string;
    title: string;
    answer: string;
    priceEur?: number;
    ctaPrimary: string;
    ctaSecondary: string;
    benefitsTitle: string;
    benefits: ReadonlyArray<{ title: string; description: string }>;
    processTitle: string;
    processSteps: ReadonlyArray<{ title: string; description: string }>;
    metricsTitle: string;
    metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
    faqTitle: string;
    faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
    ctaBlockTitle: string;
    ctaBlockDescription: string;
  };
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  jsonLd?: ReadonlyArray<Record<string, unknown>>;
}

// Editorial v3 — alternance auto des sections paper/sand/halo-cool/canvas/mocha
// pour rythme visuel. Toutes les pages produits (Module 1/2/3, ~21 pages)
// héritent automatiquement de cette doctrine.
export function ProductPageTemplate({
  accent,
  copy,
  ctaPrimaryHref,
  ctaSecondaryHref,
  jsonLd = [],
}: ProductPageTemplateProps) {
  const metricsVariant: "primary" | "purple" | "orange" | "green" = accent;
  return (
    <>
      <ProductHero
        eyebrow={copy.eyebrow}
        accent={accent}
        title={copy.title}
        answer={copy.answer}
        {...(typeof copy.priceEur === "number"
          ? { priceEur: copy.priceEur, priceSuffix: "HT" }
          : {})}
        cta={
          <>
            <Cta href={ctaPrimaryHref} size="lg">
              {copy.ctaPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href={ctaSecondaryHref} variant="outline" size="lg">
              {copy.ctaSecondary}
            </Cta>
          </>
        }
      />

      {/* Bénéfices — paper white pour respiration */}
      <Section tone="paper" eyebrow={copy.benefitsTitle.toUpperCase()} title={copy.benefitsTitle}>
        <FeatureGrid items={copy.benefits.map((b, i) => ({ id: `b-${i}`, ...b }))} columns={3} />
      </Section>

      {/* Process — sand intermission */}
      <Section tone="sand" eyebrow="Process" title={copy.processTitle}>
        <ProcessSteps steps={copy.processSteps.map((s, i) => ({ id: `s-${i}`, ...s }))} />
      </Section>

      {/* Metrics — mocha riche pour gros contraste */}
      <Section tone="mocha" eyebrow="Chiffres" title={copy.metricsTitle}>
        <MetricsRow
          stats={copy.metrics.map((m, i) => ({
            id: `m-${i}`,
            number: m.number,
            suffix: m.suffix,
            label: m.label,
            variant: metricsVariant,
          }))}
        />
      </Section>

      {/* FAQ — canvas pour repos */}
      <FaqBlock title={copy.faqTitle} items={copy.faqs} emitJsonLd={false} tone="canvas" />

      {/* CTA final — mocha riche signature */}
      <CtaBlock
        title={copy.ctaBlockTitle}
        description={copy.ctaBlockDescription}
        cta={
          <Cta href={ctaPrimaryHref} size="lg">
            {copy.ctaPrimary}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
        }
        tone="mocha"
      />

      <Container>
        {jsonLd.map((schema, idx) => (
          <JsonLd key={idx} data={schema} />
        ))}
      </Container>
    </>
  );
}
