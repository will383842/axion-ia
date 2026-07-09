// Refonte admin mai 2026 — PR 6 (ADR 0028, PATTERNS.md §4 dashboard).
//
// Dashboard V2 — utilise AdminPageShell + AdminStatCard + AdminCard.
// Server Component, prend `adminPrefix` + données déjà fetchées en props
// (le fetch reste dans la page racine V1 pour éviter doublon DB).
//
// Nettoyage 2026-07-09 (audit vestiges booking) :
//   Les sections « Aujourd'hui » (Prêts à valider / Options à valider /
//   Cadrages / Paiements du jour), « Activité » (Interventions semaine+mois /
//   Encaissé / Factures en retard) et les 4 SnapshotCard (readyToValidate,
//   pendingOptionRows, waitingClientRows, cadrageRows) lisaient les tables de
//   l'ancien flux de réservation payante (Booking / BookingOption / Payment /
//   Invoice). Ce flux est éteint : Calendly a remplacé le créneau public
//   (`createBookingAction` / `postOption48hAction` n'existent plus) et Stripe
//   est neutralisé → ces blocs affichaient 0 / listes vides en permanence,
//   au prix de 13 requêtes DB inutiles à chaque ouverture de l'accueil admin.
//   Retirés ici (les onglets correspondants sont déjà masqués, cf. PR 283).
//   NB : ne pas préfixer un numéro de PR par « # » dans src/app —
//   `scripts/check-anti-hex.sh` y verrait une couleur hex codée en dur.
//   Restent les 3 repères contenu + l'activité récente, réellement alimentés.

import Link from "next/link";
import { Inbox, Newspaper, Mail } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";

interface DashboardV2Props {
  adminPrefix: string;
  email: string | null;
  role: string;
  logoutAction: () => Promise<void> | void;
  kpis: {
    totalSubmissions: number;
    totalArticles: number;
    totalSubscribers: number;
  };
  activityRows: ReadonlyArray<{ id: string; primary: string; secondary: string }>;
}

export function DashboardV2({
  adminPrefix,
  email,
  role,
  logoutAction,
  kpis,
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
        aria-label="Repères contenu"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3"
      >
        <AdminStatCard label="Soumissions totales" value={kpis.totalSubmissions} icon={Inbox} />
        <AdminStatCard label="Articles publiés" value={kpis.totalArticles} icon={Newspaper} />
        <AdminStatCard label="Abonnés newsletter" value={kpis.totalSubscribers} icon={Mail} />
      </section>

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
