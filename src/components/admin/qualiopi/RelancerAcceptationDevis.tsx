"use client";
// use-client: état local + Server Action.

/**
 * Alerte + reprise : devis signé par les deux parties mais dont l'acceptation n'a pas été
 * enregistrée (`accepterDevisAFormules` a échoué). L'état est dérivé côté serveur de la base,
 * donc l'alerte persiste après rechargement jusqu'à la reprise.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface RelancerAcceptationDevisProps {
  documentGenereId: string;
  relancerAction: (input: {
    documentGenereId: string;
  }) => Promise<{ ok: true; devisAcceptes: number } | { ok: false; message: string }>;
}

export function RelancerAcceptationDevis({
  documentGenereId,
  relancerAction,
}: RelancerAcceptationDevisProps): React.ReactElement {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function relancer() {
    setErreur(null);
    startTransition(async () => {
      const res = await relancerAction({ documentGenereId });
      if (res.ok) router.refresh();
      else setErreur(res.message);
    });
  }

  return (
    <div role="alert" className="text-[length:var(--text-admin-sm)]">
      <p className="text-[color:var(--color-admin-error)]">
        Devis signé par les deux parties, mais son acceptation n&apos;a pas été enregistrée (aucune
        formule retenue). Relancez l&apos;acceptation : l&apos;opération est sans risque si elle a
        déjà abouti.
      </p>
      <button
        type="button"
        onClick={relancer}
        disabled={enCours}
        className="mt-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
      >
        {enCours ? "Reprise en cours…" : "Relancer l'acceptation"}
      </button>
      {erreur !== null && (
        <p className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-error)]">{erreur}</p>
      )}
    </div>
  );
}
