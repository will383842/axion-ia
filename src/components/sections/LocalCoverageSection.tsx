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
  serviceSlug: "audit" | "interventions" | "implementation" | "sites-web-augmentes" | "un-a-un";
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
  // Référence des barres de PIB : le plus gros PIB régional (Île-de-France).
  const maxPib = regions.reduce(
    (max, r) =>
      typeof r.pibBillionsEur === "number" && r.pibBillionsEur > max ? r.pibBillionsEur : max,
    0,
  );

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
      {/* Grille régions — refonte Will 2026-08-10.
          Avant : cartes `border-2` massives, 2 par ligne sur desktop, chaque
          région réduite à trois lignes de texte plat. Le tout se lisait comme
          un annuaire des années 2010 sur 18 entrées.
          Maintenant : tuiles légères 4 par ligne, et surtout une BARRE DE PIB
          relative au maximum national — la même donnée qu'avant (`Md€`), mais
          comparable d'un coup d'œil au lieu d'être un nombre isolé. La rangée
          devient une lecture du poids économique des territoires couverts.

          ⚠️ Pas de palier `sm:` : `--breakpoint-sm` n'étant pas déclaré dans le
          `@theme` de globals.css, Tailwind v4 émet les règles `sm:` APRÈS
          `md:`/`lg:` — un `sm:grid-cols-2` écrasait donc `lg:grid-cols-3` et
          cette grille rendait 2 colonnes sur grand écran. */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {regions.map((region) => {
          const pib = typeof region.pibBillionsEur === "number" ? region.pibBillionsEur : null;
          // Part du PIB régional rapportée au maximum national (Île-de-France).
          // Plancher à 4 % pour que les plus petits territoires restent visibles.
          const pibShare = pib !== null && maxPib > 0 ? Math.max(4, (pib / maxPib) * 100) : null;

          return (
            <li key={region.slug}>
              <Link
                href={`/implantations/${region.slug}` as never}
                data-cta-tracking={`${serviceSlug}_local_coverage_region`}
                data-source-region={region.slug}
                data-source-target={`/implantations/${region.slug}`}
                /* `flex flex-col` + `mt-auto` sur le bloc PIB : sans ça, les
                   régions au nom long (Provence-Alpes-Côte d'Azur,
                   Bourgogne-Franche-Comté) passent sur deux lignes et
                   décalent leur barre vers le bas — les jauges d'une même
                   rangée ne s'alignaient plus et la comparaison sautait. */
                className="group bg-paper border-border hover:border-terracotta focus-visible:ring-terracotta hover:shadow-subtle flex h-full flex-col rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-fg min-w-0 text-lg leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {region.nameFr}
                  </p>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>

                <p className="text-fg-muted mt-2 inline-flex items-center gap-1.5 text-xs tabular-nums">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {region.prefecture} · {fmtPopulation(region.population, isFr ? "fr" : "en")}{" "}
                  {isFr ? "hab." : "inhab."}
                </p>

                {pibShare !== null ? (
                  <div className="mt-auto pt-4">
                    {/* Jauge décorative : la valeur chiffrée est juste en dessous,
                        en texte — rien n'est porté par la seule couleur. */}
                    <div
                      aria-hidden="true"
                      className="bg-sand h-1 w-full overflow-hidden rounded-full"
                    >
                      <div
                        className="bg-terracotta h-full rounded-full transition-transform duration-500 group-hover:scale-x-105"
                        style={{ width: `${pibShare}%`, transformOrigin: "left" }}
                      />
                    </div>
                    <p className="text-fg-soft mt-2 text-xs font-semibold tabular-nums">
                      {pib} {isFr ? "Md€ de PIB" : "bn€ GDP"}
                    </p>
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
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
