// Tableau de bord de PILOTAGE (refonte console phase 3, audit UX 2026-08-01).
//
// Server Component pur : toutes les données arrivent en props, déjà assemblées
// par `getPilotageDashboard` (le fetch reste dans le wrapper — un seul point
// d'entrée DB). Sept sections, du plus urgent au plus froid, puis l'activité
// récente et les liens d'exploitation en bas de page. Zéro lib graphique :
// les seules « courbes » sont des barres CSS rendues côté serveur.
//
// NB : ne pas préfixer un numéro de PR par « # » dans src/app —
// `scripts/check-anti-hex.sh` y verrait une couleur hex codée en dur.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import type { PilotageDashboard } from "@/server/admin/pilotage-dashboard";
import { EnTetePilotage } from "./pilotage/EnTetePilotage";
import { AlertesCritiques } from "./pilotage/AlertesCritiques";
import { CalendrierPrevisionnel } from "./pilotage/CalendrierPrevisionnel";
import { ActiviteSection } from "./pilotage/ActiviteSection";
import { FormateursSection } from "./pilotage/FormateursSection";
import { FinancierSection } from "./pilotage/FinancierSection";
import { PipelineSection } from "./pilotage/PipelineSection";
import { libelleRole } from "./pilotage/format";

interface DashboardV2Props {
  adminPrefix: string;
  email: string | null;
  role: string;
  logoutAction: () => Promise<void> | void;
  dashboard: PilotageDashboard;
  activityRows: ReadonlyArray<{ id: string; primary: string; secondary: string }>;
}

export function DashboardV2({
  adminPrefix,
  email,
  role,
  logoutAction,
  dashboard,
  activityRows,
}: DashboardV2Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Tableau de bord de pilotage"
        description={`Connecté en tant que ${email ?? "—"} · ${libelleRole(role)}`}
        actions={
          <form action={logoutAction}>
            <button type="submit" className="admin-button-ghost">
              Déconnexion
            </button>
          </form>
        }
      />

      {/* 1 — Sélecteur de période + tuiles de pilotage. */}
      <EnTetePilotage
        adminPrefix={adminPrefix}
        periode={dashboard.periode}
        periodeLabel={dashboard.periodeLabel}
        tuiles={dashboard.tuiles}
        objectif={dashboard.objectif}
      />

      {/* 2 — Alertes critiques (toujours visible, même vide). */}
      <AlertesCritiques adminPrefix={adminPrefix} alertes={dashboard.alertesCritiques} />

      {/* 3 — Calendrier & prévisionnel (le cœur). */}
      <CalendrierPrevisionnel
        adminPrefix={adminPrefix}
        calendrier={dashboard.calendrier}
        previsionnelBloque={dashboard.previsionnelBloque}
      />

      {/* 4 — Activité par famille de prestation. */}
      <ActiviteSection activites={dashboard.activites} periodeLabel={dashboard.periodeLabel} />

      {/* 5 — Formateurs. */}
      <FormateursSection adminPrefix={adminPrefix} formateurs={dashboard.formateurs} />

      {/* 6 — Financier. */}
      <FinancierSection
        adminPrefix={adminPrefix}
        financier={dashboard.financier}
        objectif={dashboard.objectif}
      />

      {/* 7 — Pipeline commercial. */}
      <PipelineSection adminPrefix={adminPrefix} pipeline={dashboard.pipeline} />

      {/* Activité récente — volontairement en bas de page. */}
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
