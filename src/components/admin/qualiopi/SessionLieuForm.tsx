"use client";
// use-client: état local du fieldset + useTransition pour setSessionLieuAction. router.refresh() après succès.

/**
 * SessionLieuForm — Correction du lieu de déroulement depuis la fiche session.
 *
 * Raison d&apos;être : jusqu&apos;ici, une session ne pouvait plus être modifiée
 * après sa création — seul son STATUT bougeait. Un lieu mal saisi restait donc
 * faux définitivement, sur la convention comme sur la convocation.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setSessionLieuAction } from "@/server/actions/qualiopi/sessions";
import { LieuFieldset } from "@/components/admin/qualiopi/LieuFieldset";
import { lieuPayload, type LieuValues } from "@/components/admin/qualiopi/lieu-values";

export interface SessionLieuFormProps {
  sessionId: string;
  /** Valeurs actuelles, lues côté serveur sur la fiche. */
  initial: LieuValues;
  /**
   * Modalité de la session — l&apos;hybride a besoin de l&apos;adresse ET du lien
   * de visio ; `LieuType` seul ne sait pas le dire (cf. `LieuFieldset`).
   */
  modalite?: "presentiel" | "distanciel" | "hybride";
}

export function SessionLieuForm({
  sessionId,
  initial,
  modalite,
}: SessionLieuFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lieu, setLieu] = useState<LieuValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await setSessionLieuAction({ id: sessionId, ...lieuPayload(lieu) });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccessMsg(
        "Lieu enregistré. Les documents déjà générés ne changent pas — réémettre la convention, la convocation ou la feuille d'émargement pour qu'ils le portent.",
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <LieuFieldset
        value={lieu}
        onChange={(patch) => setLieu((prev) => ({ ...prev, ...patch }))}
        disabled={isPending}
        idPrefix="fiche-lieu"
        modalite={modalite}
      />

      {error !== null && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg !== null && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer le lieu"}
      </button>
    </form>
  );
}
