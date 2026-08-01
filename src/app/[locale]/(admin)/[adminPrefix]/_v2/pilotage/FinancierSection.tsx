// Tableau de bord de pilotage — section 6 : financier.
//
// Année en cours : totaux du prévisionnel (CA planifié / réalisé / encaissements
// attendus / impayés — deux périmètres jamais additionnés), marge top 3 / flop 3
// par formation, dossiers de financement en retard, devis sans réponse.

import Link from "next/link";
import { AdminCard, AdminBadge } from "@/components/admin/ui";
import type { FinancierBloc } from "@/server/admin/pilotage-dashboard";
import { fmtDate, fmtEurosCents } from "./format";

interface Props {
  adminPrefix: string;
  financier: FinancierBloc;
}

function LigneMarge({
  titre,
  caHtCents,
  margeCents,
  tauxMargePct,
  nbSessions,
}: {
  titre: string;
  caHtCents: number;
  margeCents: number;
  tauxMargePct: number | null;
  nbSessions: number;
}): React.ReactElement {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
      <span className="min-w-0 flex-1 truncate text-[length:var(--text-admin-sm)] font-medium">
        {titre}
      </span>
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
        {nbSessions} session(s) · CA {fmtEurosCents(caHtCents)}
      </span>
      <AdminBadge tone={margeCents < 0 ? "destructive" : "success"}>
        {fmtEurosCents(margeCents)}
        {tauxMargePct !== null ? ` · ${tauxMargePct} %` : ""}
      </AdminBadge>
    </li>
  );
}

export function FinancierSection({ adminPrefix, financier }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const t = financier.totauxAnnee;
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Financier — année {financier.annee}
        </h2>
        <Link
          href={`${base}/qualiopi/cockpit-financier`}
          className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
        >
          Cockpit financier →
        </Link>
      </div>

      <dl className="mb-[var(--space-admin-3)] grid grid-cols-2 gap-[var(--space-admin-4)] lg:grid-cols-4">
        {[
          { label: "CA planifié", cents: t.caPlanifieCents },
          { label: "CA réalisé", cents: t.caRealiseCents },
          { label: "Encaissements attendus", cents: t.encaissementsAttendusCents },
          { label: "Impayés", cents: t.impayesCents },
        ].map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-[var(--space-admin-1)]">
            <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {kpi.label}
            </dt>
            <dd
              className={[
                "text-[length:var(--text-admin-lg)] font-semibold tabular-nums",
                kpi.label === "Impayés" && kpi.cents > 0
                  ? "text-[color:var(--color-admin-destructive)]"
                  : "text-[color:var(--color-admin-fg)]",
              ].join(" ")}
            >
              {fmtEurosCents(kpi.cents)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        CA coaching non inclus (porté par les contrats) — limite assumée de cette vue.
      </p>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        <div>
          <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Marge — top 3 formations
          </h3>
          {financier.topFormations.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucune session réalisée cette année.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-3)]">
              {financier.topFormations.map((f) => (
                <LigneMarge
                  key={f.formationId}
                  titre={f.formationTitre}
                  caHtCents={f.caHtCents}
                  margeCents={f.margeCents}
                  tauxMargePct={f.tauxMargePct}
                  nbSessions={f.nbSessions}
                />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Marge — 3 formations les moins rentables
          </h3>
          {financier.flopFormations.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Moins de quatre formations en marge cette année — voir le top 3 ci-contre.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-3)]">
              {financier.flopFormations.map((f) => (
                <LigneMarge
                  key={f.formationId}
                  titre={f.formationTitre}
                  caHtCents={f.caHtCents}
                  margeCents={f.margeCents}
                  tauxMargePct={f.tauxMargePct}
                  nbSessions={f.nbSessions}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        <div>
          <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Dossiers de financement en retard
          </h3>
          {financier.dossiersEnRetard.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
              Aucun dossier en retard.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-2)]">
              {financier.dossiersEnRetard.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                  <AdminBadge tone={d.motif === "paiement_retard" ? "destructive" : "warning"}>
                    {d.motif === "paiement_retard" ? "Paiement en retard" : "Sans réponse +30 j"}
                  </AdminBadge>
                  <Link
                    href={`${base}/qualiopi/financements`}
                    className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
                  >
                    {d.libelle}
                  </Link>
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {d.motif === "paiement_retard" ? "attendu le" : "envoyé le"} {fmtDate(d.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Devis sans réponse (+30 jours)
          </h3>
          {financier.nbDevisSansReponse === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
              Aucun devis en attente depuis plus de 30 jours.
            </p>
          ) : (
            <>
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                {financier.nbDevisSansReponse} devis à relancer ou à statuer :
              </p>
              <ul className="flex flex-col gap-[var(--space-admin-2)]">
                {financier.devisSansReponse.map((d) => (
                  <li key={d.id} className="text-[length:var(--text-admin-sm)]">
                    <Link
                      href={`${base}/qualiopi/devis/${d.id}`}
                      className="font-medium text-[color:var(--color-admin-info)] hover:underline"
                    >
                      {d.numero}
                    </Link>{" "}
                    <span className="text-[color:var(--color-admin-fg-soft)]">
                      {d.client} — envoyé le {fmtDate(d.sentAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </AdminCard>
  );
}
