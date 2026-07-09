"use client";
// use-client: sliders + sélecteurs réactifs, recalcul live.
//
// Budget Web Vitals : aucune dépendance nouvelle. Le segmented control est fait
// d'`<input type="radio">` natifs, le sélecteur de secteur d'un `<select>`
// natif, les barres de répartition de simples `<div>` à largeur en pourcentage,
// et le bloc « valeur financière » d'un `<details>` natif (0 JS, 0 état).
// Le seul composant client importé reste le Slider Radix, déjà dans le bundle.
//
// A11y : le panneau de résultats n'est PAS une région `aria-live` — annoncer
// une douzaine de nombres à chaque cran de slider est inutilisable au lecteur
// d'écran. On annonce à la place une phrase de synthèse (`.sr-only`) ; le
// détail reste lisible à la navigation.

import * as React from "react";
import {
  Clock,
  Users,
  FileText,
  Mail,
  Sparkles,
  Search,
  PenLine,
  BarChart3,
  Briefcase,
  Wallet,
  TrendingUp,
  Info,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtNumber, fmtCurrency } from "@/lib/intl";
import { CLIENT_SECTORS } from "@/content/sectors";
import type { Locale } from "@/i18n/routing";
import {
  computeRoi,
  ADOPTION_EFFICIENCY,
  ROI_BOUNDS,
  ROI_CONSTANTS,
  ROI_SECTOR_PRESETS,
  type RoiAdoption,
  type RoiSectorKey,
  type RoiTaskFamily,
} from "./compute";

/**
 * Tous les libellés viennent du Server Component parent (page.tsx), donc ils
 * DOIVENT rester sérialisables : pas de fonctions, uniquement des chaînes. Les
 * quelques phrases à trous portent des jetons `{pct}`, `{sessions}`, `{hours}`,
 * `{days}`, `{fte}`, substitués par `interpolate()` ci-dessous.
 */
export interface RoiSimulatorLabels {
  intro: string;
  sector: string;
  sectorGeneric: string;
  sectorHint: string;
  teamSize: string;
  hoursDailyOnRepetitive: string;
  hoursDailyHint: string;
  adoption: string;
  adoptionHint: string;
  adoptionPrudent: string;
  adoptionRealiste: string;
  adoptionAmbitieux: string;
  adoptionPrudentHint: string;
  adoptionRealisteHint: string;
  adoptionAmbitieuxHint: string;
  resultIntro: string;
  hoursSavedPerDay: string;
  /** Gabarit — jeton `{pct}`. */
  pctTimeFreedSentence: string;
  daysLiberatedPerMonth: string;
  fteRecovered: string;
  emailsAssistedPerMonth: string;
  reportsAssistedPerMonth: string;
  breakdownTitle: string;
  breakdownHint: string;
  taskRedaction: string;
  taskRecherche: string;
  taskSynthese: string;
  taskReporting: string;
  hoursPerWeekShort: string;
  moneyToggle: string;
  moneyIntro: string;
  hourlyCost: string;
  hourlyCostHint: string;
  annualValue: string;
  annualValueHint: string;
  trainingCost: string;
  /** Gabarit une seule session. */
  trainingCostHintOne: string;
  /** Gabarit plusieurs sessions — jeton `{sessions}`. */
  trainingCostHintMany: string;
  payback: string;
  paybackHint: string;
  paybackNone: string;
  workingDays: string;
  estimateNote: string;
  /** Gabarit — jetons `{hours}`, `{days}`, `{fte}`. */
  liveSummary: string;
}

interface RoiSimulatorProps {
  className?: string;
  locale: Locale;
  labels: RoiSimulatorLabels;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

const ADOPTIONS: readonly RoiAdoption[] = ["prudent", "realiste", "ambitieux"];

const TASK_ICONS: Record<RoiTaskFamily, typeof PenLine> = {
  redaction: PenLine,
  recherche: Search,
  synthese: FileText,
  reporting: BarChart3,
};

export function RoiSimulator({ className, locale, labels }: RoiSimulatorProps) {
  const [sector, setSector] = React.useState<RoiSectorKey>("generique");
  const [teamSize, setTeamSize] = React.useState(10);
  const [hoursDailyOnRepetitive, setHoursDailyOnRepetitive] = React.useState(
    ROI_SECTOR_PRESETS.generique.hoursDailyOnRepetitive,
  );
  const [adoption, setAdoption] = React.useState<RoiAdoption>("realiste");
  // `ROI_CONSTANTS` est `as const` → le défaut a le type littéral `45`. On
  // annote pour que l'état reste un `number` réglable par le slider.
  const [hourlyCostEur, setHourlyCostEur] = React.useState<number>(
    ROI_CONSTANTS.defaultHourlyCostEur,
  );

  // Changer de secteur repositionne le slider « heures » sur la valeur typique
  // du secteur : c'est le point de départ le plus utile, l'utilisateur ajuste
  // ensuite. Les autres curseurs ne bougent pas.
  const onSectorChange = React.useCallback((next: RoiSectorKey) => {
    setSector(next);
    setHoursDailyOnRepetitive(ROI_SECTOR_PRESETS[next].hoursDailyOnRepetitive);
  }, []);

  const r = React.useMemo(
    () => computeRoi({ teamSize, hoursDailyOnRepetitive, adoption, sector, hourlyCostEur }),
    [teamSize, hoursDailyOnRepetitive, adoption, sector, hourlyCostEur],
  );

  const n = (v: number) => fmtNumber(v, locale);
  const eur = (v: number) => fmtCurrency(v, locale);

  const taskLabels: Record<RoiTaskFamily, string> = {
    redaction: labels.taskRedaction,
    recherche: labels.taskRecherche,
    synthese: labels.taskSynthese,
    reporting: labels.taskReporting,
  };

  const adoptionLabels: Record<RoiAdoption, { label: string; hint: string }> = {
    prudent: { label: labels.adoptionPrudent, hint: labels.adoptionPrudentHint },
    realiste: { label: labels.adoptionRealiste, hint: labels.adoptionRealisteHint },
    ambitieux: { label: labels.adoptionAmbitieux, hint: labels.adoptionAmbitieuxHint },
  };

  return (
    <div className={cn("relative", className)}>
      <p className="text-fg-soft mb-10 max-w-2xl text-base leading-relaxed sm:text-lg">
        {labels.intro}
      </p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-14">
        {/* ============== INPUTS ============== */}
        <div className="space-y-8">
          {/* Secteur */}
          <div>
            <Label
              htmlFor="roi-sector"
              className="text-fg mb-3 flex items-center gap-2 text-base font-bold sm:text-lg"
            >
              <Briefcase aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
              {labels.sector}
            </Label>
            <select
              id="roi-sector"
              value={sector}
              onChange={(e) => onSectorChange(e.target.value as RoiSectorKey)}
              className="border-border-strong bg-paper text-fg focus-visible:ring-primary w-full rounded-xl border-2 px-4 py-3 text-[15px] font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="generique">{labels.sectorGeneric}</option>
              {CLIENT_SECTORS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.emoji} {s.labelFr}
                </option>
              ))}
            </select>
            <p className="text-fg-muted mt-2 text-[13px] leading-relaxed">{labels.sectorHint}</p>
          </div>

          {/* Effectif */}
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <Label
                htmlFor="roi-team"
                className="text-fg flex items-center gap-2 text-base font-bold sm:text-lg"
              >
                <Users aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
                {labels.teamSize}
              </Label>
              <span
                className="text-terracotta-deep text-3xl font-bold tracking-tight tabular-nums sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {teamSize}
              </span>
            </div>
            <Slider
              id="roi-team"
              min={ROI_BOUNDS.teamSize.min}
              max={ROI_BOUNDS.teamSize.max}
              step={ROI_BOUNDS.teamSize.step}
              value={[teamSize]}
              onValueChange={(v) => setTeamSize(v[0] ?? teamSize)}
              aria-valuetext={`${teamSize}`}
            />
            <div className="text-fg-muted mt-2 flex justify-between text-[11px] tabular-nums">
              <span>{ROI_BOUNDS.teamSize.min}</span>
              <span>{ROI_BOUNDS.teamSize.max}</span>
            </div>
          </div>

          {/* Heures répétitives */}
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <Label
                htmlFor="roi-hours"
                className="text-fg flex items-center gap-2 text-base font-bold sm:text-lg"
              >
                <Clock aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
                {labels.hoursDailyOnRepetitive}
              </Label>
              <span
                className="text-terracotta-deep text-3xl font-bold tracking-tight tabular-nums sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {n(hoursDailyOnRepetitive)}
                <span className="text-base font-medium not-italic">h</span>
              </span>
            </div>
            <Slider
              id="roi-hours"
              min={ROI_BOUNDS.hoursDailyOnRepetitive.min}
              max={ROI_BOUNDS.hoursDailyOnRepetitive.max}
              step={ROI_BOUNDS.hoursDailyOnRepetitive.step}
              value={[hoursDailyOnRepetitive]}
              onValueChange={(v) => setHoursDailyOnRepetitive(v[0] ?? hoursDailyOnRepetitive)}
              aria-valuetext={`${n(hoursDailyOnRepetitive)} h`}
            />
            <p className="text-fg-muted mt-3 text-[13px] leading-relaxed">
              {labels.hoursDailyHint}
            </p>
          </div>

          {/* Scénario d'adoption — segmented control natif */}
          <fieldset>
            <legend className="text-fg mb-3 flex items-center gap-2 text-base font-bold sm:text-lg">
              <TrendingUp aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
              {labels.adoption}
            </legend>
            <div className="border-border-strong bg-paper grid grid-cols-3 gap-1 rounded-xl border-2 p-1">
              {ADOPTIONS.map((a) => (
                <label
                  key={a}
                  className={cn(
                    "focus-within:ring-primary cursor-pointer rounded-lg px-2 py-2.5 text-center text-[13px] font-semibold transition focus-within:ring-2",
                    adoption === a
                      ? "bg-terracotta text-paper shadow-subtle"
                      : "text-fg-soft hover:bg-sand",
                  )}
                >
                  <input
                    type="radio"
                    name="roi-adoption"
                    value={a}
                    checked={adoption === a}
                    onChange={() => setAdoption(a)}
                    className="sr-only"
                  />
                  {adoptionLabels[a].label}
                  <span className="mt-0.5 block text-[11px] font-normal tabular-nums opacity-80">
                    {Math.round(ADOPTION_EFFICIENCY[a] * 100)} %
                  </span>
                </label>
              ))}
            </div>
            <p className="text-fg-muted mt-3 text-[13px] leading-relaxed">
              <span className="text-fg-soft font-medium">{adoptionLabels[adoption].hint}</span>{" "}
              {labels.adoptionHint}
            </p>
          </fieldset>
        </div>

        {/* ============== RÉSULTATS ============== */}
        <div className="bg-halo-warm border-terracotta/25 shadow-card relative overflow-hidden rounded-3xl border-2 p-6 sm:p-9">
          <div
            aria-hidden="true"
            className="bg-terracotta/15 pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl"
          />

          {/* Synthèse annoncée aux lecteurs d'écran. */}
          <p aria-live="polite" className="sr-only">
            {interpolate(labels.liveSummary, {
              hours: n(r.hoursSavedPerDayPerPerson),
              days: n(r.daysLiberatedPerMonth),
              fte: n(r.fteRecovered),
            })}
          </p>

          <p className="text-terracotta-deep relative text-[12px] font-bold tracking-[0.16em] uppercase">
            <Sparkles aria-hidden="true" className="mr-2 inline-block h-3.5 w-3.5 align-middle" />
            {labels.resultIntro}
          </p>

          {/* CHIFFRE HÉRO — heures rendues par jour, par personne */}
          <div className="relative mt-6">
            <p
              className="text-fg leading-none tracking-tight tabular-nums"
              style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(3.5rem, 9vw, 6rem)" }}
            >
              {n(r.hoursSavedPerDayPerPerson)}
              <span className="text-terracotta italic">h</span>
            </p>
            <p className="text-fg mt-2 text-lg leading-tight font-bold sm:text-xl">
              {labels.hoursSavedPerDay}
            </p>
            <p className="text-fg-soft mt-1 text-sm leading-relaxed">
              {interpolate(labels.pctTimeFreedSentence, { pct: n(r.pctTimeFreedDaily) })}
            </p>
          </div>

          {/* 4 KPI */}
          <div className="relative mt-8 grid grid-cols-2 gap-3 sm:gap-4">
            <KpiCard
              icon={Clock}
              value={n(r.daysLiberatedPerMonth)}
              suffix=" j"
              label={labels.daysLiberatedPerMonth}
            />
            <KpiCard
              icon={Users}
              value={n(r.fteRecovered)}
              suffix=" ETP"
              label={labels.fteRecovered}
            />
            <KpiCard
              icon={Mail}
              value={n(r.emailsAssistedPerMonth)}
              suffix=""
              label={labels.emailsAssistedPerMonth}
            />
            <KpiCard
              icon={FileText}
              value={n(r.reportsAssistedPerMonth)}
              suffix=""
              label={labels.reportsAssistedPerMonth}
            />
          </div>

          {/* Répartition par famille de tâches */}
          <div className="relative mt-8">
            <h3 className="text-fg text-sm font-bold tracking-tight">{labels.breakdownTitle}</h3>
            <p className="text-fg-muted mt-1 mb-4 text-[12px] leading-relaxed">
              {labels.breakdownHint}
            </p>
            <ul role="list" className="flex flex-col gap-3">
              {r.taskBreakdown.map((slice) => {
                const Icon = TASK_ICONS[slice.family];
                return (
                  <li key={slice.family} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="text-fg inline-flex items-center gap-1.5 font-medium">
                        <Icon aria-hidden="true" className="text-terracotta-deep h-3.5 w-3.5" />
                        {taskLabels[slice.family]}
                      </span>
                      <span className="text-fg-soft shrink-0 tabular-nums">
                        {n(slice.hoursPerWeekTeam)} {labels.hoursPerWeekShort} ·{" "}
                        <span className="text-fg font-semibold">{slice.sharePct} %</span>
                      </span>
                    </div>
                    <div className="bg-border/60 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-terracotta h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${slice.sharePct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Valeur financière — opt-in, `<details>` natif */}
          <details className="group border-terracotta/25 bg-paper/60 relative mt-8 rounded-2xl border">
            <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold">
              <span className="inline-flex items-center gap-2">
                <Wallet aria-hidden="true" className="text-terracotta-deep h-4 w-4" />
                {labels.moneyToggle}
              </span>
              <span
                aria-hidden="true"
                className="text-fg-muted shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>

            <div className="border-border/60 flex flex-col gap-6 border-t p-4 pt-5">
              <p className="text-fg-soft text-[13px] leading-relaxed">{labels.moneyIntro}</p>

              {/* Coût horaire chargé */}
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <Label htmlFor="roi-hourly" className="text-fg text-sm font-semibold">
                    {labels.hourlyCost}
                  </Label>
                  <span className="text-terracotta-deep text-xl font-bold tabular-nums">
                    {eur(hourlyCostEur)}
                  </span>
                </div>
                <Slider
                  id="roi-hourly"
                  min={ROI_BOUNDS.hourlyCostEur.min}
                  max={ROI_BOUNDS.hourlyCostEur.max}
                  step={ROI_BOUNDS.hourlyCostEur.step}
                  value={[hourlyCostEur]}
                  onValueChange={(v) => setHourlyCostEur(v[0] ?? hourlyCostEur)}
                  aria-valuetext={eur(hourlyCostEur)}
                />
                <p className="text-fg-muted mt-2 text-[12px] leading-relaxed">
                  {labels.hourlyCostHint}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MoneyStat
                  label={labels.annualValue}
                  value={eur(r.money.annualValueEur)}
                  hint={labels.annualValueHint}
                  emphasis
                />
                <MoneyStat
                  label={labels.trainingCost}
                  value={eur(r.money.trainingCostEur)}
                  hint={
                    r.money.sessionsNeeded > 1
                      ? interpolate(labels.trainingCostHintMany, {
                          sessions: n(r.money.sessionsNeeded),
                        })
                      : labels.trainingCostHintOne
                  }
                />
                <MoneyStat
                  label={labels.payback}
                  value={
                    r.money.paybackWorkingDays === null
                      ? labels.paybackNone
                      : `${n(r.money.paybackWorkingDays)} ${labels.workingDays}`
                  }
                  hint={labels.paybackHint}
                />
              </dl>
            </div>
          </details>

          <p className="text-fg-muted relative mt-6 flex gap-2 text-[12px] leading-relaxed">
            <Info aria-hidden="true" className="text-terracotta-deep mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{labels.estimateNote}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  value,
  suffix,
  label,
}: {
  icon: typeof Clock;
  value: string;
  suffix: string;
  label: string;
}) {
  return (
    <div className="bg-paper border-border-strong rounded-2xl border-2 p-4">
      <Icon aria-hidden="true" className="text-terracotta-deep mb-2 h-4 w-4" />
      <p className="text-fg text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-3xl">
        {value}
        <span className="text-fg-muted text-base font-medium">{suffix}</span>
      </p>
      <p className="text-fg-soft mt-2 text-[12px] leading-snug">{label}</p>
    </div>
  );
}

function MoneyStat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        emphasis ? "border-terracotta/40 bg-terracotta-soft/40" : "border-border bg-canvas",
      )}
    >
      <dt className="text-fg-soft text-[11px] font-semibold tracking-wide uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-lg leading-tight font-bold tracking-tight tabular-nums",
          emphasis ? "text-terracotta-deep" : "text-fg",
        )}
      >
        {value}
      </dd>
      <p className="text-fg-muted mt-1 text-[11px] leading-snug">{hint}</p>
    </div>
  );
}
