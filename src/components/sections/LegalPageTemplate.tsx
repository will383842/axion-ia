import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";

interface LegalPageTemplateProps {
  isFr: boolean;
  title: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  lastUpdated?: string;
}

// Editorial v3 — sober body (max-w-3xl, h2 sans-serif) preserved for legal
// legibility / quick scan. Hero promoted to canonical page hero (h1 +
// display-editorial + halo-warm decoration) so legal pages share the same
// visual weight as the rest of the site.
export function LegalPageTemplate({
  isFr,
  title,
  intro,
  sections,
  lastUpdated,
}: LegalPageTemplateProps) {
  return (
    <>
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={isFr ? "Légal" : "Legal"}
        title={title}
        description={intro}
      />

      <Section tone="paper">
        <Container className="max-w-3xl">
          {lastUpdated ? (
            <p className="text-fg-muted mb-10 text-[11px] tracking-[0.16em] uppercase">
              {isFr ? "Dernière mise à jour : " : "Last updated: "}
              {lastUpdated}
            </p>
          ) : null}
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
