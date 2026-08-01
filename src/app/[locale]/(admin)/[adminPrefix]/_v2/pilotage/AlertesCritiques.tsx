// Tableau de bord de pilotage — section 2 : alertes critiques.
//
// TOUJOURS visible, jamais repliée : une section qui disparaît quand tout va
// bien ne rassure personne — « Aucune alerte critique » en vert EST le message.

import Link from "next/link";
import { AdminCard, AdminBadge } from "@/components/admin/ui";
import type { AlerteCritiqueLigne } from "@/server/admin/pilotage-dashboard";
import { fmtDate } from "./format";

interface Props {
  adminPrefix: string;
  alertes: AlerteCritiqueLigne[];
}

export function AlertesCritiques({ adminPrefix, alertes }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Alertes critiques
        </h2>
        <Link
          href={`${base}/qualiopi/alertes`}
          className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
        >
          Gérer →
        </Link>
      </div>
      {alertes.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
          Aucune alerte critique — rien ne bloque.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {alertes.map((a) => (
            <li key={a.id} className="flex flex-col gap-[var(--space-admin-1)]">
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <AdminBadge tone="destructive" dot>
                  Critique
                </AdminBadge>
                <strong className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {a.titre}
                </strong>
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {fmtDate(a.createdAt)}
                </span>
              </div>
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                {a.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
