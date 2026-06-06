"use client";
// use-client: édition inline + suppression d'une entrée de veille via useTransition + Server Actions.

/**
 * VeilleRowActions — Édition / suppression d'une entrée de veille (T19).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline (champs réutilisant la
 * forme du formulaire de création) → updateVeilleAction. Bouton « Supprimer »
 * (confirm) → supprimerVeilleAction.
 *
 * "use client" : useState/useTransition + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateVeilleAction, supprimerVeilleAction } from "@/server/actions/qualiopi/veille";

type VeilleType = "legale" | "metiers" | "pedagogique" | "handicap";

const TYPE_LABELS: Record<VeilleType, string> = {
  legale: "Légale / réglementaire",
  metiers: "Emplois / métiers",
  pedagogique: "Pédagogique / technologique",
  handicap: "Handicap",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

export interface VeilleRowActionsProps {
  veille: {
    id: string;
    type: string;
    source: string;
    titre: string;
    contenu: string;
    dateVeille: Date;
    impact: string | null;
    actionDecidee: string | null;
  };
  updateAction: typeof updateVeilleAction;
  supprimerAction: typeof supprimerVeilleAction;
}

export function VeilleRowActions({
  veille,
  updateAction,
  supprimerAction,
}: VeilleRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<VeilleType>(veille.type as VeilleType);
  const [source, setSource] = useState(veille.source);
  const [titre, setTitre] = useState(veille.titre);
  const [contenu, setContenu] = useState(veille.contenu);
  const [dateVeille, setDateVeille] = useState(() => veille.dateVeille.toISOString().slice(0, 10));
  const [impact, setImpact] = useState(veille.impact ?? "");
  const [actionDecidee, setActionDecidee] = useState(veille.actionDecidee ?? "");

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: veille.id,
        type,
        source,
        titre,
        contenu,
        dateVeille: new Date(dateVeille),
        impact,
        actionDecidee,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await supprimerAction({ id: veille.id });
      if ("error" in result) {
        setError(result.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={isPending}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Modifier
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-error)] transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {isPending ? "Suppression…" : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isPending}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-error)] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="flex w-full max-w-md flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <div>
        <label className={labelCls}>Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as VeilleType)}
          disabled={isPending}
          className={inputCls}
        >
          {(Object.keys(TYPE_LABELS) as VeilleType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Date de veille</label>
        <input
          type="date"
          value={dateVeille}
          onChange={(e) => setDateVeille(e.target.value)}
          disabled={isPending}
          required
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Source</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={isPending}
          required
          maxLength={300}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Titre</label>
        <input
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          disabled={isPending}
          required
          maxLength={300}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Contenu</label>
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          disabled={isPending}
          required
          rows={2}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Impact</label>
        <textarea
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          disabled={isPending}
          rows={2}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Action décidée</label>
        <textarea
          value={actionDecidee}
          onChange={(e) => setActionDecidee(e.target.value)}
          disabled={isPending}
          rows={2}
          className={inputCls}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
