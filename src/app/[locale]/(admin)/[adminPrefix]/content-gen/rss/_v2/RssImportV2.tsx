"use client";
// use-client: useActionState (formulaire interactif + résumé d'import affiché inline).

// Import en masse de sources RSS — colle un tableau JSON, 1 clic, tout est créé.
// Idempotent côté serveur (URLs déjà présentes ignorées). Pré-rempli avec une
// liste de flux vérifiés accessibles ; éditable avant import.

import { useActionState } from "react";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import type { BulkRssImportResult } from "@/server/actions/content-gen/rss-sources";

export interface RssImportState {
  readonly status: "idle" | "ok" | "error";
  readonly result?: BulkRssImportResult;
  readonly message?: string;
}

interface Props {
  readonly defaultJson: string;
  readonly action: (prev: RssImportState, formData: FormData) => Promise<RssImportState>;
}

const INITIAL: RssImportState = { status: "idle" };

export function RssImportV2({ defaultJson, action }: Props): React.ReactElement {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Import en masse de sources RSS"
        description="Colle un tableau JSON de flux puis « Importer ». Idempotent : les URLs déjà présentes sont ignorées (ré-import sans risque)."
      />

      <AdminCard>
        <form action={formAction}>
          <div className="admin-field">
            <label htmlFor="feeds" className="admin-label">
              Flux RSS (tableau JSON : url, name, verticale, pollIntervalMin, autoPublish, tags,
              language)
            </label>
            <textarea
              id="feeds"
              name="feeds"
              defaultValue={defaultJson}
              rows={22}
              spellCheck={false}
              className="admin-input"
              style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }}
            />
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button" disabled={pending}>
              {pending ? "Import en cours…" : "Importer"}
            </button>
          </div>
        </form>

        {state.status === "error" && (
          <p style={{ color: "crimson", marginTop: "1rem" }}>❌ {state.message}</p>
        )}

        {state.status === "ok" && state.result && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              ✅ <strong>{state.result.created}</strong> créé(s) ·{" "}
              <strong>{state.result.skipped}</strong> déjà présent(s) ·{" "}
              <strong>{state.result.errors.length}</strong> erreur(s)
            </p>
            {state.result.createdNames.length > 0 && (
              <details open>
                <summary>Créés</summary>
                <ul>
                  {state.result.createdNames.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            )}
            {state.result.errors.length > 0 && (
              <details open>
                <summary style={{ color: "crimson" }}>Erreurs</summary>
                <ul>
                  {state.result.errors.map((e) => (
                    <li key={e.url} style={{ color: "crimson" }}>
                      {e.url} — {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
