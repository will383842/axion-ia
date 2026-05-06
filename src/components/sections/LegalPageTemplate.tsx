import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";

interface LegalPageTemplateProps {
  title: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  lastUpdated?: string;
}

// Editorial v3 — sober, max-w-3xl, body Manrope + h2 sans-serif (legal pages
// stay business-like, no serif here for legibility / quick scan).
export function LegalPageTemplate({ title, intro, sections, lastUpdated }: LegalPageTemplateProps) {
  return (
    <>
      <Section tone="halo-warm" eyebrow="Légal" title={title} description={intro} />

      <Section tone="paper">
        <Container className="max-w-3xl">
          {lastUpdated ? (
            <p className="text-fg-muted mb-10 text-[11px] tracking-[0.16em] uppercase">
              Dernière mise à jour : {lastUpdated}
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
