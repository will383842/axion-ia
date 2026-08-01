// Tableau de bord de pilotage — section 7 : pipeline commercial.
//
// Six mini-tuiles (une par colonne du pipeline dossiers, labels du SSOT
// `COLONNES_PIPELINE`) + répartition par activité en trois barres CSS. Les
// lectures du pipeline sont plafonnées à 200 lignes/source : une colonne au
// plafond s'affiche « 200+ », jamais un compte faussement exact.

import Link from "next/link";
import { AdminCard } from "@/components/admin/ui";
import type { PipelineBloc } from "@/server/admin/pilotage-dashboard";
import { largeurPct } from "./format";

interface Props {
  adminPrefix: string;
  pipeline: PipelineBloc;
}

export function PipelineSection({ adminPrefix, pipeline }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const maxActivite = Math.max(1, ...pipeline.parActivite.map((a) => a.n));
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Pipeline commercial
        </h2>
        <Link
          href={`${base}/qualiopi/dossiers`}
          className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
        >
          Ouvrir les dossiers →
        </Link>
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-3 xl:grid-cols-6">
        {pipeline.colonnes.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-[var(--space-admin-1)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
            title={c.description}
          >
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {c.label}
            </span>
            <span className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)] tabular-nums">
              {c.affichage}
            </span>
          </div>
        ))}
      </div>

      <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
        Répartition par activité
      </h3>
      <div className="flex flex-col gap-[var(--space-admin-3)]">
        {pipeline.parActivite.map((a) => (
          <div key={a.activite} className="flex items-center gap-[var(--space-admin-4)]">
            <span className="w-[120px] shrink-0 text-[length:var(--text-admin-sm)] font-medium">
              {a.label}
            </span>
            <div
              className="h-[10px] flex-1 overflow-hidden rounded-full bg-[color:var(--color-admin-surface-hover)]"
              role="img"
              aria-label={`${a.n} dossier(s) — ${a.label}`}
            >
              <div
                className="h-full rounded-full bg-[color:var(--color-admin-info)]"
                style={{ width: `${largeurPct(a.n, maxActivite)}%` }}
              />
            </div>
            <span className="w-[40px] shrink-0 text-right text-[length:var(--text-admin-sm)] font-semibold tabular-nums">
              {a.n}
            </span>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
