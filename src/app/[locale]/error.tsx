"use client";
// use-client: Next.js requires error boundaries to be Client Components.

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, RefreshCcw } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// 500 locale-scoped — doctrine v3 (halo-warm + eyebrow dot + titleEm italique).
export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Sprint 21 wires Sentry capture here. For now we log to the browser.
    console.error("[locale/error]", error);
  }, [error]);

  return (
    <Section
      titleAs="h1"
      eyebrow={t("internalEyebrow")}
      title={t("internalTitle")}
      titleEm={t("internalTitleEm")}
      description={t("internalBody")}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={reset} type="button" size="lg" shape="pill">
          <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          {t("retry")}
        </Button>
        <Cta href="/" variant="outline" size="lg">
          {t("backHome")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
      </div>

      {error.digest ? (
        <p className="text-fg-muted mt-10 font-mono text-xs">ref: {error.digest}</p>
      ) : null}

      <div className="mt-14 max-w-2xl">
        <p className="text-fg-muted mb-5 text-[12px] font-semibold tracking-[0.16em] uppercase">
          {t("notFoundSuggestionsTitle")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/interventions", label: t("notFoundLinkInterventions") },
            { href: "/audit", label: t("notFoundLinkAudit") },
            { href: "/cas-concrets", label: t("notFoundLinkCases") },
            { href: "/appel", label: t("notFoundLinkBook") },
          ].map((s) => (
            <li key={s.href}>
              <Link
                href={s.href as never}
                className="bg-paper border-border hover:border-terracotta hover:shadow-card group flex items-center justify-between rounded-xl border px-5 py-4 text-sm font-semibold transition-all"
              >
                <span className="text-fg">{s.label}</span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-terracotta-deep h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
