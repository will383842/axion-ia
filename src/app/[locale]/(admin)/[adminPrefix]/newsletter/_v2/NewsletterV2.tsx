// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Newsletter V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { SubscriberRowActions } from "./SubscriberRowActions";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { CheckCircle2, Hourglass, MailX } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  footer: "Pied de page",
  "blog-cta": "Encart en fin d'article",
  "exit-intent": "Fenêtre de sortie",
  homepage: "Page d'accueil",
  ressources: "Page Ressources",
  manual: "Ajout manuel",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  unsubscribed: "Désabonné",
  bounced: "Rejeté",
};
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  confirmed: "success",
  pending: "warning",
  unsubscribed: "neutral",
  bounced: "neutral",
};

interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  status: string;
  source: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

interface Stats {
  confirmed?: { fr?: number; en?: number };
  pending?: { fr?: number; en?: number };
  unsubscribed?: { fr?: number; en?: number };
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<SubscriberRow>;
  total: number;
  page: number;
  totalPages: number;
  stats: Stats;
  csvUrl: string;
}

export function NewsletterV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  stats,
  csvUrl,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<SubscriberRow>> = [
    {
      key: "createdAt",
      header: "Date inscription",
      cell: (s) => formatDateFrShort(s.createdAt),
    },
    { key: "email", header: "Email", cell: (s) => s.email },
    { key: "locale", header: "Langue", cell: (s) => s.locale.toUpperCase() },
    {
      key: "status",
      header: "Statut",
      cell: (s) => (
        <AdminBadge tone={STATUS_TONE[s.status] ?? "neutral"}>
          {STATUS_LABELS[s.status] ?? s.status}
        </AdminBadge>
      ),
    },
    {
      key: "source",
      header: "Source",
      // La colonne affichait l'identifiant interne posé par le formulaire
      // d'inscription : « footer », « blog-cta », « exit-intent ».
      cell: (s) => (s.source === null ? "—" : (SOURCE_LABELS[s.source] ?? s.source)),
    },
    {
      key: "confirmedAt",
      header: "Confirmé le",
      cell: (s) => formatDateFrShort(s.confirmedAt),
    },
    {
      key: "unsubscribedAt",
      header: "Désabonné le",
      cell: (s) => formatDateFrShort(s.unsubscribedAt),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (s) => <SubscriberRowActions id={s.id} status={s.status} />,
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Newsletter"
        description={`${total} abonné${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <a href={csvUrl} className="admin-button-ghost" download>
            Exporter CSV (confirmés)
          </a>
        }
      />

      <section
        aria-label="KPIs newsletter"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard label="Confirmés FR" value={stats.confirmed?.fr ?? 0} icon={CheckCircle2} />
        <AdminStatCard label="Confirmés EN" value={stats.confirmed?.en ?? 0} icon={CheckCircle2} />
        <AdminStatCard
          label="En attente (double opt-in)"
          value={(stats.pending?.fr ?? 0) + (stats.pending?.en ?? 0)}
          icon={Hourglass}
        />
        <AdminStatCard
          label="Désabonnés"
          value={(stats.unsubscribed?.fr ?? 0) + (stats.unsubscribed?.en ?? 0)}
          icon={MailX}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="locale" className="admin-label">
                Locale
              </label>
              <select
                id="locale"
                name="locale"
                defaultValue={sp["locale"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Toutes</option>
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Email
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
              <label htmlFor="source" className="admin-label">
                Source
              </label>
              <input
                id="source"
                name="source"
                type="text"
                defaultValue={sp["source"] ?? ""}
                className="admin-input"
                placeholder="ex: footer, blog-cta…"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dateFrom" className="admin-label">
                Inscrit du
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
                Inscrit au
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
            <Link href={`/fr/${adminPrefix}/newsletter`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun abonné trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(s) => s.id}
          caption="Liste des abonnés newsletter"
        />
      )}

      {/* 🔴 LA PAGINATION ÉTAIT CALCULÉE MAIS JAMAIS RENDUE (audit du code,
          2026-08-03). Le composant recevait `page` et `totalPages`, les
          affichait dans le sous-titre — « page 1/12 » — et n'offrait AUCUN
          moyen d'aller à la page 2. Onze pages d'abonnés n'étaient atteignables
          qu'en éditant l'URL à la main. Les filtres sont préservés dans les
          liens, sinon changer de page réinitialiserait la recherche en cours. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/newsletter`}
        preservedParams={{
          status: sp["status"],
          locale: sp["locale"],
          source: sp["source"],
          search: sp["search"],
          dateFrom: sp["dateFrom"],
          dateTo: sp["dateTo"],
        }}
      />
    </AdminPageShell>
  );
}
