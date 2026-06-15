// Réglages batches & workers V2 — AdminPageShell + form server action.
// Crée la page manquante (404) ; backend getBatchSettings/updateBatchSettings
// déjà en place et consommé par content-orchestrator-worker.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateBatchSettings, type BatchSettings } from "@/server/actions/content-gen/policies";
import type { ContentGenQueueHealth } from "@/server/actions/content-gen/health";
import { QueueHealthPanel } from "./QueueHealthPanel";

interface Props {
  cfg: BatchSettings;
  health: ContentGenQueueHealth;
}

export function BatchesV2({ cfg, health }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    // dailyTargetByType édité en JSON (record type→nombre/jour). JSON invalide
    // → on conserve un objet vide (la validation serveur rejette les types inconnus).
    let dailyTargetByType: Record<string, number> = {};
    const rawTargets = String(formData.get("dailyTargetByType") ?? "").trim();
    if (rawTargets) {
      try {
        const parsed = JSON.parse(rawTargets);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          dailyTargetByType = parsed as Record<string, number>;
        }
      } catch {
        // garde {} si JSON invalide
      }
    }
    await updateBatchSettings({
      workersConcurrency: Number(formData.get("workersConcurrency") ?? 3),
      retryMaxAttempts: Number(formData.get("retryMaxAttempts") ?? 3),
      retryBackoffMs: Number(formData.get("retryBackoffMs") ?? 30000),
      antiBurstEnabled: formData.get("antiBurstEnabled") === "on",
      dailyTargetByType: dailyTargetByType as BatchSettings["dailyTargetByType"],
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Batches & workers"
        description="Concurrence des workers · retries · cibles/jour par type · anti-burst. Consommé par l'orchestrateur (tick 15 min)."
      />

      <AdminCard>
        <form action={save}>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="workersConcurrency" className="admin-label">
                Concurrence workers (1-20)
              </label>
              <input
                id="workersConcurrency"
                name="workersConcurrency"
                type="number"
                min="1"
                max="20"
                defaultValue={cfg.workersConcurrency}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="retryMaxAttempts" className="admin-label">
                Retries max (0-10)
              </label>
              <input
                id="retryMaxAttempts"
                name="retryMaxAttempts"
                type="number"
                min="0"
                max="10"
                defaultValue={cfg.retryMaxAttempts}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="retryBackoffMs" className="admin-label">
                Backoff retry (ms)
              </label>
              <input
                id="retryBackoffMs"
                name="retryBackoffMs"
                type="number"
                min="0"
                defaultValue={cfg.retryBackoffMs}
                className="admin-input"
                required
              />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">
              <input
                type="checkbox"
                name="antiBurstEnabled"
                defaultChecked={cfg.antiBurstEnabled}
              />{" "}
              Anti-burst (étaler la génération sur 24h, pas en une rafale)
            </label>
          </div>

          <div className="admin-field">
            <label htmlFor="dailyTargetByType" className="admin-label">
              Cibles/jour par type (JSON, override du dailyArticles par-campagne) — ex.{" "}
              {`{ "blog_article": 20, "blog_from_rss": 10 }`}
            </label>
            <textarea
              id="dailyTargetByType"
              name="dailyTargetByType"
              rows={6}
              spellCheck={false}
              defaultValue={JSON.stringify(cfg.dailyTargetByType ?? {}, null, 2)}
              className="admin-input"
              style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }}
            />
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer
            </button>
          </div>
        </form>
      </AdminCard>

      <QueueHealthPanel health={health} />
    </AdminPageShell>
  );
}
