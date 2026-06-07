"use client";
// use-client: bouton déclenchant le re-seed du référentiel (Server Action) + affichage
// de l'état courant (offres / config / grille active) mis à jour après exécution.

/**
 * SeedReferenceDataButton — Pilotage du seed du référentiel Qualiopi depuis l'admin.
 *
 * Affiche l'état courant (nombre d'offres, clés de config renseignées, grille active)
 * et un bouton « (Re)initialiser le référentiel » qui appelle reseedReferenceDataAction.
 * Idempotent et non destructif : ne réécrit pas les valeurs légales déjà saisies.
 */

import { useState, useTransition } from "react";
import { reseedReferenceDataAction } from "@/server/actions/qualiopi/seed";

interface ReferenceStatus {
  offresCount: number;
  configKeysSet: number;
  configKeysTotal: number;
  grilleActiveCle: string | null;
}

export function SeedReferenceDataButton({
  initial,
}: {
  initial: ReferenceStatus;
}): React.ReactElement {
  const [status, setStatus] = useState<ReferenceStatus>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReseed() {
    setMessage(null);
    setIsError(false);
    startTransition(async () => {
      const result = await reseedReferenceDataAction();
      if ("error" in result) {
        setIsError(true);
        setMessage(result.error);
        return;
      }
      const { offresCount, configKeysSet, configKeysTotal, grilleActiveCle, ran } = result.data;
      setStatus({ offresCount, configKeysSet, configKeysTotal, grilleActiveCle });
      setIsError(false);
      setMessage(
        ran
          ? "Référentiel synchronisé (idempotent : aucune valeur saisie écrasée)."
          : "Seed déjà en cours sur une autre instance — état rafraîchi.",
      );
    });
  }

  const offresOk = status.offresCount > 0;
  const grilleOk = status.grilleActiveCle != null;

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <dl className="grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-3">
        <div>
          <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Offres
          </dt>
          <dd className="text-[length:var(--text-admin-sm)]">
            {offresOk ? "✅" : "⚠️"} {status.offresCount} offre(s)
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Configuration
          </dt>
          <dd className="text-[length:var(--text-admin-sm)]">
            {status.configKeysSet}/{status.configKeysTotal} clé(s)
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Grille qualité active
          </dt>
          <dd className="text-[length:var(--text-admin-sm)]">
            {grilleOk ? `✅ ${status.grilleActiveCle}` : "⚠️ aucune"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button
          type="button"
          onClick={handleReseed}
          disabled={isPending}
          className="admin-button"
          aria-label="Réinitialiser le référentiel Qualiopi (offres, configuration, grilles)"
        >
          {isPending ? "Synchronisation…" : "(Re)initialiser le référentiel"}
        </button>
        {message ? (
          <span
            role="status"
            className="text-[length:var(--text-admin-sm)]"
            style={{
              color: isError ? "var(--color-admin-danger)" : "var(--color-admin-fg-muted)",
            }}
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
