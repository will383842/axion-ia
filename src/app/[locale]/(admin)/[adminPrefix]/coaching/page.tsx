// Coaching 1-to-1 — tableau de bord admin (gains de temps, optimisations,
// conformité AFEST). Vue transverse toutes séances / tous formateurs.

import Link from "next/link";
import { getCoachingDashboard } from "@/server/coaching-admin/queries";
import {
  coachingInterventionLabel,
  optimisationTypeLabel,
  sessionStatutLabel,
} from "@/server/formateur/coaching-options";

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)} %`;
}

function Kpi({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="border-border bg-cream rounded-lg border p-4">
      <div className="text-mocha text-2xl font-semibold">{value}</div>
      <div className="text-fg-muted text-xs">{label}</div>
    </div>
  );
}

export default async function CoachingDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const base = `/${locale}/${adminPrefix}/coaching`;
  const d = await getCoachingDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-mocha text-xl font-semibold">Coaching 1-to-1 — Tableau de bord</h1>
        <Link href={`${base}/seances`} className="text-terracotta text-sm hover:underline">
          Voir les séances →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Séances" value={String(d.totalSessions)} />
        <Kpi label="Optimisations identifiées" value={String(d.totalOptimisations)} />
        <Kpi label="Optimisations retenues" value={String(d.optimisationsRetenues)} />
        <Kpi label="Gain de temps cumulé (h/sem)" value={d.gainTempsHSemaineTotal.toFixed(1)} />
      </div>

      <section>
        <h2 className="text-mocha mb-2 text-sm font-semibold">Statut des séances</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(d.byStatut).map(([s, n]) => (
            <span key={s} className="border-border rounded border px-2 py-1">
              {sessionStatutLabel(s)} : <strong>{n}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-mocha mb-2 text-sm font-semibold">Optimisations par type</h2>
          <table className="w-full text-sm">
            <tbody>
              {d.optimisationsByType.map((t) => (
                <tr key={t.type} className="border-sand border-b">
                  <td className="py-1.5">{optimisationTypeLabel(t.type)}</td>
                  <td className="text-right font-medium">{t.count}</td>
                </tr>
              ))}
              {d.optimisationsByType.length === 0 ? (
                <tr>
                  <td className="text-fg-muted py-1.5">Aucune donnée</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-mocha mb-2 text-sm font-semibold">Gain de temps par métier</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-muted text-left text-xs">
                <th className="py-1">Prestation</th>
                <th className="text-right">Séances</th>
                <th className="text-right">Gain h/sem</th>
              </tr>
            </thead>
            <tbody>
              {d.gainByMetier.map((m) => (
                <tr key={m.slug} className="border-sand border-b">
                  <td className="py-1.5">{coachingInterventionLabel(m.slug)}</td>
                  <td className="text-right">{m.sessions}</td>
                  <td className="text-right font-medium">{m.gainH.toFixed(1)}</td>
                </tr>
              ))}
              {d.gainByMetier.length === 0 ? (
                <tr>
                  <td className="text-fg-muted py-1.5">Aucune donnée</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-mocha mb-2 text-sm font-semibold">
          Conformité AFEST (séances réalisées)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Avec cartographie" value={pct(d.afest.avecCartographie, d.afest.realisees)} />
          <Kpi label="Avec plan" value={pct(d.afest.avecPlan, d.afest.realisees)} />
          <Kpi label="Avec compte-rendu" value={pct(d.afest.avecCompteRendu, d.afest.realisees)} />
          <Kpi label="Dossier complet" value={pct(d.afest.completes, d.afest.realisees)} />
        </div>
        <p className="text-fg-muted mt-2 text-xs">
          « Dossier complet » = cartographie d&apos;activité + plan d&apos;optimisation + au moins
          un compte-rendu (preuves AFEST). {d.afest.realisees} séance(s) réalisée(s).
        </p>
      </section>
    </div>
  );
}
