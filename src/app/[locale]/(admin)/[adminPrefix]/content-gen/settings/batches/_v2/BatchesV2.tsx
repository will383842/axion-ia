// Refonte admin mai 2026 — PR 7 (ADR 0028). P0-3 Sprint P5 — MAX_PUBLISH_PER_DAY.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import type { ContentType } from "../../../../../../../../../prisma/generated/client";
import {
  type DailyTargetByType,
  updateBatchSettings,
  updateMaxPublishPerDay,
} from "@/server/actions/content-gen/policies";
import { CONTENT_TYPES_ALL } from "@/server/actions/content-gen/policies-constants";

interface BatchConfig {
  dailyBatchSize: number;
  workersConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  dailyTargetByType: Partial<Record<ContentType, number>>;
  antiBurstEnabled: boolean;
  maxPublishPerDay: number;
}

interface Props {
  cfg: BatchConfig;
}

export function BatchesV2({ cfg }: Props): React.ReactElement {
  async function saveMaxPublish(formData: FormData) {
    "use server";
    await updateMaxPublishPerDay(Number(formData.get("maxPublishPerDay") ?? 30));
  }

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
    <AdminPageShell>
      <AdminPageHeader title="Batches & workers" description="Réglages BullMQ + scheduling." />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Cap global articles/jour</h2>
        <p className="admin-meta-block">
          Limite publications/jour (8h–22h CET). Valeur actuelle :{" "}
          <strong>{cfg.maxPublishPerDay}</strong> art/jour.
        </p>
        <form action={saveMaxPublish} className="flex items-end gap-[var(--space-admin-4)]">
          <div className="admin-field">
            <label htmlFor="maxPublishPerDay" className="admin-label">
              Cap articles/jour
            </label>
            <input
              id="maxPublishPerDay"
              name="maxPublishPerDay"
              type="number"
              min="1"
              max="1000"
              step="10"
              defaultValue={cfg.maxPublishPerDay}
              className="admin-input w-32"
              required
            />
          </div>
          <button type="submit" className="admin-button mb-[var(--space-admin-1)]">
            Mettre à jour
          </button>
        </form>
      </AdminCard>

      <AdminCard>
        <form action={save}>
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

          <hr className="my-[var(--space-admin-6)] border-[color:var(--color-admin-border)]" />

          <div>
            <h2 className="admin-h2">Mode V2 — cibles/jour par type (Sprint 7)</h2>
            <p className="admin-meta-block">
              Si <strong>au moins un</strong> type a une cible &gt; 0, mode anti-burst per-type.
              Plage par type : 0 à 100/jour. Plafond cumulé : 500/jour.
            </p>

            <div className="admin-field mt-[var(--space-admin-4)]">
              <label htmlFor="antiBurstEnabled" className="admin-label">
                <input
                  type="checkbox"
                  id="antiBurstEnabled"
                  name="antiBurstEnabled"
                  defaultChecked={cfg.antiBurstEnabled}
                  className="mr-[var(--space-admin-2)]"
                />
                Anti-burst — étaler uniformément sur 24h
              </label>
            </div>

            <div className="admin-filters-grid mt-[var(--space-admin-4)]">
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
      </AdminCard>
    </AdminPageShell>
  );
}
