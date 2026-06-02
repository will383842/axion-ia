// Server component — section fondateur William (crédibilité + Top 1 %).
// Réutilisable home / régions / villes. Lit le namespace i18n "home" via
// `getTranslations("home")` pour rester en synchro avec la home (clés
// founderEyebrow, founderTitleLine1, founderTitleLine2, founderDescription,
// founderTagline, founderName, founderRole, founderPhotoAlt, founderStat1-3).

import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { Illustration } from "@/components/visual/Illustration";
import { Link } from "@/i18n/navigation";
import { FadeInOnView } from "@/components/motion/FadeInOnView";

interface FounderTrustSectionProps {
  isFr: boolean;
}

export async function FounderTrustSection({ isFr }: FounderTrustSectionProps) {
  const t = await getTranslations("home");

  return (
    <section
      aria-labelledby="founder-heading"
      className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <FadeInOnView>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Colonne gauche : copy */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {t("founderEyebrow")}
              </p>
              <h2
                id="founder-heading"
                className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {t("founderTitleLine1")}
                <br />
                <span className="text-terracotta italic">{t("founderTitleLine2")}</span>
              </h2>
              <p className="text-fg-soft mt-7 text-lg leading-relaxed">{t("founderDescription")}</p>
              <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full"
                />
                <p
                  className="text-fg-soft text-base leading-relaxed italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("founderTagline")}
                </p>
              </div>
              <p className="mt-6">
                <Link
                  href="/a-propos"
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {isFr ? "Découvrir notre approche complète" : "Discover our full approach"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </p>
            </div>

            {/* Colonne droite : carte fondateur */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-xs">
                <Illustration
                  slot="HOME-04-founder"
                  src="/illustrations/home-founder-william.avif"
                  aspectRatio="4:5"
                  filenameTarget="public/illustrations/home-founder-william.avif"
                  caption={
                    isFr ? "William — Fondateur & CEO Axion-IA" : "William — Founder & CEO Axion-IA"
                  }
                  alt={t("founderPhotoAlt")}
                />
                <div className="mt-4 text-center">
                  <p className="text-fg text-lg font-semibold">{t("founderName")}</p>
                  <p className="text-fg-muted text-sm">{t("founderRole")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar — 3 colonnes séparées par des dividers verticaux */}
          <div className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10">
            {(
              [
                { number: t("founderStat1Number"), label: t("founderStat1Label") },
                { number: t("founderStat2Number"), label: t("founderStat2Label") },
                { number: t("founderStat3Number"), label: t("founderStat3Label") },
              ] as const
            ).map((stat, idx) => (
              <div key={idx} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
                <span
                  className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.number}
                </span>
                <span className="text-fg-soft text-sm leading-snug">{stat.label}</span>
              </div>
            ))}
          </div>
        </FadeInOnView>
      </Container>
    </section>
  );
}
