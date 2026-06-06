"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action updateClientAction + router.refresh().

/**
 * ClientBrancheForm — Édition de la branche d'un client CRM.
 *
 * Permet de renseigner l'IDCC (code de la convention collective de branche,
 * déclencheur du barème OPCO par dossier) et la taille de l'entreprise
 * (CompanySize), puis appelle `updateClientAction`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import type { CompanySize } from "@/server/qualiopi/crm/types";

interface ClientBrancheFormProps {
  id: string;
  idcc?: string | null;
  taille?: CompanySize | null;
}

const TAILLE_OPTIONS: ReadonlyArray<{ value: CompanySize; label: string }> = [
  { value: "TPE", label: "TPE" },
  { value: "PME", label: "PME" },
  { value: "ETI", label: "ETI" },
  { value: "GRANDE_ENTREPRISE", label: "Grande entreprise" },
] as const;

export function ClientBrancheForm({
  id,
  idcc,
  taille,
}: ClientBrancheFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [idccValue, setIdccValue] = useState<string>(idcc ?? "");
  const [tailleValue, setTailleValue] = useState<string>(taille ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const idccTrim = idccValue.trim();
    startTransition(async () => {
      const result = await updateClientAction({
        id,
        ...(idccTrim !== "" ? { idcc: idccTrim } : {}),
        ...(tailleValue !== "" ? { taille: tailleValue as CompanySize } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOk(true);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-[var(--space-admin-2)] sm:flex-row sm:items-end"
    >
      <div className="min-w-0">
        <label htmlFor={`idcc-${id}`} className={labelCls}>
          IDCC
        </label>
        <input
          id={`idcc-${id}`}
          type="text"
          inputMode="numeric"
          value={idccValue}
          onChange={(e) => setIdccValue(e.target.value)}
          placeholder="Ex. 1486"
          maxLength={10}
          className={inputCls}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`taille-${id}`} className={labelCls}>
          Taille
        </label>
        <select
          id={`taille-${id}`}
          value={tailleValue}
          onChange={(e) => setTailleValue(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {TAILLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
          Enregistré.
        </p>
      )}
    </form>
  );
}
