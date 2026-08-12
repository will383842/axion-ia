"use client";
// use-client: recalcul live au changement de coût horaire, dépliants et copie du lien.
// Simulateur de gains v2 — LE RAPPORT.
//
// C'est le livrable. Il doit tenir debout tout seul : un dirigeant l'envoie à
// son associé, qui l'ouvre sans avoir vu le questionnaire et doit comprendre
// en dix secondes de quoi il s'agit, d'où viennent les chiffres, et quoi faire
// lundi matin.
//
// ── Ordre de lecture, pensé pour un pouce sur un écran de téléphone ───────
//   1. Le verdict     — un chiffre, une fourchette, trois repères
//   2. Le plan        — les cinq premières tâches, la plus rentable d'abord
//   3. Le calendrier  — 30 jours / 3 mois / 6 mois
//   4. La ventilation — d'où vient le temps
//   5. Les limites    — ce qui ne s'automatise pas, ce qu'on n'a pas mesuré
//   6. L'action       — recevoir le rapport, puis parler à quelqu'un
//
// Les limites viennent AVANT l'appel à l'action, jamais après : un dirigeant
// qui découvre les réserves une fois le formulaire rempli se sent manipulé.

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Link2,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency, fmtNumber } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import { Cta } from "@/components/marketing/Cta";
import type { RoiReport, TaskResult } from "@/content/roi/model/types";
import { ROI_MODEL_CONSTANTS } from "@/content/roi/model/types";
import { businessFunctionLabel, volumeUnitLabel } from "@/content/roi/model/functions";
import { clientSectorLabel } from "@/content/sectors";
import { ReportEmailForm } from "./ReportEmailForm";

/** Coûts horaires chargés proposés — des paliers, pas un curseur au doigt. */
const HOURLY_PRESETS = [35, 45, 60, 85] as const;

interface ReportViewProps {
  locale: Locale;
  report: RoiReport;
  funnel?: boolean;
  onBack: () => void;
  onRestart: () => void;
  onHourlyCostChange: (value: number) => void;
}

export function ReportView({
  locale,
  report,
  funnel = false,
  onBack,
  onRestart,
  onHourlyCostChange,
}: ReportViewProps) {
  const n = React.useCallback((v: number) => fmtNumber(v, locale), [locale]);
  const eur = React.useCallback((v: number) => fmtCurrency(v, locale), [locale]);

  if (report.isEmpty) {
    return <EmptyReport onBack={onBack} onRestart={onRestart} />;
  }

  const sectorLabel =
    report.answers.sector === "generique"
      ? "votre secteur"
      : clientSectorLabel(report.answers.sector);

  // Délai de l'action la plus rapide du plan. `report.tasks` est trié par score
  // de priorité, pas par délai — d'où le minimum explicite.
  const firstActionWeeks = Math.min(...report.tasks.map((t) => t.weeksToValue));

  return (
    <div className="min-w-0">
      {/* ═══ 1. LE VERDICT ═══════════════════════════════════════════════ */}
      <header>
        <p className="text-terracotta-deep text-[12px] font-bold tracking-[0.16em] uppercase">
          Votre estimation
        </p>
        <h2 className="text-fg mt-3 text-[26px] leading-[1.15] font-bold tracking-tight text-balance sm:text-[32px]">
          Vous pouvez récupérer l&apos;équivalent de{" "}
          <em className="text-terracotta not-italic">{n(report.totalSavedHoursPerYear)} heures</em>{" "}
          par an.
        </h2>

        <div className="border-terracotta/25 bg-halo-warm shadow-card relative mt-6 overflow-hidden rounded-3xl border-2 p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="bg-terracotta/15 pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl"
          />
          <p className="text-fg-soft relative text-[13px] font-semibold tracking-wide uppercase">
            Valeur annuelle de ce temps
          </p>
          <p
            className="text-fg relative mt-2 leading-none tracking-tight tabular-nums"
            style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.75rem, 11vw, 4.5rem)" }}
          >
            {eur(report.totalSavedEurPerYear)}
          </p>
          <p className="text-fg-soft relative mt-3 text-[14px] leading-relaxed">
            Fourchette réaliste : de{" "}
            <strong className="text-fg font-semibold">{eur(report.totalSavedEurLow)}</strong> à{" "}
            <strong className="text-fg font-semibold">{eur(report.totalSavedEurHigh)}</strong> selon
            votre rythme d&apos;adoption.
          </p>

          <dl className="relative mt-6 grid grid-cols-3 gap-2.5">
            <Kpi
              icon={Clock}
              value={n(report.daysFreedPerMonth)}
              unit="j"
              label="libérés par mois"
            />
            {/* Une décimale obligatoire : `fmtNumber` arrondit à l'entier par
                défaut, ce qui affichait « 0 ETP » pour 0,4 — le chiffre le plus
                démoralisant possible sous un gain à cinq chiffres. */}
            <Kpi
              icon={Users}
              value={fmtNumber(report.fteRecovered, locale, { maximumFractionDigits: 1 })}
              unit="ETP"
              label="récupérés sur l'année"
            />
            {/* Troisième repère volontairement ACTIONNABLE plutôt que
                statistique : le délai avant le premier gain répond à la seule
                question qui reste après le montant — « et concrètement, quand ? ». */}
            <Kpi
              icon={CalendarDays}
              value={n(firstActionWeeks)}
              unit="sem."
              label="avant le premier gain"
            />
          </dl>
        </div>

        <p className="text-fg-soft mt-5 text-[15px] leading-relaxed text-pretty">
          Estimation établie pour {sectorLabel}, {report.headcount} personne
          {report.headcount > 1 ? "s" : ""}, sur la base des volumes que vous venez de déclarer.
          Chaque euro affiché se rattache à une tâche précise, détaillée ci-dessous.
        </p>
        <p className="text-fg-muted mt-2 text-[13.5px] leading-relaxed text-pretty">
          Cela représente {n(report.pctOfTeamCapacity)} % du temps total de votre équipe : le
          reste, c&apos;est votre métier — et il n&apos;est pas question d&apos;y toucher.
        </p>
      </header>

      {/* ── Réglage du coût horaire ─────────────────────────────────────── */}
      <section aria-labelledby="roi-cost" className="border-border mt-8 rounded-2xl border p-5">
        <h3 id="roi-cost" className="text-fg text-[15px] font-bold tracking-tight">
          Ajustez le coût horaire chargé
        </h3>
        <p className="text-fg-muted mt-1 text-[13px] leading-relaxed">
          Salaire brut et charges patronales, ramenés à l&apos;heure travaillée. C&apos;est le seul
          réglage qui change les euros — jamais l&apos;ordre des priorités, qui se raisonne en temps.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {HOURLY_PRESETS.map((value) => {
            const active = report.hourlyCostEur === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onHourlyCostChange(value)}
                aria-pressed={active}
                className={cn(
                  "focus-visible:ring-terracotta min-h-[52px] rounded-xl border-2 text-[15px] font-bold tabular-nums transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  active
                    ? "border-terracotta bg-terracotta text-paper"
                    : "border-border bg-paper text-fg hover:border-border-strong",
                )}
              >
                {value} €
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ 2. LE PLAN D'ACTION ═════════════════════════════════════════ */}
      <section aria-labelledby="roi-plan" className="mt-12">
        <h3
          id="roi-plan"
          className="text-fg text-[22px] leading-tight font-bold tracking-tight sm:text-[26px]"
        >
          Par quoi commencer
        </h3>
        <p className="text-fg-soft mt-2 text-[15px] leading-relaxed text-pretty">
          Classées par rapport entre le gain et l&apos;effort — pas par gain brut. La première ligne
          est celle qui vous rapporte le plus vite, pas celle qui rapporte le plus.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {report.topTasks.map((result, index) => (
            <TaskCard
              key={result.task.id}
              rank={index + 1}
              result={result}
              locale={locale}
              isTop={index === 0}
            />
          ))}
        </ol>

        {report.tasks.length > report.topTasks.length ? (
          <p className="text-fg-muted mt-4 text-[13px] leading-relaxed">
            {report.tasks.length - report.topTasks.length} autre
            {report.tasks.length - report.topTasks.length > 1 ? "s" : ""} tâche
            {report.tasks.length - report.topTasks.length > 1 ? "s" : ""} chiffrée
            {report.tasks.length - report.topTasks.length > 1 ? "s" : ""} figure
            {report.tasks.length - report.topTasks.length > 1 ? "nt" : ""} dans le rapport complet.
          </p>
        ) : null}
      </section>

      {/* ═══ 3. LA FEUILLE DE ROUTE ══════════════════════════════════════ */}
      <section aria-labelledby="roi-roadmap" className="mt-12">
        <h3
          id="roi-roadmap"
          className="text-fg text-[22px] leading-tight font-bold tracking-tight sm:text-[26px]"
        >
          Dans quel ordre
        </h3>
        <p className="text-fg-soft mt-2 text-[15px] leading-relaxed text-pretty">
          Les délais tiennent compte de vos outils actuels. Ce qui est annoncé à trente jours est
          réellement livrable en trente jours.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {report.roadmap.map((wave) => (
            <li
              key={wave.id}
              className="border-border bg-paper flex flex-col gap-1.5 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="text-terracotta-deep text-[12px] font-bold tracking-[0.14em] uppercase">
                  {wave.horizonFr}
                </p>
                <p className="text-fg mt-1 text-[16px] leading-snug font-semibold">
                  {wave.labelFr}
                </p>
                <p className="text-fg-muted mt-1 text-[13px]">
                  {wave.taskIds.length} tâche{wave.taskIds.length > 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-terracotta-deep shrink-0 text-[22px] font-bold tracking-tight tabular-nums">
                {eur(wave.savedEurPerYear)}
                <span className="text-fg-muted ml-1 text-[13px] font-medium">/ an</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ═══ 4. LA VENTILATION ═══════════════════════════════════════════ */}
      {report.byFunction.length > 1 ? (
        <section aria-labelledby="roi-split" className="mt-12">
          <h3
            id="roi-split"
            className="text-fg text-[22px] leading-tight font-bold tracking-tight sm:text-[26px]"
          >
            D&apos;où vient ce temps
          </h3>
          <ul className="mt-6 flex flex-col gap-4">
            {report.byFunction.map((f) => (
              <li key={f.fn} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="text-fg font-semibold">{businessFunctionLabel(f.fn)}</span>
                  <span className="text-fg-soft shrink-0 tabular-nums">
                    {n(f.savedHoursPerYear)} h ·{" "}
                    <span className="text-fg font-semibold">{f.sharePct} %</span>
                  </span>
                </div>
                <div className="bg-border/60 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-terracotta h-full rounded-full"
                    style={{ width: `${f.sharePct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ═══ 5. LES LIMITES ══════════════════════════════════════════════ */}
      <section aria-labelledby="roi-limits" className="mt-12">
        <h3
          id="roi-limits"
          className="text-fg text-[22px] leading-tight font-bold tracking-tight sm:text-[26px]"
        >
          Ce que nous ne vous promettons pas
        </h3>

        <ul className="mt-6 flex flex-col gap-3">
          {report.nonAutomatable.map((item) => (
            <li key={item.id} className="border-border bg-sand/50 rounded-2xl border p-5">
              <p className="text-fg flex items-start gap-2.5 text-[16px] leading-snug font-semibold">
                <ShieldCheck
                  aria-hidden="true"
                  className="text-terracotta-deep mt-0.5 h-4.5 w-4.5 shrink-0"
                />
                {item.labelFr}
              </p>
              <p className="text-fg-soft mt-2 text-[14px] leading-relaxed">{item.reasonFr}</p>
            </li>
          ))}
        </ul>

        {report.unmeasuredFunctions.length > 0 ? (
          <Notice tone="info">
            Vous avez cité{" "}
            <strong className="font-semibold">
              {report.unmeasuredFunctions.map((f) => businessFunctionLabel(f).toLowerCase()).join(", ")}
            </strong>{" "}
            sans que nous ayons pu en mesurer les volumes. Ces gains-là ne sont{" "}
            <strong className="font-semibold">pas comptés</strong> dans le total ci-dessus : votre
            potentiel réel est donc supérieur à ce que ce rapport annonce.
          </Notice>
        ) : null}

        {report.capacityCapped ? (
          <Notice tone="warn">
            Les volumes déclarés sont élevés au regard de votre effectif. Nous avons volontairement
            réduit l&apos;estimation pour rester crédible — vérifiez la tranche d&apos;effectif si
            elle ne correspond pas.
          </Notice>
        ) : null}

        <details className="border-border group mt-4 rounded-2xl border">
          <summary className="text-fg flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-[15px] font-bold">
            Comment ces chiffres sont calculés
            <ChevronDown
              aria-hidden="true"
              className="text-fg-muted h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="text-fg-soft border-border/70 flex flex-col gap-3 border-t px-5 py-5 text-[14px] leading-relaxed">
            <p>
              Pour chaque tâche : votre volume annuel, multiplié par un temps unitaire de référence,
              multiplié par la part de ce temps réellement supprimable. Le résultat est ensuite
              modulé par vos outils actuels.
            </p>
            <p>
              Les temps unitaires et les taux d&apos;automatisation sont des{" "}
              <strong className="text-fg font-semibold">hypothèses de modèle argumentées</strong>,
              pas les résultats d&apos;une étude. Chaque tâche du plan d&apos;action affiche la
              sienne : dépliez « Pourquoi ce chiffre ».
            </p>
            <p>
              Base de calcul : {ROI_MODEL_CONSTANTS.workingDaysPerYear} jours ouvrés,{" "}
              {ROI_MODEL_CONSTANTS.hoursPerDay} heures par jour,{" "}
              {n(ROI_MODEL_CONSTANTS.annualHoursPerFte)} heures pour un équivalent temps plein
              (durée légale française). Coût horaire retenu : {eur(report.hourlyCostEur)}.
            </p>
            <p className="text-fg-muted">
              Ce rapport est une estimation, pas un engagement de résultat, et ne constitue ni un
              devis ni un audit. Vos résultats réels dépendent de vos process et de votre adoption
              interne.
            </p>
          </div>
        </details>
      </section>

      {/* ═══ 6. L'ACTION ═════════════════════════════════════════════════ */}
      <section aria-labelledby="roi-next" className="mt-12">
        <h3
          id="roi-next"
          className="text-fg text-[22px] leading-tight font-bold tracking-tight sm:text-[26px]"
        >
          Repartez avec ce rapport
        </h3>
        <ReportEmailForm report={report} locale={locale} className="mt-5" />

        <ShareRow />

        <div className="bg-mocha mt-8 rounded-3xl p-6 sm:p-8">
          <p className="text-mocha-fg text-[19px] leading-snug font-bold tracking-tight text-balance sm:text-[22px]">
            Cette estimation repose sur ce que vous avez déclaré. Un audit la remplace par des
            mesures.
          </p>
          <p className="text-mocha-fg/80 mt-3 text-[14.5px] leading-relaxed text-pretty">
            Nous relevons vos tâches réelles, nous mesurons le temps qu&apos;elles coûtent, et nous
            livrons un plan d&apos;implémentation chiffré. Ce n&apos;est plus une hypothèse : c&apos;est
            votre entreprise.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href="/audit" variant="primary" size="lg" track="roi-report-audit">
              Demander un audit
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/appel" variant="outline" size="lg" track="roi-report-appel">
              Réserver un appel
            </Cta>
          </div>
        </div>
      </section>

      {/* ── Reprise du questionnaire ────────────────────────────────────── */}
      {!funnel ? (
        <div className="border-border mt-10 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-fg-soft hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Modifier mes réponses
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="text-fg-soft hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Recommencer
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function Kpi({
  icon: Icon,
  value,
  unit,
  label,
}: {
  icon: typeof Clock;
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <div className="bg-paper border-border rounded-2xl border p-3">
      <Icon aria-hidden="true" className="text-terracotta-deep mb-1.5 h-4 w-4" />
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="text-fg text-[22px] leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="text-fg-muted ml-1 text-[12px] font-medium">{unit}</span>
        <span className="text-fg-soft mt-1.5 block text-[11.5px] leading-snug">{label}</span>
      </dd>
    </div>
  );
}

function TaskCard({
  rank,
  result,
  locale,
  isTop,
}: {
  rank: number;
  result: TaskResult;
  locale: Locale;
  isTop: boolean;
}) {
  const { task } = result;
  const n = (v: number) => fmtNumber(v, locale);
  const eur = (v: number) => fmtCurrency(v, locale);

  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-5",
        isTop ? "border-terracotta bg-terracotta-soft/40" : "border-border bg-paper",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold tabular-nums",
            isTop ? "bg-terracotta text-paper" : "bg-sand text-fg-soft",
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-fg text-[17px] leading-snug font-bold tracking-tight text-balance">
            {task.labelFr}
          </h4>
          <p className="text-fg-muted mt-1 text-[13px]">
            {businessFunctionLabel(task.fn)} · {n(Math.round(result.annualVolume))}{" "}
            {volumeUnitLabel(task.volumeKey, result.annualVolume)} par an
          </p>
        </div>
      </div>

      {/* Chiffres — la ligne que le dirigeant lit en premier. */}
      <dl className="border-border/70 mt-4 grid grid-cols-3 gap-3 border-t pt-4">
        <div>
          <dt className="text-fg-muted text-[11px] font-semibold tracking-wide uppercase">
            Temps rendu
          </dt>
          <dd className="text-fg mt-0.5 text-[17px] font-bold tabular-nums">
            {n(Math.round(result.savedHoursPerYear))} h
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-[11px] font-semibold tracking-wide uppercase">
            Valeur
          </dt>
          <dd className="text-terracotta-deep mt-0.5 text-[17px] font-bold tabular-nums">
            {eur(Math.round(result.savedEurPerYear))}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-[11px] font-semibold tracking-wide uppercase">
            Délai
          </dt>
          <dd className="text-fg mt-0.5 text-[17px] font-bold tabular-nums">
            {result.weeksToValue} sem.
          </dd>
        </div>
      </dl>

      <p className="text-fg-soft mt-4 text-[14px] leading-relaxed text-pretty">{task.howFr}</p>

      <details className="group mt-3">
        <summary className="text-fg-muted hover:text-terracotta inline-flex cursor-pointer list-none items-center gap-1.5 py-2 text-[13px] font-semibold transition">
          Pourquoi ce chiffre
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
          />
        </summary>
        <p className="text-fg-soft border-terracotta/40 mt-1 border-l-2 pl-3 text-[13.5px] leading-relaxed">
          {task.proofFr} Sur cette base, vous y passez aujourd&apos;hui environ{" "}
          {n(Math.round(result.currentHoursPerYear))} heures par an.
        </p>
      </details>
    </li>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mt-4 flex gap-2.5 rounded-2xl border p-4 text-[14px] leading-relaxed",
        tone === "warn"
          ? "border-terracotta/40 bg-terracotta-soft/40 text-fg"
          : "border-border bg-canvas text-fg-soft",
      )}
    >
      <AlertTriangle
        aria-hidden="true"
        className="text-terracotta-deep mt-0.5 h-4 w-4 shrink-0"
      />
      <span>{children}</span>
    </p>
  );
}

/**
 * Copie du lien. Le partage interne — au comité de direction, à l'associé, à
 * l'expert-comptable — est le canal de diffusion le plus efficace de ce
 * rapport, et le seul qui soit gratuit.
 */
function ShareRow() {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(() => {
    if (typeof window === "undefined") return;
    void navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2400);
      },
      // Le presse-papiers peut être refusé (contexte non sécurisé, permission
      // navigateur) : on ne casse rien, l'URL reste sélectionnable à la main.
      () => setCopied(false),
    );
  }, []);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={copy}
        className="text-fg-soft border-border hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 text-[14.5px] font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
      >
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Link2 aria-hidden="true" className="h-4 w-4" />
        )}
        {copied ? "Lien copié" : "Copier le lien de ce rapport"}
      </button>
      <p aria-live="polite" className="sr-only">
        {copied ? "Lien copié dans le presse-papiers." : ""}
      </p>
      <p className="text-fg-muted mt-2 text-[12.5px] leading-relaxed">
        Le lien contient vos réponses : la personne qui l&apos;ouvre voit exactement ce rapport.
      </p>
    </div>
  );
}

function EmptyReport({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
  return (
    <div className="border-border bg-paper rounded-3xl border p-6 sm:p-8">
      <h2 className="text-fg text-[24px] leading-tight font-bold tracking-tight">
        Nous n&apos;avons rien pu chiffrer
      </h2>
      <p className="text-fg-soft mt-3 text-[15px] leading-relaxed text-pretty">
        Vous avez répondu « je ne sais pas » à toutes les questions de volume, ou déclaré des
        volumes nuls. Plutôt que d&apos;inventer des chiffres, nous préférons ne rien afficher.
        Reprenez le questionnaire avec des ordres de grandeur, même approximatifs : c&apos;est
        largement suffisant.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Revenir aux questions
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="text-fg-soft border-border hover:border-terracotta focus-visible:ring-terracotta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border px-6 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Recommencer
        </button>
      </div>
    </div>
  );
}
