// Tableau de bord de pilotage — section 5 : formateurs.
//
// Effectif actif par statut (salarié / sous-traitant / dirigeant), top 5 des
// heures animées de l'année (barres CSS + coût), et signaux de vigilance du hub
// (mois courant) limités aux codes formateur.

import Link from "next/link";
import { Users } from "lucide-react";
import { AdminCard, AdminBadge } from "@/components/admin/ui";
import type { FormateursBloc } from "@/server/admin/pilotage-dashboard";
import { fmtEurosCents, largeurPct } from "./format";

interface Props {
  adminPrefix: string;
  formateurs: FormateursBloc;
}

const LABELS_STATUT_FORMATEUR: Record<string, string> = {
  salarie: "Salariés",
  sous_traitant: "Sous-traitants",
  dirigeant: "Dirigeant-formateur",
};

export function FormateursSection({ adminPrefix, formateurs }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const maxHeures = Math.max(1, ...formateurs.top.map((t) => t.heuresAnimees));
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]"
            style={{
              background: "var(--color-admin-id-violet-soft)",
              color: "var(--color-admin-id-violet)",
            }}
          >
            <Users size={16} />
          </span>
          Formateurs
        </h2>
        <Link href={`${base}/qualiopi/formateurs`} className="admin-button-ghost">
          Gérer les formateurs →
        </Link>
      </div>

      <dl className="mb-[var(--space-admin-5)] flex flex-wrap gap-x-[var(--space-admin-6)] gap-y-[var(--space-admin-2)]">
        <div className="flex items-baseline gap-[var(--space-admin-2)]">
          <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Actifs
          </dt>
          <dd className="text-[length:var(--text-admin-sm)] font-semibold tabular-nums">
            {formateurs.totalActifs}
          </dd>
        </div>
        {formateurs.parStatut.map((s) => (
          <div key={s.statut} className="flex items-baseline gap-[var(--space-admin-2)]">
            <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {LABELS_STATUT_FORMATEUR[s.statut] ?? s.statut}
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] font-semibold tabular-nums">{s.n}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Top 5 — heures animées (année en cours)
      </h3>
      {formateurs.top.length === 0 ? (
        <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune session réalisée cette année pour l&apos;instant.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-3)]">
          {formateurs.top.map((t) => (
            <div key={t.trainerId} className="flex items-center gap-[var(--space-admin-4)]">
              <span className="w-[160px] shrink-0 truncate text-[length:var(--text-admin-sm)] font-medium">
                {t.trainerNom}
              </span>
              <div
                className="h-[10px] flex-1 overflow-hidden rounded-full bg-[color:var(--color-admin-accent-track)]"
                role="img"
                aria-label={`${t.heuresAnimees} heures animées`}
              >
                <div
                  className="h-full rounded-full bg-[color:var(--color-admin-accent)]"
                  style={{ width: `${largeurPct(t.heuresAnimees, maxHeures)}%` }}
                />
              </div>
              <span className="w-[52px] shrink-0 text-right text-[length:var(--text-admin-xs)] font-semibold tabular-nums">
                {t.heuresAnimees} h
              </span>
              <span className="w-[100px] shrink-0 text-right text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
                {fmtEurosCents(t.coutFormateurCents)}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Vigilance
      </h3>
      {formateurs.signaux.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
          Aucun signal de vigilance formateur ce mois-ci.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {formateurs.signaux.map((s) => (
            <li key={s.code} className="flex flex-col gap-[var(--space-admin-1)]">
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <AdminBadge tone={s.niveau === "critique" ? "destructive" : "warning"} dot>
                  {s.niveau === "critique" ? "Critique" : "Attention"}
                </AdminBadge>
                <strong className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {s.titre}
                </strong>
              </div>
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                {s.explication}
              </p>
              <ul className="flex flex-wrap gap-x-[var(--space-admin-5)] gap-y-[var(--space-admin-1)]">
                {s.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="admin-button-ghost">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
