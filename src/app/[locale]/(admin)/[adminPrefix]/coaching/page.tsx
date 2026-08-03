// Coaching 1-to-1 — tableau de bord admin (gains de temps, optimisations,
// conformité AFEST). Vue transverse toutes séances / tous formateurs.
//
// 🔴 REFONTE 2026-08-03, revue visuelle. Cette page n'employait AUCUNE
// primitive admin : ni `AdminPageShell`, ni `AdminPageHeader`, ni `AdminCard`,
// ni `AdminStatCard`, ni `AdminTable`. Elle était écrite avec les jetons du
// SITE PUBLIC — `bg-cream`, `text-mocha`, `border-sand`, `text-terracotta`.
//
// Conséquence à l'écran : `bg-cream` sur le canvas admin (#f1ede3) donne un
// fond quasi identique au fond de page, et la bordure `border-border` du site
// public n'existe pas dans la charte admin. Les tuiles ne s'encadraient donc
// pas, et le reste de la page était du texte nu posé sur le fond — le
// « manque d'encadrement / trop textuel » signalé par Will, à l'état pur.
//
// Deux autres défauts corrigés au passage, tous deux visibles en production :
//   - « Statut des séances » rendait `Object.entries({})` : un titre de
//     section suivi de RIEN, pas même un état vide ;
//   - les tableaux posaient leur « Aucune donnée » dans un `<td>` sans
//     `colSpan`, sous un `<thead>` de trois colonnes → un tableau fantôme,
//     en-têtes affichés et texte glissé hors grille.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { ArrowRight, CalendarCheck, Lightbulb, CheckCheck, Timer, Inbox } from "lucide-react";
import { getCoachingDashboard } from "@/server/coaching-admin/queries";
import {
  coachingInterventionLabel,
  optimisationTypeLabel,
  sessionStatutLabel,
} from "@/server/formateur/coaching-options";

/** Un décimal à la française — `toFixed(1)` rendait « 0.0 ». */
const UN_DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)} %`;
}

interface LigneOptimisation {
  type: string;
  count: number;
}
interface LigneMetier {
  slug: string;
  sessions: number;
  gainH: number;
}

export default async function CoachingDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const base = `/${locale}/${adminPrefix}/coaching`;
  const d = await getCoachingDashboard();

  const statuts = Object.entries(d.byStatut);

  const colonnesOptimisation: ReadonlyArray<AdminTableColumn<LigneOptimisation>> = [
    { key: "type", header: "Type d'optimisation", cell: (r) => optimisationTypeLabel(r.type) },
    { key: "count", header: "Nombre", align: "right", cell: (r) => r.count },
  ];

  const colonnesMetier: ReadonlyArray<AdminTableColumn<LigneMetier>> = [
    { key: "metier", header: "Prestation", cell: (r) => coachingInterventionLabel(r.slug) },
    { key: "sessions", header: "Séances", align: "right", cell: (r) => r.sessions },
    {
      key: "gain",
      header: "Gain h/sem",
      align: "right",
      cell: (r) => UN_DECIMAL.format(r.gainH),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Coaching 1-to-1"
        description="Gains de temps mesurés, optimisations identifiées et conformité AFEST — toutes séances, tous formateurs."
        actions={
          <AdminButton href={`${base}/seances`} variant="ghost" iconAfter={ArrowRight}>
            Voir les séances
          </AdminButton>
        }
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] lg:grid-cols-4">
        <AdminStatCard label="Séances" value={d.totalSessions} icon={CalendarCheck} />
        <AdminStatCard
          label="Optimisations identifiées"
          value={d.totalOptimisations}
          icon={Lightbulb}
        />
        <AdminStatCard
          label="Optimisations retenues"
          value={d.optimisationsRetenues}
          tone="success"
          icon={CheckCheck}
        />
        <AdminStatCard
          label="Gain de temps cumulé (h/sem)"
          value={UN_DECIMAL.format(d.gainTempsHSemaineTotal)}
          icon={Timer}
        />
      </div>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Statut des séances</h2>
        {statuts.length === 0 ? (
          <AdminEmptyState
            icon={<Inbox size={22} aria-hidden="true" />}
            title="Aucune séance enregistrée"
            description="Les statuts s'afficheront dès la première séance créée."
          />
        ) : (
          <div className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-3)]">
            {statuts.map(([s, n]) => (
              <span
                key={s}
                className="inline-flex items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
              >
                {sessionStatutLabel(s)}
                <strong className="tabular-nums">{n}</strong>
              </span>
            ))}
          </div>
        )}
      </AdminCard>

      <div className="mb-[var(--space-admin-6)] grid gap-[var(--space-admin-6)] lg:grid-cols-2">
        <AdminCard>
          <h2 className="admin-h2">Optimisations par type</h2>
          <AdminTable
            columns={colonnesOptimisation}
            rows={d.optimisationsByType}
            getRowId={(r) => r.type}
            emptyState={
              <AdminEmptyState
                icon={<Lightbulb size={22} aria-hidden="true" />}
                title="Aucune optimisation identifiée"
                description="Chaque compte-rendu de séance peut en déclarer."
              />
            }
          />
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2">Gain de temps par métier</h2>
          <AdminTable
            columns={colonnesMetier}
            rows={d.gainByMetier}
            getRowId={(r) => r.slug}
            emptyState={
              <AdminEmptyState
                icon={<Timer size={22} aria-hidden="true" />}
                title="Aucun gain mesuré"
                description="Le gain se calcule à partir des optimisations retenues en séance."
              />
            }
          />
        </AdminCard>
      </div>

      <AdminCard>
        <h2 className="admin-h2">Conformité AFEST (séances réalisées)</h2>
        {d.afest.realisees === 0 ? (
          <AdminEmptyState
            icon={<CheckCheck size={22} aria-hidden="true" />}
            title="Aucune séance réalisée"
            description="Les taux de conformité AFEST se calculent sur les séances réalisées : cartographie d'activité, plan d'optimisation, et au moins un compte-rendu."
          />
        ) : (
          <>
            <div className="mt-[var(--space-admin-4)] grid grid-cols-2 gap-[var(--space-admin-4)] lg:grid-cols-4">
              <AdminStatCard
                label="Avec cartographie"
                value={pct(d.afest.avecCartographie, d.afest.realisees)}
              />
              <AdminStatCard label="Avec plan" value={pct(d.afest.avecPlan, d.afest.realisees)} />
              <AdminStatCard
                label="Avec compte-rendu"
                value={pct(d.afest.avecCompteRendu, d.afest.realisees)}
              />
              <AdminStatCard
                label="Dossier complet"
                value={pct(d.afest.completes, d.afest.realisees)}
                tone="success"
              />
            </div>
            <p className="admin-meta mt-[var(--space-admin-4)]">
              « Dossier complet » = cartographie d&apos;activité + plan d&apos;optimisation + au
              moins un compte-rendu (preuves AFEST), sur {d.afest.realisees} séance
              {d.afest.realisees > 1 ? "s" : ""} réalisée{d.afest.realisees > 1 ? "s" : ""}.
            </p>
          </>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
