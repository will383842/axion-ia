import * as React from "react";
import { Mail, Languages, Clock } from "lucide-react";
import { Container } from "@/components/layout/Container";

interface PressContactProps {
  /** Localized labels — section editorial v3. */
  labels: {
    eyebrow: string;
    title: React.ReactNode;
    titleEm?: React.ReactNode;
    titleTail?: React.ReactNode;
    description: string;
    /** "Écrire à la presse" / "Email the press desk" */
    cta: string;
    /** Press email — kept literal so it appears in JSON-LD `mailto:` and copy. */
    email: string;
    /** Mailto subject prefilled. */
    subjectLabel: string;
    /** "Délai de réponse" / "Response time" */
    responseTimeLabel: string;
    /** "48 h ouvrées" / "48 business hours" */
    responseTimeValue: string;
    /** "Langues" / "Languages" */
    languagesLabel: string;
    /** "FR · EN" */
    languagesValue: string;
  };
}

// Press contact band — éditorial v3, mocha-rich tone with terracotta-soft
// accents. Mirrors the home `<CtaBlock>` pattern but adds a 3-fact info grid
// (email, response SLA, languages) tailored for journalists.
export function PressContact({ labels }: PressContactProps) {
  const mailto = `mailto:${labels.email}?subject=${encodeURIComponent(labels.subjectLabel)}`;

  return (
    <section
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative overflow-hidden py-24 sm:py-28 lg:py-36"
    >
      <Container className="relative">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta-soft mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {labels.eyebrow}
            </p>
            <h2 className="text-mocha-fg text-[clamp(2.25rem,5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {labels.title}
              {labels.titleEm ? (
                <span
                  className="text-terracotta-soft italic"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                >
                  {labels.titleEm}
                </span>
              ) : null}
              {labels.titleTail}
            </h2>
            <p className="text-mocha-fg/85 mt-6 max-w-xl text-lg leading-relaxed">
              {labels.description}
            </p>
            <a
              href={mailto}
              className="bg-terracotta-soft text-mocha hover:bg-terracotta hover:text-mocha-fg focus-visible:ring-terracotta-soft focus-visible:ring-offset-mocha cta-lift mt-10 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {labels.cta}
            </a>
            <p className="text-mocha-fg/70 mt-4 text-sm">{labels.email}</p>
          </div>

          <dl className="border-border-on-mocha grid gap-6 border-t pt-8 sm:grid-cols-3 lg:grid-cols-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <div className="flex items-start gap-4">
              <Mail className="text-terracotta-soft mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-mocha-fg/70 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  Email
                </dt>
                <dd className="text-mocha-fg mt-1.5 text-sm font-semibold break-all">
                  {labels.email}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Clock className="text-terracotta-soft mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-mocha-fg/70 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {labels.responseTimeLabel}
                </dt>
                <dd className="text-mocha-fg mt-1.5 text-sm font-semibold">
                  {labels.responseTimeValue}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Languages
                className="text-terracotta-soft mt-1 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <dt className="text-mocha-fg/70 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {labels.languagesLabel}
                </dt>
                <dd className="text-mocha-fg mt-1.5 text-sm font-semibold">
                  {labels.languagesValue}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}
