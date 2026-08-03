"use client";
// use-client: formulaire interactif (création partenariat) + useTransition pour la server action.

/**
 * PartenariatForm — Formulaire de création d'un partenariat Qualiopi.
 *
 * "use client" : interactivité locale + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerPartenariatAction } from "@/server/actions/qualiopi/partenariats";
import { PARTENARIAT_TYPES, PARTENARIAT_TYPE_LABELS } from "@/server/qualiopi/partenariats/labels";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

export interface PartenariatFormProps {
  creerAction: typeof creerPartenariatAction;
}

export function PartenariatForm({ creerAction }: PartenariatFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [type, setType] = useState("");
  const [objet, setObjet] = useState("");
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState("");
  const [actif, setActif] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await creerAction({
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
        setSuccessMsg("Partenariat enregistré.");
        setNom("");
        setType("");
        setObjet("");
        setDateFin("");
        setActif(true);
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
        Nouveau partenariat
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Nom */}
        <div className={fieldCls}>
          <label htmlFor="partenariatform-nom-du-partenaire" className={labelCls}>
            Nom du partenaire
          </label>
          <input
            id="partenariatform-nom-du-partenaire"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={250}
            placeholder="Nom de l'organisme partenaire"
            className={inputCls}
          />
        </div>

        {/* Type */}
        <div className={fieldCls}>
          <label htmlFor="partenariatform-type-de-partenariat" className={labelCls}>
            Type de partenariat
          </label>
          <select
            id="partenariatform-type-de-partenariat"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          >
            <option value="">— Choisir —</option>
            {PARTENARIAT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PARTENARIAT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Date début */}
        <div className={fieldCls}>
          <label htmlFor="partenariatform-date-de-debut" className={labelCls}>
            Date de début
          </label>
          <input
            id="partenariatform-date-de-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>

        {/* Date fin */}
        <div className={fieldCls}>
          <label htmlFor="partenariatform-date-de-fin-facultatif" className={labelCls}>
            Date de fin (facultatif)
          </label>
          <input
            id="partenariatform-date-de-fin-facultatif"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* Objet */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="partenariatform-objet-du-partenariat" className={labelCls}>
          Objet du partenariat
        </label>
        <textarea
          id="partenariatform-objet-du-partenariat"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          disabled={isPending}
          required
          rows={3}
          placeholder="Décrire l'objet de la collaboration…"
          className={inputCls}
        />
      </div>

      {/* Actif */}
      <div className="mt-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-2)]">
        <input
          type="checkbox"
          id="partenariat-actif"
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
        />
        <label
          htmlFor="partenariat-actif"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          Partenariat actif
        </label>
      </div>

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
        {isPending ? "Enregistrement..." : "Enregistrer le partenariat"}
      </button>
    </form>
  );
}
