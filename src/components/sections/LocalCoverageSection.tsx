// Server Component — section « Disponibles partout en France ».
// Sprint 14.9 levier 3 (cf. mémoire `axionia_pseo_villes_pilote_paris_plan.md`).
//
// Affiché sur les 3 pages services canoniques (/audit, /interventions,
// /implementation) — densifie le maillage interne services ↔ régions et
// fait passer le signal « cabinet IA national » aux moteurs de recherche.
//
// Doctrine v3.2 : tone `paper`, accent terracotta, anti-doorway HCU 2024
// (12 régions différenciées par pitch + PIB, pas une wall-of-text générique).
//
// Pas de mega-map SVG France V1 — 12 cards bien hiérarchisées suffisent
// (Linear / Stripe / Anthropic font ainsi en 2026, plus accessible et
// plus rapide à charger qu'un SVG géographique précis).

import { ArrowUpRight, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import { fmtPopulation } from "@/lib/intl";
import { getIndexableRegions } from "@/content/regions";

export interface LocalCoverageSectionProps {
  /** Locale courante. */
  isFr: boolean;
  /** Nom du service au pluriel ou singulier (ex "L'audit IA", "Les interventions IA"). */
  serviceLabelFr: string;
  serviceLabelEn: string;
  /** Slug du service pour les data-attributes (ex "audit", "interventions"). */
  serviceSlug: "audit" | "interventions" | "implementation";
  /** Tone éditorial — `paper` (clair) ou `sand` (ivoire chaud). */
  tone?: "paper" | "sand";
}

export function LocalCoverageSection({
  isFr,
  serviceLabelFr,
  serviceLabelEn,
  serviceSlug,
  tone = "paper",
}: LocalCoverageSectionProps): ReactNode {
  const regions = getIndexableRegions();

  return (
    <Section
      eyebrow={isFr ? "Couverture nationale" : "Nationwide coverage"}
      title={isFr ? `${serviceLabelFr} disponible` : `${serviceLabelEn} available`}
      titleEm={isFr ? "partout en France" : "across France"}
      titleTail="."
      description={
        isFr
          ? "Nous intervenons partout en France métropolitaine. Cliquez sur votre région pour voir comment nous accompagnons les entreprises près de chez vous."
          : "We operate across mainland France. Click your region to see how we support companies near you."
      }
      tone={tone}
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((region) => (
          <li key={region.slug}>
            <Link
              href={`/implantations/${region.slug}` as never}
              data-cta-tracking={`${serviceSlug}_local_coverage_region`}
              data-source-region={region.slug}
              data-source-target={`/implantations/${region.slug}`}
              className="group bg-bg hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                    <span
                      aria-hidden="true"
                      className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    />
                    {region.prefecture}
                    {typeof region.pibBillionsEur === "number"
                      ? ` · ${region.pibBillionsEur} Md€`
                      : ""}
                  </p>
                  <p
                    className="text-fg mt-2 text-lg leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {region.nameFr}
                  </p>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-fg-muted group-hover:text-terracotta h-4 w-4 shrink-0 transition"
                />
              </div>
              <p className="text-fg-muted mt-3 inline-flex items-center gap-1.5 text-xs tabular-nums">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {fmtPopulation(region.population, isFr ? "fr" : "en")} {isFr ? "hab." : "inhab."}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Cta
          href="/implantations"
          variant="terracotta"
          size="lg"
          shape="pill"
          track={`${serviceSlug}_local_coverage_hub`}
          data-source-target="/implantations"
        >
          {isFr ? "Voir toutes les régions" : "See all regions"}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
      </div>
    </Section>
  );
}
