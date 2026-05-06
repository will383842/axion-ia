"use client";
// use-client: reactive sliders + live computation + ARIA live region for
// the result block. Runtime-only — no SSR for the inputs (the result block
// is announced via aria-live).

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/marketing/Stat";
import { computeRoi } from "./compute";

interface RoiSimulatorProps {
  className?: string;
  labels: {
    teamSize: string;
    averageSalaryK: string;
    repetitiveTaskPct: string;
    aiCoverage: string;
    annualSavings: string;
    hoursSavedPerWeek: string;
    paybackWeeks: string;
    intro: string;
    estimateNote: string;
  };
}

export function RoiSimulator({ className, labels }: RoiSimulatorProps) {
  const [teamSize, setTeamSize] = React.useState(20);
  const [annualSalaryK, setAnnualSalaryK] = React.useState(48); // €K gross
  const [repetitivePct, setRepetitivePct] = React.useState(30); // %
  const [aiCoveragePct, setAiCoveragePct] = React.useState(60); // %

  const computed = React.useMemo(
    () => computeRoi({ teamSize, annualSalaryK, repetitivePct, aiCoveragePct }),
    [teamSize, annualSalaryK, repetitivePct, aiCoveragePct],
  );

  const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

  return (
    <div className={className}>
      <p className="mb-8 text-base leading-relaxed text-gray-700">{labels.intro}</p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="roi-team">
              {labels.teamSize} :{" "}
              <span className="text-fg font-semibold tabular-nums">{teamSize}</span>
            </Label>
            <Slider
              id="roi-team"
              min={1}
              max={500}
              step={1}
              value={[teamSize]}
              onValueChange={(v) => setTeamSize(v[0] ?? teamSize)}
              aria-valuetext={`${teamSize} ${labels.teamSize}`}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="roi-salary">
              {labels.averageSalaryK} :{" "}
              <span className="text-fg font-semibold tabular-nums">{annualSalaryK} k€</span>
            </Label>
            <Slider
              id="roi-salary"
              min={25}
              max={200}
              step={1}
              value={[annualSalaryK]}
              onValueChange={(v) => setAnnualSalaryK(v[0] ?? annualSalaryK)}
              aria-valuetext={`${annualSalaryK} ${labels.averageSalaryK}`}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="roi-repetitive">
              {labels.repetitiveTaskPct} :{" "}
              <span className="text-fg font-semibold tabular-nums">{repetitivePct} %</span>
            </Label>
            <Slider
              id="roi-repetitive"
              min={5}
              max={80}
              step={1}
              value={[repetitivePct]}
              onValueChange={(v) => setRepetitivePct(v[0] ?? repetitivePct)}
              aria-valuetext={`${repetitivePct} %`}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="roi-coverage">
              {labels.aiCoverage} :{" "}
              <span className="text-fg font-semibold tabular-nums">{aiCoveragePct} %</span>
            </Label>
            <Slider
              id="roi-coverage"
              min={10}
              max={90}
              step={1}
              value={[aiCoveragePct]}
              onValueChange={(v) => setAiCoveragePct(v[0] ?? aiCoveragePct)}
              aria-valuetext={`${aiCoveragePct} %`}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{labels.annualSavings}</CardTitle>
          </CardHeader>
          <CardContent>
            <div aria-live="polite" className="space-y-6">
              <Stat
                number={fmt.format(computed.annualSavings)}
                suffix="€"
                label={labels.annualSavings}
                variant="primary"
              />
              <Stat
                number={fmt.format(computed.hoursSavedPerWeek)}
                suffix="h"
                label={labels.hoursSavedPerWeek}
                variant="green"
              />
              <Stat
                number={fmt.format(computed.paybackWeeks)}
                suffix="sem"
                label={labels.paybackWeeks}
                variant="orange"
              />
              <p className="text-xs leading-relaxed text-gray-600">{labels.estimateNote}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
