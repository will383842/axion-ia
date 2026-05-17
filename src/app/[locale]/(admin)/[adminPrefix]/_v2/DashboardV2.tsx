// Refonte admin mai 2026 — PR 6 (ADR 0028, PATTERNS.md §4 dashboard).
//
// Dashboard V2 — utilise AdminPageShell + AdminStatCard + AdminCard.
// Server Component, prend `adminPrefix` + données déjà fetchées en props
// (le fetch reste dans la page racine V1 pour éviter doublon DB).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";

interface DashboardSnapshotItem {
  id: string;
  href: string;
  primary: string;
  secondary?: string;
}

interface DashboardV2Props {
  adminPrefix: string;
  email: string | null;
  role: string;
  logoutAction: () => Promise<void> | void;
  kpis: {
    pendingValidation: number;
    pendingOptions: number;
    cadragesUpcoming: number;
    paymentsTodayCount: number;
    paymentsTodayAmount: string;
    bookingsWeek: number;
    bookingsMonth: number;
    revenuesMonth: string;
    invoicesOverdue: number;
    totalSubmissions: number;
    totalArticles: number;
    totalSubscribers: number;
  };
  readyToValidate: ReadonlyArray<DashboardSnapshotItem>;
  pendingOptionRows: ReadonlyArray<DashboardSnapshotItem>;
  waitingClientRows: ReadonlyArray<DashboardSnapshotItem>;
  cadrageRows: ReadonlyArray<DashboardSnapshotItem>;
  activityRows: ReadonlyArray<{ id: string; primary: string; secondary: string }>;
}

export function DashboardV2({
  adminPrefix,
  email,
  role,
  logoutAction,
  kpis,
  readyToValidate,
  pendingOptionRows,
  waitingClientRows,
  cadrageRows,
  activityRows,
}: DashboardV2Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Tableau de bord"
        description={`Connecté en tant que ${email ?? "—"} · ${role}`}
        actions={
          <form action={logoutAction}>
            <button type="submit" className="admin-button-ghost">
              Déconnexion
            </button>
          </form>
        }
      />

      <section
        aria-label="Aujourd'hui"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard
          label="Prêts à valider (D49)"
          value={kpis.pendingValidation}
          tone={kpis.pendingValidation > 0 ? "warning" : "default"}
          href={`${base}/reservations?status=awaiting_admin_validation`}
        />
        <AdminStatCard
          label="Options à valider"
          value={kpis.pendingOptions}
          tone={kpis.pendingOptions > 0 ? "warning" : "default"}
          href={`${base}/options`}
        />
        <AdminStatCard
          label="Cadrages 7 prochains jours"
          value={kpis.cadragesUpcoming}
          href={`${base}/calendrier`}
        />
        <AdminStatCard
          label="Paiements reçus aujourd'hui"
          value={kpis.paymentsTodayCount}
          meta={kpis.paymentsTodayAmount}
          tone="success"
          href={`${base}/paiements`}
        />
      </section>

      <section
        aria-label="Activité"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard label="Interventions cette semaine" value={kpis.bookingsWeek} />
        <AdminStatCard label="Interventions ce mois" value={kpis.bookingsMonth} />
        <AdminStatCard label="Encaissé ce mois" value={kpis.revenuesMonth} tone="success" />
        <AdminStatCard
          label="Factures en retard"
          value={kpis.invoicesOverdue}
          tone={kpis.invoicesOverdue > 0 ? "destructive" : "default"}
          href={`${base}/factures?status=overdue`}
        />
      </section>

      <SnapshotCard
        title="Prêts à valider sur le calendrier (D49)"
        description="Acompte reçu, en attente du clic « Valider sur le calendrier »."
        emptyLabel="Aucun booking en attente — rien à faire ici."
        items={readyToValidate}
      />
      <SnapshotCard
        title="Demandes options à valider"
        description="Parcours A — visiteurs en attente du clic « Envoyer contrat + acompte »."
        emptyLabel="Aucune option en attente."
        items={pendingOptionRows}
      />
      <SnapshotCard
        title="En attente du client"
        description="Contrat envoyé et lien de paiement actif — pas encore d'acompte reçu."
        emptyLabel="Aucun booking en attente client."
        items={waitingClientRows}
      />
      <SnapshotCard
        title="Cadrages à venir (14 j)"
        emptyLabel="Aucun cadrage planifié."
        items={cadrageRows}
      />

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Activité récente
        </h2>
        {activityRows.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune activité enregistrée.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-admin-3)]">
            {activityRows.map((a) => (
              <li
                key={a.id}
                className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
              >
                <strong className="text-[color:var(--color-admin-fg)]">{a.primary}</strong>
                <span className="ml-[var(--space-admin-2)]">{a.secondary}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-[var(--space-admin-5)]">
          <Link
            href={`${base}/activity-logs`}
            className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
          >
            Voir tout le journal →
          </Link>
        </p>
      </AdminCard>

      <section
        aria-label="Repères contenu"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3"
      >
        <AdminStatCard label="Soumissions totales" value={kpis.totalSubmissions} />
        <AdminStatCard label="Articles publiés" value={kpis.totalArticles} />
        <AdminStatCard label="Abonnés newsletter" value={kpis.totalSubscribers} />
      </section>

      <AdminCard>
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Ops · Monitoring
        </h2>
        <ul className="flex flex-col gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          <li>
            <Link
              href={`${base}/infra`}
              className="font-medium text-[color:var(--color-admin-info)] hover:underline"
            >
              /infra
            </Link>{" "}
            <span className="text-[color:var(--color-admin-fg-soft)]">
              — Console infra (14 outils, statut live, liens directs)
            </span>
          </li>
          <li>
            <Link
              href={`${base}/alerts`}
              className="font-medium text-[color:var(--color-admin-info)] hover:underline"
            >
              /alerts
            </Link>{" "}
            <span className="text-[color:var(--color-admin-fg-soft)]">
              — Alertes agrégées (Sentry · UptimeRobot · Coolify)
            </span>
          </li>
          <li>
            <Link
              href={`${base}/2fa/setup`}
              className="font-medium text-[color:var(--color-admin-info)] hover:underline"
            >
              /2fa/setup
            </Link>{" "}
            <span className="text-[color:var(--color-admin-fg-soft)]">
              — Activer la 2FA sur votre compte
            </span>
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}

interface SnapshotCardProps {
  title: string;
  description?: string;
  emptyLabel: string;
  items: ReadonlyArray<DashboardSnapshotItem>;
}

function SnapshotCard({
  title,
  description,
  emptyLabel,
  items,
}: SnapshotCardProps): React.ReactElement {
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        {title}
      </h2>
      {description ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {description}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {items.map((it) => (
            <li
              key={it.id}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
            >
              <Link
                href={it.href}
                className="font-medium text-[color:var(--color-admin-info)] hover:underline"
              >
                {it.primary}
              </Link>
              {it.secondary ? (
                <span className="ml-[var(--space-admin-2)]">{it.secondary}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
