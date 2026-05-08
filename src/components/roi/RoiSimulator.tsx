"use client";
// use-client: sliders réactifs + computation live + ARIA live region pour
// le bloc résultat. Runtime-only — pas de SSR pour les inputs (le bloc
// résultat est annoncé via aria-live).

import * as React from "react";
import { Clock, Users, FileText, Mail, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/intl";
import { computeRoi } from "./compute";

interface RoiSimulatorProps {
  className?: string;
  labels: {
    intro: string;
    teamSize: string;
    hoursDailyOnRepetitive: string;
    hoursDailyHint: string;
    resultIntro: string;
    hoursSavedPerDay: string;
    daysLiberatedPerMonth: string;
    emailsAutoPerMonth: string;
    reportsAutoPerMonth: string;
    pctTimeFreed: string;
    estimateNote: string;
  };
}

// Simulateur « gains concrets quotidiens » — pas de € ni de payback froids.
// L'utilisateur voit ce que ça change DANS SA SEMAINE : heures rendues,
// jours libérés, emails écrits sans effort. Plus parlant que des % ROI.
export function RoiSimulator({ className, labels }: RoiSimulatorProps) {
  const [teamSize, setTeamSize] = React.useState(10);
  const [hoursDailyOnRepetitive, setHoursDailyOnRepetitive] = React.useState(3);

  const computed = React.useMemo(
    () => computeRoi({ teamSize, hoursDailyOnRepetitive }),
    [teamSize, hoursDailyOnRepetitive],
  );

  const fmtFr = { format: (n: number) => fmtNumber(n, "fr") };

  return (
    <div className={cn("relative", className)}>
      <p className="text-fg-soft mb-10 max-w-2xl text-base leading-relaxed sm:text-lg">
        {labels.intro}
      </p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
        {/* ============== INPUTS — 2 sliders simples ============== */}
        <div className="space-y-9">
          {/* Slider 1 — Effectif */}
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
              min={1}
              max={50}
              step={1}
              value={[teamSize]}
              onValueChange={(v) => setTeamSize(v[0] ?? teamSize)}
              aria-valuetext={`${teamSize} ${labels.teamSize}`}
            />
            <div className="text-fg-muted mt-2 flex justify-between text-[11px] tabular-nums">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Slider 2 — Heures quotidiennes répétitives */}
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
                {hoursDailyOnRepetitive}
                <span className="text-base font-medium not-italic">h</span>
              </span>
            </div>
            <Slider
              id="roi-hours"
              min={0}
              max={6}
              step={0.5}
              value={[hoursDailyOnRepetitive]}
              onValueChange={(v) => setHoursDailyOnRepetitive(v[0] ?? hoursDailyOnRepetitive)}
              aria-valuetext={`${hoursDailyOnRepetitive} heures`}
            />
            <p className="text-fg-muted mt-3 text-[13px] leading-relaxed">
              {labels.hoursDailyHint}
            </p>
          </div>
        </div>

        {/* ============== RESULTS — gains concrets quotidiens ============== */}
        <div
          aria-live="polite"
          className="bg-halo-warm border-terracotta/25 shadow-card relative overflow-hidden rounded-3xl border-2 p-7 sm:p-9"
        >
          {/* Halo décoratif */}
          <div
            aria-hidden="true"
            className="bg-terracotta/15 pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl"
          />

          <p className="text-terracotta-deep relative text-[12px] font-bold tracking-[0.16em] uppercase">
            <Sparkles aria-hidden="true" className="mr-2 inline-block h-3.5 w-3.5 align-middle" />
            {labels.resultIntro}
          </p>

          {/* CHIFFRE PRINCIPAL — heures gagnées par jour, par personne */}
          <div className="relative mt-6">
            <p
              className="text-fg leading-none tracking-tight tabular-nums"
              style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(3.5rem, 9vw, 6rem)" }}
            >
              {computed.hoursSavedPerDayPerPerson}
              <span className="text-terracotta italic">h</span>
            </p>
            <p className="text-fg mt-2 text-lg leading-tight font-bold sm:text-xl">
              {labels.hoursSavedPerDay}
            </p>
            <p className="text-fg-soft mt-1 text-sm leading-relaxed">
              {`Soit ${computed.pctTimeFreedDaily} % du temps quotidien rendu à la valeur ajoutée.`}
            </p>
          </div>

          {/* GRID 4 KPI concrets */}
          <div className="relative mt-8 grid grid-cols-2 gap-3 sm:gap-4">
            <KpiCard
              icon={Clock}
              value={fmtFr.format(computed.daysLiberatedPerMonth)}
              suffix=" jours"
              label={labels.daysLiberatedPerMonth}
            />
            <KpiCard
              icon={Clock}
              value={fmtFr.format(computed.hoursSavedPerWeekTeam)}
              suffix=" h"
              label="par semaine, sur l'équipe"
            />
            <KpiCard
              icon={Mail}
              value={fmtFr.format(computed.emailsAutoPerMonth)}
              suffix=""
              label={labels.emailsAutoPerMonth}
            />
            <KpiCard
              icon={FileText}
              value={fmtFr.format(computed.reportsAutoPerMonth)}
              suffix=""
              label={labels.reportsAutoPerMonth}
            />
          </div>

          <p className="text-fg-muted relative mt-6 text-[12px] leading-relaxed">
            <span className="text-terracotta-deep mr-1 font-bold">★</span>
            {labels.estimateNote}
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
