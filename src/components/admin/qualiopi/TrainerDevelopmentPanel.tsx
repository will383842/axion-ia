"use client";
// use-client: formulaire d'ajout + suppression inline, useTransition, router.refresh().
/**
 * TrainerDevelopmentPanel — Actions de développement des compétences d'un
 * formateur (indicateur RNQ 22 : entretien/développement dans le temps).
 *
 * Trace DATÉE distincte du CV (ind. 21). Ajout + liste + suppression.
 * Tokens admin var(--color-admin-*) — ZÉRO hex.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult<T> = { data: T } | { error: string };

export type TrainerDevelopmentActionType =
  "entretien_professionnel" | "formation_suivie" | "veille" | "autre";

export interface TrainerDevelopmentActionSerialized {
  id: string;
  type: TrainerDevelopmentActionType;
  dateAction: string; // ISO
  description: string;
}

const TYPE_LABELS: Record<TrainerDevelopmentActionType, string> = {
  entretien_professionnel: "Entretien professionnel",
  formation_suivie: "Formation suivie",
  veille: "Veille",
  autre: "Autre",
};

const TYPE_OPTIONS: Array<{ value: TrainerDevelopmentActionType; label: string }> = [
  { value: "entretien_professionnel", label: "Entretien professionnel" },
  { value: "formation_suivie", label: "Formation suivie" },
  { value: "veille", label: "Veille" },
  { value: "autre", label: "Autre" },
];

export interface TrainerDevelopmentPanelProps {
  trainerId: string;
  actions: TrainerDevelopmentActionSerialized[];
  addAction: (input: {
    trainerId: string;
    type: TrainerDevelopmentActionType;
    dateAction: Date;
    description?: string;
  }) => Promise<ActionResult<{ id: string }>>;
  deleteAction: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}

export function TrainerDevelopmentPanel({
  trainerId,
  actions,
  addAction,
  deleteAction,
}: TrainerDevelopmentPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<TrainerDevelopmentActionType>("entretien_professionnel");
  const [dateStr, setDateStr] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dateStr) {
      setError("Veuillez indiquer une date.");
      return;
    }
    const trimmed = description.trim();
    startTransition(async () => {
      const res = await addAction({
        trainerId,
        type,
        dateAction: new Date(dateStr),
        ...(trimmed ? { description: trimmed } : {}),
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setDateStr("");
        setDescription("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAction({ id });
      if (!("error" in res)) router.refresh();
    });
  }

  return (
    <div className="space-y-[var(--space-admin-4)]">
      {actions.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune action de développement des compétences enregistrée (entretien professionnel,
          formation suivie, veille). Requis pour l&apos;indicateur 22.
        </p>
      ) : (
        <ul className="space-y-[var(--space-admin-2)]">
          {actions.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
            >
              <div>
                <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                  {TYPE_LABELS[a.type]} —{" "}
                  {new Date(a.dateAction).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {a.description && (
                  <p className="mt-0.5 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {a.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={isPending}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div>
          <label
            htmlFor="dev-type"
            className="mb-1 block text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
          >
            Type
          </label>
          <select
            id="dev-type"
            value={type}
            onChange={(e) => setType(e.target.value as TrainerDevelopmentActionType)}
            disabled={isPending}
            className={inputCls}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="dev-date"
            className="mb-1 block text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
          >
            Date
          </label>
          <input
            id="dev-date"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className="min-w-[14rem] flex-1">
          <label
            htmlFor="dev-desc"
            className="mb-1 block text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
          >
            Description (optionnel)
          </label>
          <input
            id="dev-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            maxLength={2000}
            placeholder="Intitulé, organisme, durée…"
            className={`${inputCls} w-full`}
          />
        </div>
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Ajout…" : "Ajouter"}
        </button>
        {error && (
          <p
            role="alert"
            className="w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            Erreur : {error}
          </p>
        )}
      </form>
    </div>
  );
}
