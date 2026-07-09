// Server component — section « Un prix de départ pour chaque service »
// adaptée aux pages villes (Will 2026-05-26). Reprise visuelle du patron
// home `[locale]/page.tsx` lignes 842-1095, avec H2 régionalisé par ville
// pour anti-duplicate-content. Pas de client interactivité — Server Component
// pur. Prix tirés du SSOT `@/content/pricing` (zéro hardcode).

import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import {
  AUDIT_TIERS,
  UN_A_UN_TIERS,
  IMPLEMENTATION_TIERS,
  formatAmount,
  getEntryPriceEur,
  getFormationCatalogPriceRange,
} from "@/content/pricing";

interface PricingGridVilleProps {
  isFr: boolean;
  villeNameFr: string;
  loc: Locale;
}

export function PricingGridVille({ isFr, villeNameFr, loc }: PricingGridVilleProps) {
  // Prix d'entrée du catalogue Formations V2 (remplace l'offre /interventions).
  const interventionEntryPrice = formatAmount(getFormationCatalogPriceRange().minEur, loc, {
    compact: true,
  });
  const implEntryPrice = formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const auditEntryPrice = formatAmount(getEntryPriceEur(AUDIT_TIERS) ?? 0, loc, { compact: true });
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });
  const webEntryPrice = implEntryPrice;

  const services = [
    {
      id: "formation",
      dotColor: "bg-terracotta",
      badgeBg: "bg-terracotta-soft",
      badgeFg: "text-terracotta-deep",
      nameFr: "Formation IA",
      subFr: "Présentiel · À partir d'une demi-journée",
      categoryFr: "Formation",
      includesFr: "Ateliers métier · Sur site · Groupes 1–30 pers.",
      price: interventionEntryPrice,
      href: "/formations" as const,
    },
    {
      id: "audit",
      dotColor: "bg-primary",
      badgeBg: "bg-primary-soft",
      badgeFg: "text-primary",
      nameFr: "Audit IA",
      subFr: "Présentiel ou distanciel",
      categoryFr: "Audit",
      includesFr: "Diagnostic process · Gains chiffrés · Roadmap 6–12 mois",
      price: auditEntryPrice,
      href: "/audit" as const,
    },
    {
      id: "coaching",
      dotColor: "bg-sage",
      badgeBg: "bg-sage-soft",
      badgeFg: "text-sage",
      nameFr: "Coaching 1-to-1",
      subFr: "Par session · Dirigeant ou collaborateur",
      categoryFr: "Coaching",
      includesFr: "Sessions individuelles · Automatisations live · ROI J+1",
      price: unAUnEntryPrice,
      href: "/un-a-un" as const,
    },
    {
      id: "implementation",
      dotColor: "bg-terracotta-deep",
      badgeBg: "bg-terracotta-soft",
      badgeFg: "text-terracotta-deep",
      nameFr: "Implémentation IA",
      subFr: "Sur mesure · Projets clés en main",
      categoryFr: "Implémentation",
      includesFr: "Automatisations · Intégration CRM/ERP · Support 90j",
      price: implEntryPrice,
      href: "/implementation" as const,
    },
    {
      id: "web",
      dotColor: "bg-primary",
      badgeBg: "bg-primary-soft",
      badgeFg: "text-primary",
      nameFr: "Plateforme web / SaaS IA",
      subFr: "Sur devis · Plateformes IA dédiées",
      categoryFr: "Plateforme",
      includesFr: "Web IA sur mesure · Reco & search natifs · RGPD Europe",
      price: webEntryPrice,
      href: "/sites-web-augmentes" as const,
    },
  ] as const;

  return (
    <section
      aria-labelledby={`pricing-ville-${villeNameFr.toLowerCase().replace(/\s+/g, "-")}-heading`}
      className="bg-paper py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <FadeInOnView>
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Tarifs transparents" : "Tarifs transparents"}
            </p>
            <h2
              id={`pricing-ville-${villeNameFr.toLowerCase().replace(/\s+/g, "-")}-heading`}
              className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.04] font-semibold tracking-tight"
            >
              {isFr
                ? `Un prix de départ pour chaque service à `
                : `Un prix de départ pour chaque service à `}
              <span
                className="italic-editorial text-terracotta"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {villeNameFr}.
              </span>
            </h2>
            <p className="text-fg-soft mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              {isFr
                ? `Chaque projet est unique — la complexité dépend de votre infrastructure, de vos process et de votre maturité IA. Voici les prix de départ par service à ${villeNameFr}. Le devis précis se construit ensemble, après diagnostic.`
                : `Chaque projet est unique — la complexité dépend de votre infrastructure, de vos process et de votre maturité IA. Voici les prix de départ par service à ${villeNameFr}. Le devis précis se construit ensemble, après diagnostic.`}
            </p>
          </div>
        </FadeInOnView>

        <FadeInOnView>
          <div className="mx-auto max-w-6xl">
            <ul
              role="list"
              aria-label={
                isFr ? "Grille tarifaire des cinq services" : "Grille tarifaire des cinq services"
              }
              className="bg-paper border-border shadow-elevated overflow-hidden rounded-3xl border"
            >
              <li
                aria-hidden="true"
                className="bg-sand text-fg-muted border-border hidden border-b px-8 py-4 text-[11px] font-bold tracking-[0.18em] uppercase md:grid md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:items-center md:gap-6"
              >
                <span>{isFr ? "Service" : "Service"}</span>
                <span>{isFr ? "Catégorie" : "Catégorie"}</span>
                <span>{isFr ? "Inclus" : "Inclus"}</span>
                <span className="text-right">{isFr ? "Prix HT" : "Prix HT"}</span>
              </li>

              {services.map((s, idx) => (
                <li key={s.id}>
                  <Link
                    href={s.href}
                    data-cta-tracking="ville_pricing_link"
                    data-source-service={s.id}
                    className={cn(
                      "group hover:bg-sand/50 focus-visible:bg-sand/70 relative grid items-center gap-4 px-6 py-6 transition-colors focus-visible:outline-none md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:gap-6 md:px-8 md:py-7",
                      idx > 0 && "border-border border-t",
                    )}
                  >
                    <div className="flex items-start gap-3 md:items-center">
                      <span
                        className={cn(
                          "mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full md:mt-0",
                          s.dotColor,
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-fg text-base leading-tight font-bold sm:text-lg">
                          {s.nameFr}
                        </p>
                        <p className="text-fg-muted mt-1 text-xs leading-snug sm:text-sm">
                          {s.subFr}
                        </p>
                      </div>
                    </div>

                    <div className="md:flex md:items-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          s.badgeBg,
                          s.badgeFg,
                        )}
                      >
                        {s.categoryFr}
                      </span>
                    </div>

                    <div className="text-fg-soft text-sm leading-relaxed">{s.includesFr}</div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div className="text-right">
                        <p
                          className="text-fg text-xl font-bold tracking-tight sm:text-2xl"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {s.price}
                        </p>
                        <p className="text-fg-muted text-[11px] leading-snug">
                          {isFr ? "à partir de" : "à partir de"}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="bg-paper border-border text-fg-soft group-hover:border-terracotta group-hover:bg-terracotta group-hover:text-paper inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
                      >
                        <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </FadeInOnView>

        <p className="text-fg-muted mt-10 text-center text-sm leading-relaxed">
          {isFr ? (
            <>
              Pas sûr du bon service pour vous à {villeNameFr} ?{" "}
              <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                Parlons-en
              </Link>{" "}
              — un consultant senior Axion-IA vous recontacte personnellement sous 48 h ouvrées,
              sans engagement.
            </>
          ) : (
            <>
              Pas sûr du bon service pour vous à {villeNameFr} ?{" "}
              <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                Parlons-en
              </Link>{" "}
              — un consultant senior Axion-IA vous recontacte personnellement sous 48 h ouvrées,
              sans engagement.
            </>
          )}
        </p>
      </Container>
    </section>
  );
}
