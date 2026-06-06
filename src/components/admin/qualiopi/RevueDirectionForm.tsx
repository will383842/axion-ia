"use client";
// use-client: formulaire interactif (création revue de direction) + useTransition pour la server action.

/**
 * RevueDirectionForm — Formulaire de création d'une revue de direction annuelle.
 *
 * "use client" : interactivité locale + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

export interface RevueDirectionFormProps {
  creerAction: typeof creerRevueDirectionAction;
}

export function RevueDirectionForm({ creerAction }: RevueDirectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [dateRevue, setDateRevue] = useState(() => new Date().toISOString().slice(0, 10));
  const [participantsRaw, setParticipantsRaw] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const participants = participantsRaw
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await creerAction({
        annee,
        dateRevue: new Date(dateRevue),
        participants,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(`Revue de direction ${result.data.annee} créée.`);
        setParticipantsRaw("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-6)]"
    >
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Nouvelle revue de direction
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Année */}
        <div className={fieldCls}>
          <label className={labelCls}>Année</label>
          <input
            type="number"
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            disabled={isPending}
            required
            min={2020}
            max={2100}
            className={inputCls}
          />
        </div>

        {/* Date revue */}
        <div className={fieldCls}>
          <label className={labelCls}>Date de la revue</label>
          <input
            type="date"
            value={dateRevue}
            onChange={(e) => setDateRevue(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
      </div>

      {/* Participants */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label className={labelCls}>Participants (un par ligne, facultatif)</label>
        <textarea
          value={participantsRaw}
          onChange={(e) => setParticipantsRaw(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder={"Prénom Nom — Rôle\nPrénom Nom — Rôle"}
          className={inputCls}
        />
      </div>

      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Les décisions et le plan d&apos;actions peuvent être renseignés après création.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button mt-[var(--space-admin-4)]">
        {isPending ? "Création…" : "Créer la revue de direction"}
      </button>
    </form>
  );
}
