"use client";
// use-client: édition inline d'un partenariat via useTransition + Server Action.

/**
 * PartenariatRowActions — Édition d'un partenariat (T19).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline (champs réutilisant la
 * forme du formulaire de création) → updatePartenariatAction.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updatePartenariatAction } from "@/server/actions/qualiopi/partenariats";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

export interface PartenariatRowActionsProps {
  partenariat: {
    id: string;
    nom: string;
    type: string;
    objet: string;
    dateDebut: Date;
    dateFin: Date | null;
    actif: boolean;
  };
  updateAction: typeof updatePartenariatAction;
}

export function PartenariatRowActions({
  partenariat,
  updateAction,
}: PartenariatRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nom, setNom] = useState(partenariat.nom);
  const [type, setType] = useState(partenariat.type);
  const [objet, setObjet] = useState(partenariat.objet);
  const [dateDebut, setDateDebut] = useState(() =>
    partenariat.dateDebut.toISOString().slice(0, 10),
  );
  const [dateFin, setDateFin] = useState(() =>
    partenariat.dateFin != null ? partenariat.dateFin.toISOString().slice(0, 10) : "",
  );
  const [actif, setActif] = useState(partenariat.actif);

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: partenariat.id,
        nom,
        type,
        objet,
        dateDebut: new Date(dateDebut),
        ...(dateFin ? { dateFin: new Date(dateFin) } : {}),
        actif,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80"
      >
        Modifier
      </button>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="flex w-full max-w-md flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <div>
        <label htmlFor="partenariatrowactions-nom" className={labelCls}>
          Nom
        </label>
        <input
          id="partenariatrowactions-nom"
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={isPending}
          required
          maxLength={250}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="partenariatrowactions-type" className={labelCls}>
          Type
        </label>
        <select
          id="partenariatrowactions-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={isPending}
          required
          className={inputCls}
        >
          <option value="sous_traitance">Sous-traitance</option>
          <option value="co_traitance">Co-traitance</option>
          <option value="reseau_handicap">Réseau handicap</option>
          <option value="orientation">Orientation / prescription</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div>
        <label htmlFor="partenariatrowactions-objet" className={labelCls}>
          Objet
        </label>
        <textarea
          id="partenariatrowactions-objet"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          disabled={isPending}
          required
          rows={2}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-[var(--space-admin-3)]">
        <div>
          <label htmlFor="partenariatrowactions-debut" className={labelCls}>
            Début
          </label>
          <input
            id="partenariatrowactions-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="partenariatrowactions-fin-facultatif" className={labelCls}>
            Fin (facultatif)
          </label>
          <input
            id="partenariatrowactions-fin-facultatif"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <input
          type="checkbox"
          id={`partenariat-actif-${partenariat.id}`}
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
        />
        <label
          htmlFor={`partenariat-actif-${partenariat.id}`}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          Partenariat actif
        </label>
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
