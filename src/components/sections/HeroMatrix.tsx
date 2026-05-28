// Hero visuel — Matrice « Compétences × Outils IA » pour /interventions/collectives.
//
// Sprint Matrice hero 2026-05-28 (Will). Remplace l'orbital générique
// `ImplementationHeroSchema` sur la page hub Formations équipe par une
// visualisation data-viz qui prouve l'expertise pédagogique d'Axion-IA :
// pour chaque catégorie d'usage métier (rédaction, analyse, code, etc.),
// quel outil IA est le plus pertinent et combien d'heures sont économisées
// par semaine.
//
// Métaphore : « on ne forme pas à un outil, on forme à des résultats ».
// 48 intersections (8 outils × 6 use cases) + 6 KPI horaires + 3 KPI agrégés.
//
// Pattern visuel inspiré Stripe annual report / Linear /method — dense,
// scannable, autoritaire. Pas de concurrent formation IA FR n'utilise ce
// pattern → différenciation maximale.
//
// Server Component pur. SVG inline + composants brand-logos SVG inline = 0
// network call, 0 JS, ~10 KB gz inline total. CLS = 0 (dimensions fixes
// viewBox). LCP optimal.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_BY_SLUG, type BrandLogoSlug } from "@/components/icons/brand-logos";

interface ToolColumn {
  slug: BrandLogoSlug;
  labelShort: string;
}

interface UseCaseRow {
  id: string;
  numLabel: string;
  labelFr: string;
  labelEn: string;
  /** Intensité 0–4 par colonne (0=vide, 4=excellent fit). Ordre = TOOLS. */
  scores: ReadonlyArray<0 | 1 | 2 | 3 | 4>;
  /** Heures économisées par semaine (h/sem). */
  hoursPerWeek: number;
}

const TOOLS: ReadonlyArray<ToolColumn> = [
  { slug: "chatgpt", labelShort: "ChatGPT" },
  { slug: "claude", labelShort: "Claude" },
  { slug: "mistral", labelShort: "Mistral" },
  { slug: "copilot", labelShort: "Copilot" },
  { slug: "perplexity", labelShort: "Perplexity" },
  { slug: "midjourney", labelShort: "Midjourney" },
  { slug: "sora", labelShort: "Sora" },
  { slug: "heygen", labelShort: "HeyGen" },
];

const USE_CASES: ReadonlyArray<UseCaseRow> = [
  {
    id: "redaction",
    numLabel: "01",
    labelFr: "Rédaction & synthèse",
    labelEn: "Writing & synthesis",
    // chatgpt, claude, mistral, copilot, perplexity, midjourney, sora, heygen
    scores: [4, 4, 3, 2, 2, 0, 0, 0],
    hoursPerWeek: 6,
  },
  {
    id: "analyse-data",
    numLabel: "02",
    labelFr: "Analyse de données",
    labelEn: "Data analysis",
    scores: [3, 4, 2, 4, 3, 0, 0, 0],
    hoursPerWeek: 4,
  },
  {
    id: "code-auto",
    numLabel: "03",
    labelFr: "Code & automatisations",
    labelEn: "Code & automations",
    scores: [3, 4, 2, 4, 2, 0, 0, 0],
    hoursPerWeek: 5,
  },
  {
    id: "visuel-brand",
    numLabel: "04",
    labelFr: "Visuel & brand",
    labelEn: "Visual & brand",
    scores: [1, 0, 0, 0, 0, 4, 0, 0],
    hoursPerWeek: 3,
  },
  {
    id: "video-pitch",
    numLabel: "05",
    labelFr: "Vidéo & pitch",
    labelEn: "Video & pitch",
    scores: [0, 0, 0, 0, 0, 0, 4, 4],
    hoursPerWeek: 4,
  },
  {
    id: "recherche-veille",
    numLabel: "06",
    labelFr: "Recherche & veille",
    labelEn: "Research & monitoring",
    scores: [3, 4, 2, 3, 4, 0, 0, 0],
    hoursPerWeek: 3,
  },
];

// Mobile : 3 lignes prioritaires (top hours/sem).
const MOBILE_USE_CASES = USE_CASES.filter((u) =>
  ["redaction", "code-auto", "video-pitch"].includes(u.id),
);

// Mapping intensité → classe Tailwind (utilise les tokens design system).
// Le bg-terracotta-soft est le 0/15%, terracotta = pleine intensité.
function cellClass(score: 0 | 1 | 2 | 3 | 4): string {
  switch (score) {
    case 0:
      return "bg-paper border-border/40";
    case 1:
      return "bg-terracotta-soft/40 border-terracotta-soft";
    case 2:
      return "bg-terracotta-soft border-terracotta/30";
    case 3:
      return "bg-terracotta/55 border-terracotta/50";
    case 4:
      return "bg-terracotta border-terracotta-deep";
  }
}

const TOTAL_HOURS = USE_CASES.reduce((acc, u) => acc + u.hoursPerWeek, 0);
const TOTAL_INTERSECTIONS = USE_CASES.reduce(
  (acc, u) => acc + u.scores.filter((s) => s > 0).length,
  0,
);

interface Props {
  isFr: boolean;
}

export function HeroMatrix({ isFr }: Props): ReactNode {
  return (
    <div
      className="relative"
      aria-label={
        isFr
          ? "Matrice compétences IA enseignées par Axion-IA"
          : "AI skills matrix taught by Axion-IA"
      }
    >
      {/* ====================================================================
          DESKTOP — matrice complète 8 outils × 6 use cases + colonne ROI.
          Cachée < lg pour éviter compression illisible. CLS=0 garanti par
          les dimensions fixes des cellules.
          ==================================================================== */}
      <div className="bg-paper border-border shadow-subtle hidden overflow-hidden rounded-2xl border lg:block">
        {/* En-tête : eyebrow + titre interne */}
        <div className="border-border/60 border-b px-6 py-4">
          <p className="text-fg-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
            {isFr ? "Stack IA enseignée" : "AI stack taught"}
          </p>
          <p className="text-fg mt-1 text-[14px] leading-snug">
            {isFr
              ? "8 outils maîtrisés × 6 cas d'usage métier"
              : "8 tools mastered × 6 business use cases"}
          </p>
        </div>

        {/* Grid matrice — proportions fixes : col1 use case (largeur libre)
            + 8 cols outils (1.2fr chacune, carré) + col9 ROI (largeur libre). */}
        <div className="px-5 py-5">
          <div
            role="table"
            aria-label={isFr ? "Matrice 8 outils × 6 cas d'usage" : "8 tools × 6 use cases matrix"}
            className="grid gap-x-2 gap-y-1.5"
            style={{
              gridTemplateColumns: "minmax(140px,1.4fr) repeat(8,minmax(0,1fr)) minmax(60px,0.7fr)",
            }}
          >
            {/* Row 0 = header (logos) */}
            <div className="text-fg-muted self-end pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
              {isFr ? "Cas d'usage" : "Use case"}
            </div>
            {TOOLS.map((tool) => {
              const Logo = BRAND_LOGO_BY_SLUG[tool.slug];
              return (
                <div
                  key={tool.slug}
                  role="columnheader"
                  className="text-fg-muted flex flex-col items-center gap-1 pb-1"
                >
                  <Logo className="text-terracotta-deep h-5 w-5" />
                  <span className="text-[10px] leading-none font-medium tracking-tight">
                    {tool.labelShort}
                  </span>
                </div>
              );
            })}
            <div className="text-fg-muted self-end pb-1 text-right text-[10px] font-semibold tracking-[0.14em] uppercase">
              {isFr ? "Gain" : "Saved"}
            </div>

            {/* Rows = use cases */}
            {USE_CASES.map((uc) => (
              <RowFragment key={uc.id} uc={uc} isFr={isFr} />
            ))}
          </div>
        </div>

        {/* Footer : 3 KPI agrégés — signal commercial fort */}
        <div className="border-border/60 bg-sand/40 border-t px-6 py-3.5">
          <ul className="text-fg flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
            <KpiItem
              valueLabel={`${TOTAL_HOURS}h/sem`}
              labelFr="économisées"
              labelEn="saved"
              isFr={isFr}
            />
            <KpiSeparator />
            <KpiItem
              valueLabel={`${TOTAL_INTERSECTIONS}`}
              labelFr="cas d'usage maîtrisés"
              labelEn="use cases mastered"
              isFr={isFr}
            />
            <KpiSeparator />
            <KpiItem
              valueLabel={`${TOOLS.length}`}
              labelFr="outils enseignés"
              labelEn="tools taught"
              isFr={isFr}
            />
          </ul>
        </div>
      </div>

      {/* ====================================================================
          MOBILE — version condensée 3 use cases prioritaires. La matrice
          desktop est illisible < lg ; on extrait les 3 lignes phares
          (rédaction, code, vidéo) qui couvrent les usages les plus demandés
          en formation. Liste de cards stack verticalement.
          ==================================================================== */}
      <div className="bg-paper border-border shadow-subtle space-y-3 overflow-hidden rounded-2xl border p-5 lg:hidden">
        <p className="text-fg-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
          {isFr ? "Stack IA enseignée" : "AI stack taught"}
        </p>
        <p className="text-fg text-[14px] leading-snug">
          {isFr
            ? `${TOOLS.length} outils maîtrisés · ${TOTAL_HOURS}h/sem économisées`
            : `${TOOLS.length} tools mastered · ${TOTAL_HOURS}h/week saved`}
        </p>

        <ul className="mt-4 space-y-3">
          {MOBILE_USE_CASES.map((uc) => {
            const topTools = TOOLS.map((t, i) => ({ tool: t, score: uc.scores[i] ?? 0 }))
              .filter((x) => x.score >= 3)
              .slice(0, 3);
            return (
              <li key={uc.id} className="bg-sand/30 border-border/60 rounded-xl border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-fg text-[13.5px] leading-tight font-semibold">
                    <span className="text-fg-muted mr-1.5 text-[10px] font-bold tabular-nums">
                      {uc.numLabel}.
                    </span>
                    {isFr ? uc.labelFr : uc.labelEn}
                  </span>
                  <span className="bg-terracotta text-mocha-fg shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums">
                    +{uc.hoursPerWeek}h/sem
                  </span>
                </div>
                <div className="text-fg-soft mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                  {topTools.map(({ tool }) => {
                    const Logo = BRAND_LOGO_BY_SLUG[tool.slug];
                    return (
                      <span key={tool.slug} className="inline-flex items-center gap-1">
                        <Logo className="text-terracotta-deep h-3.5 w-3.5" />
                        <span className="font-medium">{tool.labelShort}</span>
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-fg-muted mt-2 text-center text-[11px] italic">
          {isFr
            ? `+ ${USE_CASES.length - MOBILE_USE_CASES.length} autres cas d'usage en formation`
            : `+ ${USE_CASES.length - MOBILE_USE_CASES.length} more use cases in training`}
        </p>
      </div>
    </div>
  );
}

// Sous-composant : 1 ligne complète (col1 + 8 cells + colROI) pour le grid.
// Server Component, pas de state.
function RowFragment({ uc, isFr }: { uc: UseCaseRow; isFr: boolean }) {
  return (
    <>
      <div
        role="rowheader"
        className="text-fg flex items-center gap-2 self-center pr-2 text-[12.5px]"
      >
        <span className="text-fg-muted text-[10px] font-bold tabular-nums">{uc.numLabel}.</span>
        <span className="leading-tight font-medium">{isFr ? uc.labelFr : uc.labelEn}</span>
      </div>
      {uc.scores.map((score, i) => (
        <div
          key={`${uc.id}-${TOOLS[i]!.slug}`}
          role="cell"
          aria-label={`${isFr ? uc.labelFr : uc.labelEn} · ${TOOLS[i]!.labelShort} · ${score === 0 ? (isFr ? "non recommandé" : "not recommended") : `${score}/4`}`}
          className={cn("aspect-square rounded-md border transition-colors", cellClass(score))}
        />
      ))}
      <div className="text-terracotta-deep flex items-center justify-end self-center text-[12px] font-bold tabular-nums">
        +{uc.hoursPerWeek}h/sem
      </div>
    </>
  );
}

function KpiItem({
  valueLabel,
  labelFr,
  labelEn,
  isFr,
}: {
  valueLabel: string;
  labelFr: string;
  labelEn: string;
  isFr: boolean;
}) {
  return (
    <li className="flex items-baseline gap-1.5">
      <span className="text-terracotta-deep font-display text-[15px] font-bold tabular-nums">
        {valueLabel}
      </span>
      <span className="text-fg-soft text-[12px]">{isFr ? labelFr : labelEn}</span>
    </li>
  );
}

function KpiSeparator() {
  return (
    <li aria-hidden="true" className="text-fg-muted/40 text-[10px]">
      ·
    </li>
  );
}
