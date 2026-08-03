// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Activity logs V2 — AdminPageShell + AdminPageHeader + AdminCard. Read-only.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { decrireAction } from "@/lib/admin/activity-labels";

// Heure seule (Europe/Paris) — la colonne Date affiche jour et heure sur deux
// lignes ; `formatDateFr` colle les deux sur une seule.
const HEURE_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface LogRow {
  id: string;
  createdAt: Date;
  adminUser: { name: string; email: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  changes: unknown;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface StatRow {
  action: string;
  count: number;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<LogRow>;
  total: number;
  page: number;
  totalPages: number;
  users: ReadonlyArray<UserOption>;
  stats: ReadonlyArray<StatRow>;
}

/**
 * 🔴 LA COLONNE « TYPE CIBLE » ET SON FILTRE PARLAIENT SQL. On y lisait
 * `case_study`, `help_article`, `booking_option`, `newsletter_subscriber` —
 * des noms de tables, dans les deux endroits à la fois. Le reste de l'écran
 * traduit pourtant soigneusement les actions (`decrireAction`).
 *
 * Une clé inconnue est CITÉE : un nouveau type d'objet apparaîtra tel quel
 * plutôt que de disparaître derrière un tiret.
 */
const TYPE_CIBLE_LABELS: Record<string, string> = {
  article: "Article de blog",
  case_study: "Cas concret",
  help_article: "Article d'aide",
  testimonial: "Avis client",
  faq: "Question fréquente",
  category: "Catégorie",
  booking_option: "Option de réservation",
  calendar_slot: "Créneau de calendrier",
  submission: "Message reçu",
  newsletter_subscriber: "Abonné à la lettre d'information",
  setting: "Réglage",
  admin_user: "Compte administrateur",
};

const TYPES_CIBLE_ORDRE = Object.keys(TYPE_CIBLE_LABELS);

function libelleTypeCible(type: string): string {
  return TYPE_CIBLE_LABELS[type] ?? `« ${type} »`;
}

export function ActivityLogsV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  users,
  stats,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<LogRow>> = [
    {
      key: "date",
      header: "Date",
      cell: (l) => (
        <>
          <div>{formatDateFrShort(l.createdAt)}</div>
          <div className="admin-meta-small">{HEURE_FR.format(l.createdAt)}</div>
        </>
      ),
    },
    {
      key: "user",
      header: "Utilisateur",
      cell: (l) =>
        l.adminUser ? (
          <>
            <div>{l.adminUser.name}</div>
            <div className="admin-meta-small">{l.adminUser.email}</div>
          </>
        ) : (
          <span className="admin-meta-small">—</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      // 🔴 La colonne affichait la CLÉ BRUTE (« qualiopi.document.generate »).
      // `decrireAction` traduit ces clés en phrases depuis le 2026-08-02 et
      // sert déjà le journal du tableau de bord — le journal COMPLET, lui,
      // était resté en codes techniques, alors que c'est l'écran qu'on ouvre
      // pour comprendre ce qui s'est passé. La clé reste en infobulle pour qui
      // la cherche, et le « Top 20 » au-dessus est traduit de la même façon.
      cell: (l) => (
        <span className="admin-meta-small" title={l.action}>
          {decrireAction(l.action).texte}
        </span>
      ),
    },
    {
      key: "targetType",
      header: "Type cible",
      cell: (l) => (l.targetType === null ? "—" : libelleTypeCible(l.targetType)),
    },
    {
      key: "targetId",
      header: "ID cible",
      cell: (l) =>
        l.targetId ? <code className="admin-meta-small">{l.targetId.slice(0, 8)}…</code> : "—",
    },
    {
      key: "ip",
      header: "IP",
      cell: (l) => <span className="admin-meta-small">{l.ipAddress ?? "—"}</span>,
    },
    {
      key: "changes",
      header: "Changements",
      cell: (l) =>
        l.changes ? (
          <pre className="admin-json admin-json-cell">{JSON.stringify(l.changes, null, 2)}</pre>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Journaux d'activité"
        description={`${total} entrée${total > 1 ? "s" : ""} · page ${page}/${totalPages} · journal d'audit en lecture seule`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Top 20 actions enregistrées</h2>
        <div className="admin-tags-grid">
          {stats.length === 0 ? (
            <p className="admin-meta-small">Aucune action enregistrée.</p>
          ) : (
            stats.map((s) => (
              <span key={s.action} className="admin-tag-checkbox" title={s.action}>
                {decrireAction(s.action).texte}
                <strong>{s.count}</strong>
              </span>
            ))
          )}
        </div>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="adminUserId" className="admin-label">
                Utilisateur
              </label>
              <select
                id="adminUserId"
                name="adminUserId"
                defaultValue={sp["adminUserId"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="action" className="admin-label">
                Action (contient)
              </label>
              <input
                id="action"
                name="action"
                type="text"
                defaultValue={sp["action"] ?? ""}
                className="admin-input"
                placeholder="ex: option.validated"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="targetType" className="admin-label">
                Type cible
              </label>
              <select
                id="targetType"
                name="targetType"
                defaultValue={sp["targetType"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {TYPES_CIBLE_ORDRE.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_CIBLE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (action / target / IP)
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dateFrom" className="admin-label">
                Du
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={sp["dateFrom"] ?? ""}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dateTo" className="admin-label">
                Au
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={sp["dateTo"] ?? ""}
                className="admin-input"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/activity-logs`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune entrée trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(l) => l.id}
          caption="Journal d'audit"
        />
      )}
    </AdminPageShell>
  );
}
