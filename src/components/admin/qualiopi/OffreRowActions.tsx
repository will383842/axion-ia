"use client";
// use-client: boutons interactifs (toggle actif/inactif d'une offre, vérification de cohérence globale) via useTransition + Server Actions.

/**
 * OffreRowActions — Contrôles client du référentiel offres_site (T19).
 *
 * Modes :
 *   - "toggle" : bascule actif/inactif d'une offre (toggleOffreActifAction).
 *   - "verify" : déclenche la vérification de cohérence globale offre ↔ pricing.ts
 *                (verifyAllOffresCoherenceAction) et affiche le rapport.
 *
 * "use client" : useTransition + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  toggleOffreActifAction,
  verifyAllOffresCoherenceAction,
} from "@/server/actions/qualiopi/offres";

export type OffreRowActionsProps =
  | {
      mode: "toggle";
      offreId: string;
      actif: boolean;
      toggleAction: typeof toggleOffreActifAction;
    }
  | {
      mode: "verify";
      verifyAction: typeof verifyAllOffresCoherenceAction;
    };

export function OffreRowActions(props: OffreRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleToggle() {
    if (props.mode !== "toggle") return;
    const { toggleAction, offreId, actif } = props;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await toggleAction({ id: offreId, actif: !actif });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleVerify() {
    if (props.mode !== "verify") return;
    const { verifyAction } = props;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await verifyAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        const { checked, incoherentes } = result.data;
        setSuccessMsg(
          incoherentes.length === 0
            ? `${checked} offre${checked !== 1 ? "s" : ""} vérifiée${checked !== 1 ? "s" : ""} — toutes cohérentes.`
            : `${incoherentes.length} offre${incoherentes.length > 1 ? "s" : ""} incohérente${incoherentes.length > 1 ? "s" : ""} sur ${checked} : ${incoherentes
                .map((o) => o.code)
                .join(", ")}.`,
        );
        router.refresh();
      }
    });
  }

  if (props.mode === "verify") {
    return (
      <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
        <button type="button" onClick={handleVerify} disabled={isPending} className="admin-button">
          {isPending ? "Vérification…" : "Vérifier la cohérence"}
        </button>
        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}
        {successMsg && (
          <p
            role="status"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]"
          >
            {successMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={
          props.actif
            ? "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80 disabled:opacity-50"
            : "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-success)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)] transition-opacity hover:opacity-80 disabled:opacity-50"
        }
      >
        {isPending ? "…" : props.actif ? "Désactiver" : "Activer"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
