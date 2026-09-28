"use client";
// use-client: useActionState — état d'envoi et message d'erreur du formulaire.

// Formulaire de la page `/completer-ma-candidature` — les SEULES questions de
// l'offre, pré-remplies avec ce que le candidat a déjà répondu. Mêmes champs
// que le formulaire de candidature (`JobApplicationForm`) : un prix est UN
// montant, clavier numérique sur mobile, 16 px pour que Safari iOS ne zoome pas.

import { useActionState } from "react";

import type { ScreeningQuestion } from "@/lib/careers/screening-answers";
import {
  completerCandidatureAction,
  type EtatComplement,
} from "@/features/job-application/complement-actions";

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3.5 py-2.5 text-[16px] sm:text-sm outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";

interface Props {
  jeton: string;
  questions: ScreeningQuestion[];
  reponses: Record<string, string>;
}

export function CompleterCandidatureForm({ jeton, questions, reponses }: Props) {
  const [etat, action, envoi] = useActionState<EtatComplement, FormData>(
    completerCandidatureAction,
    null,
  );

  if (etat?.ok) {
    return (
      <div role="status" className="border-sage/40 bg-sage/10 rounded-xl border-2 p-5">
        <p className="text-fg text-base font-semibold">Merci, c’est enregistré.</p>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">
          Tes réponses sont ajoutées à ta candidature. On revient vers toi dès qu’on a comparé les
          propositions. Tu peux rouvrir ce lien pour corriger une réponse.
        </p>
      </div>
    );
  }

  const aDesPrix = questions.some((q) => q.type === "price");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="jeton" value={jeton} />
      {aDesPrix ? (
        <p className="border-terracotta/40 bg-terracotta-soft/30 text-fg rounded-lg border px-3.5 py-2.5 text-sm">
          On compare toutes les propositions : indique directement ton meilleur prix.
        </p>
      ) : null}

      {questions.map((q) => {
        const id = `answer_${q.id}`;
        const defaut = reponses[q.id] ?? "";
        return (
          <div key={q.id}>
            <label htmlFor={id} className={LABEL}>
              {q.labelFr ?? q.labelEn ?? q.id}
              {q.required ? " *" : ""}
            </label>
            {q.type === "price" ? (
              <div className="relative max-w-[12rem]">
                <input
                  id={id}
                  name={id}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required={q.required}
                  maxLength={12}
                  pattern="[0-9 ]+([.,][0-9]{1,2})?"
                  title="Un seul montant en euros, sans fourchette"
                  placeholder="ex. 25"
                  defaultValue={defaut.replace(/\s*€\s*$/, "")}
                  className={`${FIELD} pr-9`}
                  disabled={envoi}
                />
                <span
                  aria-hidden="true"
                  className="text-fg-muted pointer-events-none absolute inset-y-0 right-3.5 flex items-center"
                >
                  €
                </span>
              </div>
            ) : q.type === "short" ? (
              <input
                id={id}
                name={id}
                type="text"
                required={q.required}
                maxLength={300}
                defaultValue={defaut}
                className={FIELD}
                disabled={envoi}
              />
            ) : (
              <textarea
                id={id}
                name={id}
                required={q.required}
                rows={3}
                maxLength={2000}
                defaultValue={defaut}
                className={FIELD}
                disabled={envoi}
              />
            )}
          </div>
        );
      })}

      {etat && !etat.ok ? (
        <p role="alert" className="text-accent-red text-sm font-medium">
          {etat.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={envoi}
        className="bg-terracotta hover:bg-terracotta-deep inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium text-white transition-colors disabled:opacity-60"
      >
        {envoi ? "Envoi…" : "Enregistrer mes réponses"}
      </button>
    </form>
  );
}
