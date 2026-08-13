"use client";
// use-client: machine à états du parcours (écran courant, réponses, sauvegarde localStorage, soumission async).
// Candidature commerciale — orchestrateur du wizard (tunnel sans CV,
// Mémorial de l’Isère 2026-08-12).
//
// Un écran = une question (ou un petit groupe). Barre d’avancement permanente
// + « Étape X sur 9 ». Retour arrière sans perte. Sauvegarde auto en
// localStorage : le candidat peut fermer et revenir, il reprend où il était.
//
// Défilement + focus à chaque changement d’écran (pattern du simulateur v2) :
// sans cela, sur mobile, celui qui répond en bas d’écran voit la question
// suivante déjà défilée et croit avoir sauté une étape.

import * as React from "react";
import { useLocale } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { submitCommercialApplicationAction } from "@/features/commercial-application/actions";
import { trackFunnel } from "@/lib/tracking";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { GhostButton, PrimaryButton, StepTransition } from "./ui";
import {
  StepB2b,
  StepDetails,
  StepIa,
  StepIdentite,
  StepInformatique,
  StepMessage,
  StepParcours,
  StepPitch,
  StepZone,
} from "./steps";
import {
  buildSubmissionPayload,
  clearDraft,
  emptyAnswers,
  loadDraft,
  newExperience,
  saveDraft,
  validateStep,
  type ExperienceDraft,
  type FieldErrors,
  type WizardAnswers,
} from "./wizard-state";

const TOTAL_STEPS = 9;

/** Promesse de l'écran d'accueil — commission commerciale de recrutement,
 *  pas un tarif client. */
const PROMESSE_COMMISSION = "500 € par journée de formation vendue"; // price-exempt: commission recrutement

/** Noms d'écrans des événements Plausible « Candidature Step » — anonymes,
 *  jamais de donnée personnelle (doctrine privacy-first de lib/tracking). */
const STEP_NAMES: readonly string[] = [
  "accueil",
  "identite",
  "b2b",
  "parcours",
  "ia",
  "informatique",
  "zone",
  "pitch",
  "message",
  "details",
];

export function CommercialApplicationWizard(): React.ReactNode {
  const locale = useLocale();
  // 0 = accueil, 1..9 = étapes, 10 = confirmation.
  const [screen, setScreen] = React.useState(0);
  const [answers, setAnswers] = React.useState<WizardAnswers>(emptyAnswers);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submissionId, setSubmissionId] = React.useState<string>("");
  // Confirmation inline avant de quitter l'étape expériences (retour Will
  // 2026-08-13) — jamais de window.confirm.
  const [confirmParcours, setConfirmParcours] = React.useState(false);

  const formRef = React.useRef<HTMLFormElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);
  const restored = React.useRef(false);

  // ── Reprise d’un brouillon (localStorage) ────────────────────────────────
  // En effet (pas au premier rendu) pour ne jamais désynchroniser l’hydratation ;
  // microtask defer = pattern maison contre le lint react-hooks/set-state-in-effect.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const draft = loadDraft();
      restored.current = true;
      if (!draft) return;
      setAnswers(draft.answers);
      setScreen(draft.screen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Sauvegarde auto ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!restored.current || screen >= 10) return;
    saveDraft(screen, answers);
  }, [screen, answers]);

  // ── Défilement + focus au changement d’écran ─────────────────────────────
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  // ── Analytics d'abandon (Plausible, anonyme — retour Will 2026-08-13) ────
  // Un événement par écran ATTEINT : le funnel montre où les candidats
  // décrochent. Aucune donnée personnelle, uniquement le nom d'écran.
  React.useEffect(() => {
    if (screen < 1 || screen > TOTAL_STEPS) return;
    trackFunnel("Candidature Step", {
      step: STEP_NAMES[screen] ?? String(screen),
      stepIndex: screen,
      stepTotal: TOTAL_STEPS,
    });
  }, [screen]);

  const set = React.useCallback((patch: Partial<WizardAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Expériences (étape 3) ────────────────────────────────────────────────
  const patchExperience = React.useCallback((id: string, patch: Partial<ExperienceDraft>) => {
    setAnswers((prev) => ({
      ...prev,
      experiences: prev.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const addExperience = React.useCallback(() => {
    setAnswers((prev) => {
      if (prev.experiences.length >= 8) return prev;
      // Les blocs déjà remplis se replient : jamais un mur de champs.
      return {
        ...prev,
        experiences: [...prev.experiences.map((e) => ({ ...e, open: false })), newExperience()],
      };
    });
  }, []);

  const removeExperience = React.useCallback((id: string) => {
    setAnswers((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((e) => e.id !== id),
    }));
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goBack = React.useCallback(() => {
    setErrors({});
    setServerError(null);
    setConfirmParcours(false);
    setScreen((s) => Math.max(0, s - 1));
  }, []);

  const submitToServer = React.useCallback(async () => {
    setSubmitting(true);
    setServerError(null);
    try {
      const fd = formRef.current ? new FormData(formRef.current) : new FormData();
      fd.set("payload", JSON.stringify(buildSubmissionPayload(answers)));
      fd.set("locale", locale);
      const result = await submitCommercialApplicationAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        setServerError(result.error || "Une erreur est survenue. Réessaie.");
        return;
      }
      setSubmissionId(result.submissionId);
      trackFunnel("Candidature Completed");
      clearDraft();
      setScreen(10);
    } catch (err) {
      setServerError(
        isStaleServerActionError(err)
          ? "Cette page a expiré suite à une mise à jour du site. Recharge la page — tes réponses sont sauvegardées, tu ne perdras rien."
          : "Une erreur est survenue. Réessaie dans un instant.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [answers, locale]);

  const goNext = React.useCallback(() => {
    if (screen === 0) {
      trackFunnel("Candidature Started");
      setScreen(1);
      return;
    }
    const stepErrors = validateStep(screen, answers);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      setConfirmParcours(false);
      return;
    }
    // Étape expériences : une confirmation inline avant de continuer (retour
    // Will 2026-08-13) — premier « Continuer » pose la question, la réponse
    // se donne dans le panneau (ou par un second « Continuer »).
    if (screen === 3 && !confirmParcours) {
      setConfirmParcours(true);
      return;
    }
    setConfirmParcours(false);
    if (screen < TOTAL_STEPS) {
      setScreen(screen + 1);
      return;
    }
    void submitToServer();
  }, [screen, answers, confirmParcours, submitToServer]);

  const onFormSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || screen >= 10) return;
      goNext();
    },
    [goNext, screen, submitting],
  );

  // ── Écran de confirmation 🎉 ─────────────────────────────────────────────
  if (screen >= 10) {
    return (
      <div ref={topRef} className="scroll-mt-24">
        <StepTransition>
          <div
            className="bg-paper border-terracotta/30 shadow-card rounded-3xl border-2 p-7 sm:p-10"
            role="status"
          >
            <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
              <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-4 w-4" />
              <span className="text-terracotta-deep text-sm font-semibold">
                Candidature envoyée
              </span>
            </div>
            <h2 className="text-fg text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">
              C’est envoyé 🎉
            </h2>
            <p className="text-fg mt-4 text-lg leading-relaxed">
              Tu vas recevoir un email de confirmation dans les prochaines minutes. Pense à vérifier
              tes spams.
            </p>
            <p className="text-fg-soft mt-3 leading-relaxed">
              Si ta candidature est retenue, on te contacte par email pour caler un premier échange
              en visio de 15 à 30 minutes.
            </p>
            {submissionId ? (
              <p className="text-fg-muted mt-4 font-mono text-xs">Réf. {submissionId}</p>
            ) : null}
          </div>
        </StepTransition>
      </div>
    );
  }

  const pct = screen === 0 ? 0 : Math.round((screen / TOTAL_STEPS) * 100);

  return (
    <div ref={topRef} className="scroll-mt-24">
      <form ref={formRef} onSubmit={onFormSubmit} noValidate>
        <HoneypotField />

        {screen > 0 ? (
          <div className="mb-7">
            <div className="text-fg-muted mb-2 flex items-baseline justify-between text-[12px] font-bold tracking-[0.14em] uppercase">
              <span>Ta candidature</span>
              <span className="tabular-nums">
                Étape {screen} sur {TOTAL_STEPS}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progression : étape ${screen} sur ${TOTAL_STEPS}`}
              className="bg-border/70 h-1.5 w-full overflow-hidden rounded-full"
            >
              <div
                className="bg-terracotta h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <StepTransition key={screen}>
            {screen === 0 ? (
              /* Accueil enrichi (retour Will 2026-08-13 « blocosse, trop
                 vide ») : mini-cartes + rappel de la promesse, dans le langage
                 visuel du site (cartes serif, terracotta — cf. memo-isere). */
              <div className="text-center sm:text-left">
                <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
                  <span
                    aria-hidden="true"
                    className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                  />
                  <span className="text-terracotta-deep text-sm font-semibold">
                    Candidatures ouvertes
                  </span>
                </div>
                <h1 className="text-fg text-[32px] leading-[1.1] font-bold tracking-tight text-balance sm:text-[40px]">
                  Rejoins Axion-IA — commercial indépendant 👋
                </h1>
                <p className="text-fg-soft mt-5 text-lg leading-relaxed text-pretty">
                  Pas de CV. Pas de lettre de motivation. Juste quelques questions essentielles.
                </p>

                <ul className="mt-7 grid grid-cols-1 gap-3 text-left sm:grid-cols-3" role="list">
                  {[
                    {
                      emoji: "✅",
                      title: "Zéro CV",
                      text: "Un message libre remplace la lettre de motivation.",
                    },
                    {
                      emoji: "⏱️",
                      title: "3 minutes",
                      text: "Une question par écran, à portée de pouce.",
                    },
                    {
                      emoji: "💾",
                      title: "Reprise possible",
                      text: "Tes réponses sont sauvegardées sur ton appareil : ferme, reviens, tu reprends où tu étais.",
                    },
                  ].map((c) => (
                    <li
                      key={c.title}
                      className="border-border bg-paper shadow-subtle rounded-2xl border p-4"
                    >
                      <p className="text-fg font-serif text-lg leading-snug font-semibold">
                        <span aria-hidden="true" className="mr-1.5">
                          {c.emoji}
                        </span>
                        {c.title}
                      </p>
                      <p className="text-fg-soft mt-1 text-sm leading-relaxed">{c.text}</p>
                    </li>
                  ))}
                </ul>

                <div className="border-terracotta/30 bg-terracotta-soft/40 mt-4 rounded-2xl border px-5 py-4 text-left">
                  <p className="text-terracotta-deep font-serif text-xl leading-snug font-semibold">
                    {PROMESSE_COMMISSION}
                  </p>
                  <p className="text-fg-soft mt-1 text-sm leading-relaxed">
                    Revenus non plafonnés, statut indépendant, secteur à toi.
                  </p>
                </div>
              </div>
            ) : null}
            {screen === 1 ? <StepIdentite a={answers} set={set} errors={errors} /> : null}
            {screen === 2 ? <StepB2b a={answers} set={set} errors={errors} /> : null}
            {screen === 3 ? (
              <StepParcours
                a={answers}
                set={set}
                errors={errors}
                onPatchExperience={patchExperience}
                onAddExperience={addExperience}
                onRemoveExperience={removeExperience}
              />
            ) : null}
            {screen === 4 ? <StepIa a={answers} set={set} errors={errors} /> : null}
            {screen === 5 ? <StepInformatique a={answers} set={set} errors={errors} /> : null}
            {screen === 6 ? <StepZone a={answers} set={set} errors={errors} /> : null}
            {screen === 7 ? <StepPitch a={answers} set={set} errors={errors} /> : null}
            {screen === 8 ? <StepMessage a={answers} set={set} errors={errors} /> : null}
            {screen === 9 ? <StepDetails a={answers} set={set} errors={errors} /> : null}
          </StepTransition>
        </div>

        {screen === 3 && confirmParcours ? (
          <div
            className="border-terracotta bg-terracotta-soft/50 mt-6 rounded-2xl border-2 p-5"
            role="group"
            aria-label="Confirmation de ton parcours"
          >
            <p className="text-fg font-semibold">
              Es-tu sûr d’avoir mis TOUTES tes expériences professionnelles des 10 dernières années
              ?
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setConfirmParcours(false);
                  setScreen(4);
                }}
                className="bg-terracotta focus-visible:ring-terracotta inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold text-white transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                Oui, je continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmParcours(false);
                  addExperience();
                }}
                className="border-terracotta text-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border-2 px-5 text-[15px] font-semibold transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                J’en ajoute une
              </button>
            </div>
          </div>
        ) : null}

        {serverError ? (
          <p
            className="text-terracotta-deep bg-terracotta-soft mt-6 rounded-xl px-4 py-3 text-sm"
            role="alert"
          >
            {serverError}
          </p>
        ) : null}

        {/* Boutons pleine largeur en bas d’écran — à portée du pouce. */}
        <div className="mt-8">
          <PrimaryButton type="submit" disabled={submitting}>
            {screen === 0 ? (
              <>
                Je commence
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            ) : screen === TOTAL_STEPS ? (
              submitting ? (
                "Envoi en cours…"
              ) : (
                <>
                  J’envoie ma candidature
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </>
              )
            ) : (
              <>
                Continuer
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </PrimaryButton>
          {screen > 0 ? (
            <div className="mt-3">
              <GhostButton type="button" onClick={goBack} disabled={submitting}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Revenir à l’écran précédent
              </GhostButton>
            </div>
          ) : null}
        </div>

        {screen === 0 ? (
          <p className="text-fg-muted mt-6 text-xs leading-relaxed">
            RGPD · UE — tes données ne servent qu’à l’étude de ta candidature et sont conservées 2
            ans au maximum.
          </p>
        ) : null}
      </form>
    </div>
  );
}
