/**
 * Content Generator — Settings batches & workers (§ 12.5).
 *
 * Daily batch size, workers concurrency, retry policy. Stockés en
 * ContentGenConfig (key="batches").
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBatchSettings, updateBatchSettings } from "@/server/actions/content-gen/policies";

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
    await updateBatchSettings({
      dailyBatchSize: Number(formData.get("dailyBatchSize") ?? 0),
      workersConcurrency: Number(formData.get("workersConcurrency") ?? 0),
      retryMaxAttempts: Number(formData.get("retryMaxAttempts") ?? 0),
      retryBackoffMs: Number(formData.get("retryBackoffMs") ?? 0),
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

        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer
          </button>
        </div>
      </form>
    </section>
  );
}
