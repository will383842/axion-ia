import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";

interface LegalPageTemplateProps {
  title: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  lastUpdated?: string;
}

// Shared template for the 6 legal pages — long-form text only, max-w-3xl,
// well-structured h2 sections so screen readers and search engines can index
// the structure correctly.
export function LegalPageTemplate({ title, intro, sections, lastUpdated }: LegalPageTemplateProps) {
  return (
    <>
      <Section eyebrow="Légal" title={title} description={intro} />

      <Section>
        <Container className="max-w-3xl">
          {lastUpdated ? (
            <p className="mb-8 text-xs tracking-wide text-gray-600 uppercase">
              Dernière mise à jour : {lastUpdated}
            </p>
          ) : null}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="text-base leading-relaxed text-gray-700">{section.body}</p>
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
