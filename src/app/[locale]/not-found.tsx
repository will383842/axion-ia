import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";

// 404 locale-scoped — doctrine v3 (halo-warm + eyebrow + dot terracotta +
// titleEm italique terracotta serif + suggestions de pages + CTAs pill).
export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  const suggestions = [
    { href: "/interventions", label: t("notFoundLinkInterventions") },
    { href: "/audit", label: t("notFoundLinkAudit") },
    { href: "/cas-concrets", label: t("notFoundLinkCases") },
    { href: "/reserver", label: t("notFoundLinkBook") },
  ] as const;

  return (
    <Section
      titleAs="h1"
      eyebrow={t("notFoundEyebrow")}
      title={t("notFoundTitle")}
      titleEm={t("notFoundTitleEm")}
      description={t("notFoundBody")}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Cta href="/" size="lg">
          {t("notFoundCta")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
        <Cta href="/contact" variant="outline" size="lg">
          {t("notFoundSecondary")}
        </Cta>
      </div>

      <div className="mt-14 max-w-2xl">
        <p className="text-fg-muted mb-5 text-[12px] font-semibold tracking-[0.16em] uppercase">
          {t("notFoundSuggestionsTitle")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((s) => (
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
