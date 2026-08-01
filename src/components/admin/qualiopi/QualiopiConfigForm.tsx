"use client";
// use-client: formulaire interactif de config Qualiopi (saisie valeurs légales/métier) + useTransition.

/**
 * QualiopiConfigForm — saisie des paramètres Qualiopi (SiteSetting cat. qualiopi).
 * Enregistre uniquement les clés modifiées (setQualiopiConfigAction par clé).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQualiopiConfigAction } from "@/server/actions/qualiopi/config";

export interface ConfigField {
  key: string;
  description: string;
  value: string;
  isNumber: boolean;
  /** Valeurs autorisées (clé énumérée) → rendu en <select> au lieu d'un input. */
  options?: string[];
  /**
   * Libellé lisible affiché comme texte PRINCIPAL du champ (ex. « SIRET de
   * l'organisme »). Toujours renseigné par la page (dictionnaire `labels.ts`,
   * avec repli formaté si une clé future n'y figure pas encore) — la clé
   * technique brute (`f.key`) reste affichée séparément, en petit texte
   * discret, jamais comme seul libellé.
   */
  label: string;
  /** Le libellé ci-dessus vient du repli générique (clé absente du dictionnaire) — affiche un avertissement discret. */
  isFallback?: boolean;
  /** Libellés lisibles des options (ex. exoneration_261 → « Exonéré formation »). */
  optionLabels?: Record<string, string>;
}

export interface QualiopiConfigFormProps {
  fields: ConfigField[];
}

export function QualiopiConfigForm({ fields }: QualiopiConfigFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const initial = Object.fromEntries(fields.map((f) => [f.key, f.value]));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const changed = fields.filter((f) => values[f.key] !== initial[f.key]);
    if (changed.length === 0) {
      setSuccessMsg("Aucune modification.");
      return;
    }

    startTransition(async () => {
      const errors: string[] = [];
      for (const f of changed) {
        const res = await setQualiopiConfigAction({ key: f.key, value: values[f.key] ?? "" });
        if ("error" in res) errors.push(`${f.key} : ${res.error}`);
      }
      if (errors.length > 0) {
        setError(errors.join(" | "));
      } else {
        setSuccessMsg(`${changed.length} paramètre(s) enregistré(s).`);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const descCls =
    "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  // Clé technique brute : discrète, utile au support (ticket, log, requête SQL),
  // jamais le libellé principal — voir contrat `ConfigField.label`.
  const techKeyCls =
    "font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-[var(--space-admin-1)]">
            <label className={labelCls} htmlFor={`cfg-${f.key}`}>
              {f.label}
            </label>
            {/* Clé technique brute : jamais le libellé principal, juste un repère
                discret pour le support (ticket, log, requête SQL directe). */}
            <span className={techKeyCls} title="Clé technique (base de données)">
              {f.key}
              {f.isFallback && (
                <span className="ml-[var(--space-admin-1)] text-[color:var(--color-admin-warning-fg)]">
                  ⚠ libellé non traduit — à ajouter dans labels.ts
                </span>
              )}
            </span>
            <span className={descCls}>{f.description}</span>
            {f.options ? (
              <select
                id={`cfg-${f.key}`}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                disabled={isPending}
                className={inputCls}
              >
                {f.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {f.optionLabels?.[opt] ?? opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`cfg-${f.key}`}
                type={f.isNumber ? "number" : "text"}
                step={f.isNumber ? "any" : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                disabled={isPending}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <div className="mt-[var(--space-admin-5)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
