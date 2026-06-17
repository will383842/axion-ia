"use client";
// use-client: formulaire interactif multi-étapes (état React des réponses, navigation, honeypot, soumission async via Server Action).

import { useMemo, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { submitBarometerResponse } from "@/server/actions/observatoire/public";

export interface FormOption {
  readonly value: string;
  readonly label: string;
}
export interface FormQuestion {
  readonly id: string;
  readonly type: "single" | "multi";
  readonly label: string;
  readonly hint?: string | undefined;
  readonly options: ReadonlyArray<FormOption>;
  readonly maxSelections?: number | undefined;
  readonly conditionalOnMaturityPoc?: boolean | undefined;
}

interface BarometerFormProps {
  readonly questions: ReadonlyArray<FormQuestion>;
  readonly locale: "fr" | "en";
  readonly maturityGePoc: ReadonlyArray<string>;
  readonly labels: {
    stepOf: string; // "Étape {current} sur {total}" — {current}/{total} remplacés ici
    next: string;
    previous: string;
    submit: string;
    submitting: string;
    required: string;
    thanksTitle: string;
    thanksBody: string;
    seeResults: string;
    error: string;
  };
}

type Answers = Record<string, string | string[]>;

export function BarometerForm({ questions, locale, maturityGePoc, labels }: BarometerFormProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [startedAt] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  // Questions visibles : satisfaction masquée si maturité < POC.
  const visible = useMemo(() => {
    const maturity = answers["maturityLevel"];
    const showSat = typeof maturity === "string" && maturityGePoc.includes(maturity);
    return questions.filter((q) => (q.conditionalOnMaturityPoc ? showSat : true));
  }, [questions, answers, maturityGePoc]);

  const total = visible.length;
  const current = visible[Math.min(step, total - 1)];

  function setSingle(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setError(null);
  }
  function toggleMulti(id: string, value: string, max?: number) {
    setAnswers((a) => {
      const prev = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      let next: string[];
      if (prev.includes(value)) next = prev.filter((v) => v !== value);
      else if (max && prev.length >= max)
        next = prev; // bloqué au max
      else next = [...prev, value];
      return { ...a, [id]: next };
    });
    setError(null);
  }

  function stepAnswered(q: FormQuestion): boolean {
    const v = answers[q.id];
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    return typeof v === "string" && v.length > 0;
  }

  function goNext() {
    if (!current || !stepAnswered(current)) {
      setError(labels.required);
      return;
    }
    setError(null);
    if (step < total - 1) setStep((s) => s + 1);
    else void submit();
  }

  async function submit() {
    const payload = { ...answers, locale, website, startedAt };
    startTransition(async () => {
      const res = await submitBarometerResponse(payload);
      if (res.ok) setDone(true);
      else setError(res.error || labels.error);
    });
  }

  if (done) {
    return (
      <div className="border-border bg-canvas mx-auto max-w-xl rounded-lg border p-8 text-center">
        <h2 className="text-fg text-2xl font-semibold">{labels.thanksTitle}</h2>
        <p className="text-fg-soft mt-3">{labels.thanksBody}</p>
        <Link
          href="/observatoire-ia"
          className="bg-terracotta mt-6 inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-white"
        >
          {labels.seeResults}
        </Link>
      </div>
    );
  }

  if (!current) return null;
  const progress = labels.stepOf
    .replace("{current}", String(step + 1))
    .replace("{total}", String(total));
  const selectedMulti = Array.isArray(answers[current.id]) ? (answers[current.id] as string[]) : [];

  return (
    <div className="border-border bg-canvas mx-auto max-w-xl rounded-lg border p-6 sm:p-8">
      {/* Barre de progression (hauteur fixe → pas de CLS) */}
      <div className="mb-6">
        <p className="text-fg-muted mb-2 text-xs font-medium">{progress}</p>
        <div className="bg-sand h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
          <div
            className="bg-terracotta h-full rounded-full transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-fg text-lg font-semibold">{current.label}</legend>
        {current.hint ? <p className="text-fg-muted mt-1 text-sm">{current.hint}</p> : null}

        <div className="mt-4 space-y-2">
          {current.options.map((o) => {
            const isMulti = current.type === "multi";
            const checked = isMulti
              ? selectedMulti.includes(o.value)
              : answers[current.id] === o.value;
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-2.5 text-sm ${
                  checked ? "border-terracotta bg-paper" : "border-border bg-canvas"
                }`}
              >
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={current.id}
                  value={o.value}
                  checked={checked}
                  onChange={() =>
                    isMulti
                      ? toggleMulti(current.id, o.value, current.maxSelections)
                      : setSingle(current.id, o.value)
                  }
                  className="accent-terracotta h-4 w-4"
                />
                <span className="text-fg">{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Honeypot — caché aux humains, visible aux bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error ? (
        <p className="text-terracotta mt-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
          className="border-border text-fg-soft rounded-full border px-5 py-2 text-sm font-medium disabled:opacity-40"
        >
          {labels.previous}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={pending}
          className="bg-terracotta rounded-full px-6 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? labels.submitting : step < total - 1 ? labels.next : labels.submit}
        </button>
      </div>
    </div>
  );
}
