// Tableau de bord de pilotage — section 4 : activité par famille de prestation.
//
// Pour chaque activité (Formations / Coachings / Audits) : comptes par statut
// sur la période choisie, taux de réalisation, et tendance 12 mois glissants en
// barres CSS pures (prestations réalisées par mois).

import { AdminCard } from "@/components/admin/ui";
import type { ActiviteBloc } from "@/server/admin/pilotage-dashboard";
import { labelMoisCle } from "./format";

interface Props {
  activites: ActiviteBloc[];
  periodeLabel: string;
}

function BlocActivite({ bloc }: { bloc: ActiviteBloc }): React.ReactElement {
  const maxTendance = Math.max(1, ...bloc.tendance.map((t) => t.n));
  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      <div className="flex items-baseline justify-between gap-[var(--space-admin-3)]">
        <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          {bloc.label}
        </h3>
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {bloc.tauxRealisationPct !== null
            ? `Taux de réalisation : ${bloc.tauxRealisationPct} %`
            : "Taux de réalisation : —"}
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-[var(--space-admin-6)] gap-y-[var(--space-admin-2)]">
        {bloc.counts.map((c) => (
          <div key={c.statut} className="flex items-baseline gap-[var(--space-admin-2)]">
            <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {c.label}
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)] tabular-nums">
              {c.n}
            </dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Réalisées par mois (12 derniers mois)
        </p>
        <div
          className="flex h-[56px] items-end gap-[3px]"
          role="img"
          aria-label={`Tendance 12 mois — ${bloc.label.toLowerCase()} réalisées par mois`}
        >
          {bloc.tendance.map((t) => (
            <div
              key={t.mois}
              className="flex flex-1 flex-col items-center gap-[2px]"
              title={`${labelMoisCle(t.mois)} : ${t.n}`}
            >
              <div
                className="w-full rounded-t-[2px] bg-[color:var(--color-admin-info)]"
                style={{
                  height: `${Math.max(t.n > 0 ? 8 : 2, Math.round((t.n / maxTendance) * 44))}px`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-[2px] flex justify-between text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <span>{labelMoisCle(bloc.tendance[0]?.mois ?? "")}</span>
          <span>{labelMoisCle(bloc.tendance[bloc.tendance.length - 1]?.mois ?? "")}</span>
        </div>
      </div>
    </div>
  );
}

export function ActiviteSection({ activites, periodeLabel }: Props): React.ReactElement {
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Activité
      </h2>
      <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Comptes par statut sur la période ({periodeLabel}). Taux de réalisation = réalisées /
        (réalisées + annulées + reportées).
      </p>
      <div className="grid grid-cols-1 gap-[var(--space-admin-7)] lg:grid-cols-3">
        {activites.map((bloc) => (
          <BlocActivite key={bloc.activite} bloc={bloc} />
        ))}
      </div>
    </AdminCard>
  );
}
