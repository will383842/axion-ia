// Tableau de bord de pilotage — section 7 : pipeline commercial.
//
// Refonte 2026-08-02 : six tuiles bordées posées côte à côte ne disaient pas
// qu'il s'agissait d'un FLUX. L'entonnoir se lit maintenant de gauche à
// droite : chaque étape porte son compte, une jauge proportionnelle au volume
// (accent de la charte — le bleu du site public lisait comme étranger), et un
// chevron conduit à l'étape suivante. Chaque étape est cliquable.
//
// Les lectures restent plafonnées à 200 lignes/source : une colonne au plafond
// s'affiche « 200+ », jamais un compte faussement exact.

import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import { AdminCard } from "@/components/admin/ui";
import { BarreRepartition } from "@/components/admin/ui/charts";
import type { PipelineBloc } from "@/server/admin/pilotage-dashboard";

interface Props {
  adminPrefix: string;
  pipeline: PipelineBloc;
}

export function PipelineSection({ adminPrefix, pipeline }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const maxColonne = Math.max(1, ...pipeline.colonnes.map((c) => c.n));
  const maxActivite = Math.max(1, ...pipeline.parActivite.map((a) => a.n));

  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-5)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]"
            style={{
              background: "var(--color-admin-id-terracotta-soft)",
              color: "var(--color-admin-id-terracotta)",
            }}
          >
            <TrendingUp size={16} />
          </span>
          Pipeline commercial
        </h2>
        <Link href={`${base}/qualiopi/dossiers`} className="admin-button-ghost">
          Ouvrir les dossiers
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <ol className="mb-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-2)] sm:flex-row sm:items-stretch">
        {pipeline.colonnes.map((c, i) => (
          <li key={c.id} className="flex min-w-0 flex-1 items-stretch gap-[var(--space-admin-2)]">
            <Link
              href={`${base}/qualiopi/dossiers`}
              title={c.description}
              className="flex min-w-0 flex-1 flex-col gap-[var(--space-admin-1)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-4)] transition-colors hover:border-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:outline-none"
            >
              <span className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)]">
                {c.affichage}
              </span>
              <span className="truncate text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {c.label}
              </span>
              {/* Jauge de volume — piste dans le même ton éclairci, jamais un
                  gris étranger : l'état se lit sur toute la longueur. */}
              <span
                aria-hidden="true"
                className="mt-[var(--space-admin-1)] block h-[4px] overflow-hidden rounded-[var(--radius-admin-pill)]"
                style={{
                  background: "var(--color-admin-accent-track)",
                }}
              >
                <span
                  className="block h-full rounded-[var(--radius-admin-pill)]"
                  style={{
                    width: `${Math.round((c.n / maxColonne) * 100)}%`,
                    background: "var(--color-admin-accent)",
                  }}
                />
              </span>
            </Link>
            {i < pipeline.colonnes.length - 1 ? (
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="hidden shrink-0 self-center text-[color:var(--color-admin-fg-disabled)] sm:block"
              />
            ) : null}
          </li>
        ))}
      </ol>

      <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
        Répartition par activité
      </h3>
      <div className="flex flex-col gap-[var(--space-admin-3)]">
        {pipeline.parActivite.map((a) => (
          <BarreRepartition key={a.activite} label={a.label} value={a.n} max={maxActivite} />
        ))}
      </div>
    </AdminCard>
  );
}
