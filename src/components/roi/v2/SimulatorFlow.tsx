"use client";
// use-client: machine à états du parcours (étape courante, réponses, synchronisation de l'URL par replaceState).
// Simulateur de gains v2 — orchestrateur du parcours.
//
// ── Gestion de l'état et de l'URL ─────────────────────────────────────────
// L'étape courante vit dans React ; les RÉPONSES vivent dans l'URL, mises à
// jour par `history.replaceState`. Ce choix est délibéré :
//
//   • `replaceState` n'ajoute aucune entrée d'historique, donc le routeur de
//     Next n'observe jamais de `popstate` et ne re-rend jamais la route. Sur
//     mobile en 4G, un aller-retour serveur par question serait rédhibitoire.
//   • L'URL reste néanmoins toujours à jour : un rechargement ne perd rien, et
//     le lien du rapport est partageable tel quel.
//   • Le retour en arrière se fait par un bouton explicite, large et placé en
//     bas — à portée du pouce, contrairement au chevron du navigateur.
//
// ── Défilement et focus ───────────────────────────────────────────────────
// À chaque changement d'écran on ramène la vue en haut du bloc et on déplace
// le focus sur le titre. Sans cela, sur mobile, l'utilisateur qui répond à une
// question située en bas d'écran voit la suivante déjà défilée : il croit
// avoir sauté une étape.

import * as React from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import type { RoiAnswers } from "@/content/roi/model/types";
import { diagnose } from "@/lib/roi/diagnose";
import { gainBucketOf, trackFunnel } from "@/lib/tracking";
import { REPORT_QUERY_PARAM, ROI_QUERY_PARAM, encodeAnswers } from "@/lib/roi/encode";
import {
  FRAMING_STEPS,
  applyStepAnswer,
  buildSteps,
  firstUnansweredIndex,
  selectedOptionIds,
  type Step,
} from "./steps";
import { ChoiceScreen } from "./ChoiceScreen";
import { ReportView } from "./ReportView";

const EMPTY_ANSWERS: RoiAnswers = {
  sector: "generique",
  headcount: "2-5",
  maturity: "outille",
  functions: [],
  volumes: {},
};

/**
 * Reconstruit l'ensemble des écrans déjà répondus à partir de réponses venues
 * de l'URL. Le cadrage est réputé répondu dès qu'un diagnostic a été décodé —
 * ses trois premiers champs ont toujours une valeur, on ne peut pas distinguer
 * « choisi » de « valeur par défaut ». Les volumes, eux, sont explicites.
 */
function seedAnswered(initial: RoiAnswers | null | undefined): ReadonlySet<string> {
  if (!initial) return new Set<string>();
  const seed = new Set<string>(["sector", "headcount", "maturity"]);
  if (initial.functions.length > 0) seed.add("functions");
  for (const key of Object.keys(initial.volumes)) seed.add(`volume:${key}`);
  return seed;
}

interface SimulatorFlowProps {
  locale: Locale;
  /** Réponses décodées depuis l'URL, si le visiteur arrive par un lien partagé. */
  initialAnswers?: RoiAnswers | null;
  /** True si l'URL portait le marqueur de rapport terminé. */
  initialShowReport?: boolean;
  /** Variante tunnel : masque les liens de sortie autres que les CTA. */
  funnel?: boolean;
  /**
   * Habillage. `light` sur `/roi`, page éditoriale ivoire ; `dark` dans le
   * tunnel publicitaire, pour être dans la continuité visuelle de
   * `/diagnostic`. Le basculement passe entièrement par les variables de
   * `.sim-scope` (cf. `globals.css`) : aucun composant n'est dupliqué, donc
   * aucune correction ne peut s'appliquer à un habillage et pas à l'autre.
   */
  tone?: "light" | "dark";
  className?: string;
}

export function SimulatorFlow({
  locale,
  initialAnswers,
  initialShowReport = false,
  funnel = false,
  tone = "light",
  className,
}: SimulatorFlowProps) {
  const [answers, setAnswers] = React.useState<RoiAnswers>(initialAnswers ?? EMPTY_ANSWERS);
  const [showReport, setShowReport] = React.useState(initialShowReport);

  // Un écran répondu reste marqué comme tel même si la réponse « je ne sais
  // pas » ne laisse aucune trace dans `answers` — sans quoi la sélection
  // disparaîtrait visuellement au retour en arrière.
  const [answered, setAnswered] = React.useState<ReadonlySet<string>>(() =>
    seedAnswered(initialAnswers),
  );

  // Reprise d'un parcours interrompu : rechargement de page, retour depuis un
  // autre onglet, ou lien à demi rempli reçu d'un collègue. On repart au
  // premier écran SANS réponse plutôt qu'au début — refaire quatre écrans déjà
  // remplis est le meilleur moyen de perdre quelqu'un à la reprise.
  const [stepIndex, setStepIndex] = React.useState(() =>
    initialAnswers
      ? Math.min(
          firstUnansweredIndex(
            initialAnswers,
            buildSteps(initialAnswers.functions),
            seedAnswered(initialAnswers),
          ),
          buildSteps(initialAnswers.functions).length - 1,
        )
      : 0,
  );

  const steps = React.useMemo(() => buildSteps(answers.functions), [answers.functions]);
  const step: Step | undefined = steps[stepIndex];

  const headingRef = React.useRef<HTMLDivElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  // Le tout premier rendu ne doit pas voler le focus ni défiler : la page
  // vient de s'ouvrir, l'utilisateur lit le titre au-dessus du simulateur.
  const isFirstRender = React.useRef(true);

  // ── Synchronisation de l'URL ────────────────────────────────────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set(ROI_QUERY_PARAM, encodeAnswers(answers));
    if (showReport) url.searchParams.set(REPORT_QUERY_PARAM, "1");
    else url.searchParams.delete(REPORT_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [answers, showReport]);

  // ── Défilement et focus au changement d'écran ───────────────────────────
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Défilement INSTANTANÉ, pas fluide : l'écran change entièrement de contenu,
    // regarder défiler la question précédente vers le haut n'apporte aucune
    // continuité et retarde la lecture. Le mouvement fluide entrerait en outre
    // en conflit avec le `focus()` qui suit, et il ignore
    // `prefers-reduced-motion`.
    topRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex, showReport]);

  const report = React.useMemo(() => diagnose(answers), [answers]);

  // ── Mesure du tunnel ────────────────────────────────────────────────────
  // Sans événement par écran, on ne saurait qu'une chose — combien de gens
  // arrivent au bout — ce qui n'indique jamais QUELLE question fait décrocher.
  const hasStarted = React.useRef(initialAnswers != null);
  const reportTracked = React.useRef(false);

  React.useEffect(() => {
    if (!showReport || reportTracked.current) return;
    reportTracked.current = true;
    trackFunnel("Simulator Completed", {
      sector: answers.sector,
      headcount: answers.headcount,
      taskCount: report.tasks.length,
      gainBucket: gainBucketOf(report.totalSavedEurPerYear),
    });
  }, [answers.headcount, answers.sector, report, showReport]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const goNext = React.useCallback(
    (nextAnswers: RoiAnswers, answeredStep: Step) => {
      // Le parcours est recalculé à partir des NOUVELLES réponses : cocher une
      // fonction supplémentaire allonge la suite immédiatement.
      const nextSteps = buildSteps(nextAnswers.functions);

      if (!hasStarted.current) {
        hasStarted.current = true;
        trackFunnel("Simulator Started", { sector: nextAnswers.sector });
      }
      trackFunnel("Simulator Step", {
        step: answeredStep.id,
        stepIndex: stepIndex + 1,
        stepTotal: nextSteps.length,
      });

      if (stepIndex + 1 >= nextSteps.length) setShowReport(true);
      else setStepIndex(stepIndex + 1);
    },
    [stepIndex],
  );

  const handleSelect = React.useCallback(
    (optionIds: readonly string[]) => {
      if (!step) return;
      const next = applyStepAnswer(answers, step, optionIds, answered.has("functions"));
      setAnswers(next);
      setAnswered((prev) => new Set(prev).add(step.id));

      // Choix unique : on enchaîne seul. Le court délai laisse voir la réponse
      // se sélectionner — sans lui, l'écran change avant que l'œil ait
      // enregistré son propre appui, ce qui donne une impression d'erreur.
      if (step.kind !== "multi") {
        window.setTimeout(() => goNext(next, step), 180);
      }
    },
    [answered, answers, goNext, step],
  );

  const handleContinue = React.useCallback(() => {
    if (!step) return;
    setAnswered((prev) => new Set(prev).add(step.id));
    goNext(answers, step);
  }, [answers, goNext, step]);

  const goBack = React.useCallback(() => {
    if (showReport) {
      setShowReport(false);
      setStepIndex(Math.max(0, buildSteps(answers.functions).length - 1));
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }, [answers.functions, showReport]);

  const setHourlyCost = React.useCallback((value: number) => {
    setAnswers((prev) => ({ ...prev, hourlyCostEur: value }));
  }, []);

  const restart = React.useCallback(() => {
    setAnswers(EMPTY_ANSWERS);
    setAnswered(new Set());
    setStepIndex(0);
    setShowReport(false);
  }, []);

  // ── Rapport ─────────────────────────────────────────────────────────────
  if (showReport) {
    return (
      <div ref={topRef} data-tone={tone} className={cn("sim-scope scroll-mt-24", className)}>
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <ReportView
            locale={locale}
            report={report}
            funnel={funnel}
            onBack={goBack}
            onRestart={restart}
            onHourlyCostChange={setHourlyCost}
          />
        </div>
      </div>
    );
  }

  if (!step) return null;

  // ── Progression ─────────────────────────────────────────────────────────
  // Deux phases distinctes, chacune avec son propre compteur. Un compteur
  // unique reculerait au moment où l'utilisateur choisit ses fonctions (le
  // total passe de 4 à 4+N) : une barre de progression qui recule donne le
  // sentiment que le questionnaire n'en finira jamais.
  const isFraming = stepIndex < FRAMING_STEPS.length;
  const phaseLabel = isFraming ? "Votre entreprise" : "Vos volumes";
  const phaseIndex = isFraming ? stepIndex : stepIndex - FRAMING_STEPS.length;
  const phaseTotal = isFraming ? FRAMING_STEPS.length : steps.length - FRAMING_STEPS.length;
  const pct = Math.round(((phaseIndex + 1) / Math.max(1, phaseTotal)) * 100);

  // 🔴 Le pré-cochage sectoriel remplit `answers.functions` au moment où le
  // SECTEUR est choisi — donc sans passer par l'écran des fonctions, donc sans
  // entrer dans `answered`. En ne se fiant qu'à `answered`, l'écran s'affichait
  // entièrement décoché, sous un texte qui annonce « nous avons coché ce qui
  // existe chez presque tous les acteurs de votre secteur », avec le bouton
  // « Continuer » DÉSACTIVÉ. Le parcours était bloqué net pour tout le monde.
  //
  // Le test unitaire ne pouvait pas le voir : il vérifiait `applyStepAnswer`,
  // qui remplissait bien les fonctions. C'est le chemin d'AFFICHAGE qui était
  // rompu. Défaut trouvé par le parcours automatisé de bout en bout.
  //
  // La règle est donc DÉRIVÉE DE LA DONNÉE et non d'un état parallèle : des
  // fonctions présentes sont des fonctions cochées, quelle que soit leur
  // origine. Deux sources de vérité se seraient désynchronisées de nouveau.
  const isDisplayedAsAnswered =
    answered.has(step.id) || (step.kind === "multi" && answers.functions.length > 0);
  const selected = isDisplayedAsAnswered ? selectedOptionIds(answers, step) : [];
  const identifiedTasks = report.tasks.length;

  return (
    <div ref={topRef} data-tone={tone} className={cn("sim-scope scroll-mt-24", className)}>
      {/* ── Progression ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="mb-2 flex items-baseline justify-between text-[12px] font-bold tracking-[0.14em] text-[var(--sim-fg-muted)] uppercase">
          <span>{phaseLabel}</span>
          <span className="tabular-nums">
            {phaseIndex + 1} / {phaseTotal}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression : ${phaseLabel}, étape ${phaseIndex + 1} sur ${phaseTotal}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sim-border)]/70"
        >
          <div
            className="bg-terracotta h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Question ────────────────────────────────────────────────────── */}
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <ChoiceScreen
          key={step.id}
          step={step}
          selected={selected}
          onSelect={handleSelect}
          onContinue={handleContinue}
        />
      </div>

      {/* ── Retour de valeur en cours de route ──────────────────────────── */}
      {/* Entre la cinquième et la dixième question, l'utilisateur n'a encore
          rien reçu : c'est là qu'on le perd. Ce compteur lui montre que son
          effort produit déjà quelque chose. Il est exact — ce sont les tâches
          réellement chiffrées à cet instant — donc il ne promet rien de faux. */}
      {!isFraming && identifiedTasks > 0 ? (
        <p
          aria-live="polite"
          className="mt-6 flex items-center gap-2.5 rounded-2xl border border-[var(--sim-accent-border)]/30 bg-[var(--sim-accent-soft)] px-4 py-3 text-[14px] leading-snug font-medium text-[var(--sim-fg)]"
        >
          <Sparkles
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--sim-accent-strong)]"
          />
          <span>
            {identifiedTasks} tâche{identifiedTasks > 1 ? "s" : ""} automatisable
            {identifiedTasks > 1 ? "s" : ""} déjà identifiée{identifiedTasks > 1 ? "s" : ""} chez
            vous.
          </span>
        </p>
      ) : null}

      {/* ── Retour ──────────────────────────────────────────────────────── */}
      {stepIndex > 0 ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={goBack}
            className="focus-visible:ring-terracotta inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-[var(--sim-fg-soft)] transition hover:text-[var(--sim-accent-text)] focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Revenir à la question précédente
          </button>
        </div>
      ) : null}

      <p className="mt-8 text-[12.5px] leading-relaxed text-[var(--sim-fg-muted)]">
        {stepIndex === 0
          ? "Une dizaine de questions, environ trois minutes. Aucune inscription, et rien n'est transmis : tout se calcule dans votre navigateur."
          : "Aucune inscription, aucune donnée transmise pendant le questionnaire : tout se calcule dans votre navigateur."}
      </p>
    </div>
  );
}
