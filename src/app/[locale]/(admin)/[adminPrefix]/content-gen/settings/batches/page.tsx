/**
 * Content Generator — Settings batches & workers (§ 12.5).
 *
 * Daily batch size, workers concurrency, retry policy. Stockés en
 * ContentGenConfig (key="batches").
 */

import { redirect } from "next/navigation";
import type { ContentType } from "../../../../../../../../prisma/generated/client";
import { auth } from "@/auth";
import {
  CONTENT_TYPES_ALL,
  type DailyTargetByType,
  getBatchSettings,
  updateBatchSettings,
} from "@/server/actions/content-gen/policies";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BatchesSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getBatchSettings();

  async function save(formData: FormData) {
    "use server";
    const dailyTargetByType: DailyTargetByType = {};
    for (const type of CONTENT_TYPES_ALL) {
      const raw = formData.get(`dailyTarget_${type}`);
      const num = Number(raw ?? 0);
      if (Number.isFinite(num) && num > 0) {
        dailyTargetByType[type as ContentType] = num;
      }
    }
    await updateBatchSettings({
      dailyBatchSize: Number(formData.get("dailyBatchSize") ?? 0),
      workersConcurrency: Number(formData.get("workersConcurrency") ?? 0),
      retryMaxAttempts: Number(formData.get("retryMaxAttempts") ?? 0),
      retryBackoffMs: Number(formData.get("retryBackoffMs") ?? 0),
      dailyTargetByType,
      antiBurstEnabled: formData.get("antiBurstEnabled") === "on",
    });
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Batches &amp; workers</h1>
          <p className="admin-meta">
            Réglages BullMQ + scheduling. Le worker lit ces valeurs au démarrage et à chaque nouveau
            batch.
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="dailyBatchSize" className="admin-label">
              Batch size jour (villes/jour)
            </label>
            <input
              id="dailyBatchSize"
              name="dailyBatchSize"
              type="number"
              min="1"
              max="1000"
              defaultValue={cfg.dailyBatchSize}
              className="admin-input"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="workersConcurrency" className="admin-label">
              Workers concurrency
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
              Max retry par job
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
              min="1000"
              max="600000"
              step="1000"
              defaultValue={cfg.retryBackoffMs}
              className="admin-input"
              required
            />
          </div>
        </div>

        <hr style={{ margin: "2rem 0 1rem", borderColor: "var(--color-border)" }} />

        <div>
          <h2 className="admin-h2">Mode V2 — cibles/jour par type (Sprint 7)</h2>
          <p className="admin-meta">
            Si <strong>au moins un</strong> type a une cible &gt; 0, l&apos;orchestrator passe en
            mode anti-burst per-type et ignore <code>dailyBatchSize</code> global. Laisser tout à 0
            pour rester en mode V1 (global). Plage par type : 0 à 100/jour. Plafond cumulé :
            500/jour.
          </p>

          <div className="admin-field" style={{ marginTop: "1rem" }}>
            <label htmlFor="antiBurstEnabled" className="admin-label">
              <input
                type="checkbox"
                id="antiBurstEnabled"
                name="antiBurstEnabled"
                defaultChecked={cfg.antiBurstEnabled}
                style={{ marginRight: "0.5rem" }}
              />
              Anti-burst — étaler uniformément sur 24h (vs rattraper d&apos;un coup)
            </label>
          </div>

          <div className="admin-filters-grid" style={{ marginTop: "1rem" }}>
            {CONTENT_TYPES_ALL.map((type) => (
              <div className="admin-field" key={type}>
                <label htmlFor={`dailyTarget_${type}`} className="admin-label">
                  {type}
                </label>
                <input
                  id={`dailyTarget_${type}`}
                  name={`dailyTarget_${type}`}
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={cfg.dailyTargetByType[type] ?? 0}
                  className="admin-input"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer
          </button>
        </div>
      </form>
    </section>
  );
}
