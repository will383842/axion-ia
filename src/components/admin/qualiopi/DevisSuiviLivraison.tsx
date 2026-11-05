"use client";
// use-client: boutons de jalon (useTransition + router.refresh) — aucune logique métier ici.

/**
 * Suivi de livraison d'un devis accepté : « Démarrer la livraison » puis
 * « Marquer livré ». Les deux gardes sont rejouées côté serveur
 * (`updateMany` conditionnel) ; l'écran ne propose que ce que le serveur accepte.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  demarrerLivraisonDevisAction,
  marquerDevisLivreAction,
} from "@/server/actions/qualiopi/devis-livraison";

export function DevisSuiviLivraison({
  devisId,
  peutDemarrer,
  peutLivrer,
}: {
  devisId: string;
  peutDemarrer: boolean;
  peutLivrer: boolean;
}) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!peutDemarrer && !peutLivrer) return null;

  function lancer(action: (id: string) => Promise<{ data: { id: string } } | { error: string }>) {
    setErreur(null);
    startTransition(async () => {
      const res = await action(devisId);
      if ("error" in res) setErreur(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      {peutDemarrer && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => lancer(demarrerLivraisonDevisAction)}
          className="rounded border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] disabled:opacity-50"
        >
          Démarrer la livraison
        </button>
      )}
      {peutLivrer && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => lancer(marquerDevisLivreAction)}
          className="rounded border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] disabled:opacity-50"
        >
          Marquer livré
        </button>
      )}
      {erreur && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger,#b00020)]"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
