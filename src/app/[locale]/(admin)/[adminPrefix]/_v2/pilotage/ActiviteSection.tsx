// Tableau de bord de pilotage — section 4 : activité par famille de prestation.
//
// Pour chaque activité (Formations / Coachings / Audits) : comptes par statut
// sur la période choisie, taux de réalisation, et tendance 12 mois glissants en
// barres CSS pures (prestations réalisées par mois).

import { Activity } from "lucide-react";
import { AdminCard } from "@/components/admin/ui";
import { BarresMensuelles } from "@/components/admin/ui/charts";
import type { ActiviteBloc } from "@/server/admin/pilotage-dashboard";
import { labelMoisCle } from "./format";

interface Props {
  activites: ActiviteBloc[];
  periodeLabel: string;
}

function BlocActivite({ bloc }: { bloc: ActiviteBloc }): React.ReactElement {
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
        {/* Forme « emphase » : le mois courant (dernier de la fenêtre) porte
            l'accent, le passé est en teinte discrète — le regard va au présent. */}
        <BarresMensuelles
          barres={bloc.tendance.map((t, i) => ({
            label: labelMoisCle(t.mois).slice(0, 1),
            value: t.n,
            title: `${labelMoisCle(t.mois)} : ${t.n}`,
            courant: i === bloc.tendance.length - 1,
          }))}
        />
      </div>
    </div>
  );
}

export function ActiviteSection({ activites, periodeLabel }: Props): React.ReactElement {
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <h2 className="mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]"
          style={{
            background: "var(--color-admin-id-teal-soft)",
            color: "var(--color-admin-id-teal)",
          }}
        >
          <Activity size={16} />
        </span>
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
