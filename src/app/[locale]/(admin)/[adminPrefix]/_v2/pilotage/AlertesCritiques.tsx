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
        <Link href={`${base}/qualiopi/alertes`} className="admin-button-ghost">
          Gérer →
        </Link>
      </div>
      {alertes.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
          Aucune alerte critique — rien ne bloque.
        </p>
      ) : (
        <ul className="flex flex-col">
          {alertes.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-[var(--space-admin-1)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-4)] first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline gap-[var(--space-admin-3)]">
                <AdminBadge tone="destructive" dot>
                  Critique
                </AdminBadge>
                <strong className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {a.titre}
                </strong>
                <span className="ml-auto shrink-0 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {fmtDate(a.createdAt)}
                </span>
              </div>
              {/* Certaines alertes recopient une réponse d'API brute — un
                  échec de job IA fait des centaines de caractères de JSON.
                  Sans limite, une seule alerte remplissait l'écran et
                  enterrait les autres. Deux lignes ici ; le texte complet vit
                  dans l'infobulle et sur la page Alertes. */}
              <p
                title={a.message}
                className="line-clamp-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
              >
                {a.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
