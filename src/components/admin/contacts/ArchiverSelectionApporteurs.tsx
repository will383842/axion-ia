"use client";
// use-client: lit les cases cochées du tableau et rafraîchit la liste après l'archivage groupé.

/**
 * « Archiver la sélection » — action groupée de la liste « Futurs apporteurs »
 * (Candidatures unifiées L8d). Passe par `bulkArchiveSubmissionsAction`, le
 * chemin existant : archiver CLÔT, donc les relances en attente s'arrêtent.
 * Rien n'est effacé — une fiche archivée se rouvre depuis l'onglet « Archivés ».
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { bulkArchiveSubmissionsAction } from "@/features/admin-submissions/reply-actions";

export function ArchiverSelectionApporteurs(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function archiver(): void {
    const form = ref.current?.closest("form");
    const ids = form
      ? [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')].map(
          (i) => i.value,
        )
      : [];
    if (ids.length === 0) {
      setMessage("Aucune personne cochée.");
      return;
    }
    demarrer(async () => {
      const r = await bulkArchiveSubmissionsAction(ids);
      setMessage(
        `${r.archived} fiche${r.archived > 1 ? "s" : ""} archivée${r.archived > 1 ? "s" : ""}.`,
      );
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
      <button
        type="button"
        className="admin-button-secondary admin-button-tactile"
        onClick={archiver}
        disabled={enCours}
      >
        {enCours ? "Archivage…" : "Archiver la sélection"}
      </button>
      {message ? (
        <span role="status" className="admin-meta-small">
          {message}
        </span>
      ) : null}
    </div>
  );
}
