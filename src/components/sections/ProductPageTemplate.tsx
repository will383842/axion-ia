import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
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

// Single template every product page (Module 1/2/3) plugs into. Keeps
// page files tiny (~10 lines each) and ensures structural parity for
// SEO/AEO + Lighthouse. JSON-LD is emitted via <JsonLd>.
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
              {copy.ctaPrimary} →
            </Cta>
            <Cta href={ctaSecondaryHref} variant="outline" size="lg">
              {copy.ctaSecondary}
            </Cta>
          </>
        }
      />

      <Section eyebrow={copy.benefitsTitle.toUpperCase()} title={copy.benefitsTitle}>
        <FeatureGrid items={copy.benefits.map((b, i) => ({ id: `b-${i}`, ...b }))} columns={3} />
      </Section>

      <Section eyebrow="Process" title={copy.processTitle}>
        <ProcessSteps steps={copy.processSteps.map((s, i) => ({ id: `s-${i}`, ...s }))} />
      </Section>

      <Section eyebrow="Metrics" title={copy.metricsTitle}>
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

      <FaqBlock title={copy.faqTitle} items={copy.faqs} emitJsonLd={false} />

      <CtaBlock
        title={copy.ctaBlockTitle}
        description={copy.ctaBlockDescription}
        cta={
          <Button asChild size="lg">
            <a href={ctaPrimaryHref}>{copy.ctaPrimary} →</a>
          </Button>
        }
        tone="dark"
      />

      <Container>
        {jsonLd.map((schema, idx) => (
          <JsonLd key={idx} data={schema} />
        ))}
      </Container>
    </>
  );
}
