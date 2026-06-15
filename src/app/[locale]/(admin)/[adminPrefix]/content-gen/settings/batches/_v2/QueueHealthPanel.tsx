// Panneau « Santé des files » (F5) — Server Component, lecture fail-soft.
//
// Affiche : profondeur BullMQ par file content-gen (waiting/active/delayed/
// failed), état du kill-switch, dernier job par contentType (date + status).
// Aucun client component : rendu HTML statique pour ne pas alourdir le First
// Load JS. Données fournies par `getContentGenQueueHealth()` (module serveur).

import { AdminCard } from "@/components/admin/ui";
import type { ContentGenQueueHealth } from "@/server/actions/content-gen/health";

interface Props {
  health: ContentGenQueueHealth;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function QueueHealthPanel({ health }: Props): React.ReactElement {
  const { queues, killSwitch, lastJobByType, redisUnavailable, dbUnavailable } = health;

  return (
    <AdminCard className="mt-[var(--space-admin-6,16px)]">
      <div className="mb-[var(--space-admin-4,8px)] flex items-center justify-between gap-[var(--space-admin-4,8px)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Santé des files
        </h2>
        <span
          className={
            killSwitch.active
              ? "rounded-[var(--radius-admin-sm,4px)] bg-[color:var(--color-admin-destructive)] px-[var(--space-admin-3,6px)] py-[2px] text-[length:var(--text-admin-xs)] font-semibold text-white"
              : "rounded-[var(--radius-admin-sm,4px)] border border-[color:var(--color-admin-success)] px-[var(--space-admin-3,6px)] py-[2px] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-success)]"
          }
        >
          {killSwitch.active ? "Kill-switch ACTIF — génération bloquée" : "Kill-switch inactif"}
        </span>
      </div>

      {(redisUnavailable || dbUnavailable) && (
        <p className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {redisUnavailable && "Redis indisponible (profondeurs à 0). "}
          {dbUnavailable && "Base de données indisponible (derniers jobs masqués)."}
        </p>
      )}

      {/* Profondeur des files BullMQ */}
      <h3 className="mb-[var(--space-admin-3,6px)] text-[length:var(--text-admin-sm)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Profondeur des files BullMQ
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
          <thead>
            <tr className="border-b border-[color:var(--color-admin-border)] text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] font-medium">
                File
              </th>
              <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right font-medium tabular-nums">
                Waiting
              </th>
              <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right font-medium tabular-nums">
                Active
              </th>
              <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right font-medium tabular-nums">
                Delayed
              </th>
              <th className="py-[var(--space-admin-2,4px)] text-right font-medium tabular-nums">
                Failed
              </th>
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => (
              <tr
                key={q.name}
                className="border-b border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
              >
                <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] font-mono">
                  {q.name}
                </td>
                <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right tabular-nums">
                  {q.waiting}
                </td>
                <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right tabular-nums">
                  {q.active}
                </td>
                <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] text-right tabular-nums">
                  {q.delayed}
                </td>
                <td
                  className={
                    q.failed > 0
                      ? "py-[var(--space-admin-2,4px)] text-right font-semibold text-[color:var(--color-admin-destructive)] tabular-nums"
                      : "py-[var(--space-admin-2,4px)] text-right tabular-nums"
                  }
                >
                  {q.failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dernier job par type */}
      <h3 className="mt-[var(--space-admin-6,16px)] mb-[var(--space-admin-3,6px)] text-[length:var(--text-admin-sm)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Dernier job par type de contenu
      </h3>
      {lastJobByType.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun job enregistré.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)] text-left text-[color:var(--color-admin-fg-muted)]">
                <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] font-medium">
                  Type
                </th>
                <th className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] font-medium">
                  Dernier job
                </th>
                <th className="py-[var(--space-admin-2,4px)] font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lastJobByType.map((j) => (
                <tr
                  key={j.contentType}
                  className="border-b border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
                >
                  <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] font-mono">
                    {j.contentType}
                  </td>
                  <td className="py-[var(--space-admin-2,4px)] pr-[var(--space-admin-4,8px)] tabular-nums">
                    {formatDate(j.createdAt)}
                  </td>
                  <td className="py-[var(--space-admin-2,4px)] font-mono">{j.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
