"use client";
// use-client: useState pour capture d'erreur Server Action + startTransition.

import { useState, useTransition } from "react";
import { AdminFormError } from "@/components/admin/ui/AdminFormError";

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export function RssFormClient({ action }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await action(fd);
      } catch (err: unknown) {
        // NEXT_REDIRECT est une erreur spéciale — ne pas l'intercepter
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        if (
          err != null &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : "Une erreur inattendue est survenue.";
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="url" className="admin-label">
            URL flux
          </label>
          <input
            id="url"
            name="url"
            type="url"
            required
            className="admin-input"
            placeholder="https://example.com/feed.xml"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="name" className="admin-label">
            Nom
          </label>
          <input id="name" name="name" required className="admin-input" />
        </div>
      </div>
      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="tags" className="admin-label">
            Tags (CSV)
          </label>
          <input
            id="tags"
            name="tags"
            className="admin-input"
            placeholder="actualite-ia, reglementation"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="pollIntervalMin" className="admin-label">
            Intervalle (min)
          </label>
          <input
            id="pollIntervalMin"
            name="pollIntervalMin"
            type="number"
            min="5"
            max="1440"
            defaultValue="60"
            className="admin-input"
            required
          />
        </div>
      </div>
      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="autoPublish" /> Publication auto si score ≥ seuil
        </label>
      </div>
      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="enabled" defaultChecked /> Source active
        </label>
      </div>
      {error && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminFormError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      <div className="admin-filters-actions">
        <button type="submit" className="admin-button" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Ajout en cours…" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
