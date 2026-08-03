"use client";
// use-client: régénération du PDF d'une facture existante via useTransition + Server Action.

/**
 * RegenererFacturePdfButton — Reconstruit le PDF d'une facture déjà émise.
 *
 * ── Pourquoi ce bouton existe (2026-08-03) ──────────────────────────────────
 * `genererFacturePdfAction` sait reconstruire le PDF d'une facture à partir de
 * ses données actuelles, mais n'était appelée QUE juste après la création, dans
 * `GenererFactureButton`. Une facture déjà émise n'avait donc aucun chemin de
 * régénération : « Télécharger le PDF » sert le document stocké, pas un rendu
 * frais.
 *
 * Conséquence constatée sur AXI-FACT-2026-001 : le destinataire portait le
 * titre de la session au lieu de la raison sociale du client, et l'adresse du
 * client — obligatoire (art. L.441-9 C. com.) — était absente. Les données ont
 * été corrigées, la console affichait le bon client… et le PDF restait faux,
 * parce que rien ne permettait de le refabriquer. Or c'est le PDF que lit
 * l'auditeur, pas l'écran.
 *
 * Le correctif de la date d'exécution (`periodePrestationSession`) avait le
 * même sort : déployé, mais sans effet sur les pièces émises avant lui.
 *
 * ⚠️ Régénérer NE crée PAS de nouveau numéro de facture. Le numéro, la date
 * d'émission et les montants viennent de la ligne `factures_formation` : seul
 * le rendu est refait. Ce n'est donc pas une réémission, et cela ne remplace
 * pas un avoir quand la facture est déjà partie chez le client.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { genererFacturePdfAction } from "@/server/actions/qualiopi/financements";

export interface RegenererFacturePdfButtonProps {
  factureId: string;
  regenererAction: typeof genererFacturePdfAction;
}

export function RegenererFacturePdfButton({
  factureId,
  regenererAction,
}: RegenererFacturePdfButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleClick() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await regenererAction({ factureId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)] transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {isPending ? "Régénération…" : "Régénérer le PDF"}
      </button>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Refabrique le PDF depuis les données actuelles. Le numéro, la date d&apos;émission et les
        montants sont inchangés — ce n&apos;est pas une réémission.
      </p>
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          PDF régénéré — rouvrez « Télécharger le PDF » pour le relire.
        </p>
      )}
    </div>
  );
}
