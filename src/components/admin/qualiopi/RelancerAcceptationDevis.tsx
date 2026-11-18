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
  /**
   * « acceptation » : formule non enregistrée ; « plans » : acceptation faite, plans non proposés ;
   * « confirmation-classique » : devis classique signé des deux parties, e-mail de confirmation non préparé.
   */
  cas: "acceptation" | "plans" | "confirmation-classique";
  documentGenereId: string;
  relancerAction: (input: {
    documentGenereId: string;
  }) => Promise<
    { ok: true; devisAcceptes: number; message?: string } | { ok: false; message: string }
  >;
}

export function RelancerAcceptationDevis({
  cas,
  documentGenereId,
  relancerAction,
}: RelancerAcceptationDevisProps): React.ReactElement {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function relancer() {
    setErreur(null);
    setInfo(null);
    startTransition(async () => {
      const res = await relancerAction({ documentGenereId });
      if (res.ok) {
        if (res.message !== undefined) setInfo(res.message);
        router.refresh();
      } else setErreur(res.message);
    });
  }

  return (
    <div className="text-[length:var(--text-admin-sm)]">
      <div role="alert">
        {cas === "confirmation-classique" && (
          <p className="font-medium text-[color:var(--color-admin-error)]">
            Confirmation de commande non préparée
          </p>
        )}
        <p className="text-[color:var(--color-admin-error)]">
          {cas === "acceptation"
            ? "Devis signé par les deux parties, mais son acceptation n'a pas été enregistrée (aucune formule retenue). Relancez l'acceptation : l'opération est sans risque si elle a déjà abouti."
            : cas === "plans"
              ? "Devis accepté, mais les plans récurrents attendus n'ont pas été proposés. Relancez la proposition des plans : ils sont créés en pause, sans facture ni e-mail."
              : "Ce devis est signé par les deux parties, mais l'e-mail de confirmation de commande n'a pas été préparé. Vérifiez que la fiche du client a une adresse e-mail, puis relancez. L'e-mail attendra votre validation avant de partir."}
        </p>
        <button
          type="button"
          onClick={relancer}
          disabled={enCours}
          className="mt-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
        >
          {enCours
            ? "Reprise en cours…"
            : cas === "acceptation"
              ? "Relancer l'acceptation"
              : cas === "plans"
                ? "Relancer la proposition des plans"
                : "Préparer la confirmation de commande"}
        </button>
        {erreur !== null && (
          <p className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-error)]">
            {erreur}
          </p>
        )}
      </div>
      <div role="status" aria-live="polite">
        {info !== null && (
          <p className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-fg)]">{info}</p>
        )}
      </div>
    </div>
  );
}
