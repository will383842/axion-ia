// Tableau de bord de pilotage — section 1 : sélecteur de période + 5 tuiles.
//
// Server Component pur. Le sélecteur est une rangée de LIENS (querystring
// `?periode=`) rendus comme des onglets — zéro JS client, zéro graphique ici.

import Link from "next/link";
import { FolderOpen, Receipt, AlertTriangle, TrendingUp, PiggyBank } from "lucide-react";
import { AdminStatCard } from "@/components/admin/ui";
import {
  PERIODES_PILOTAGE,
  type PeriodePilotage,
  type TuilesPilotage,
} from "@/server/admin/pilotage-dashboard";
import { fmtEurosCents } from "./format";

interface Props {
  adminPrefix: string;
  periode: PeriodePilotage;
  periodeLabel: string;
  tuiles: TuilesPilotage;
}

export function EnTetePilotage({
  adminPrefix,
  periode,
  periodeLabel,
  tuiles,
}: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <section aria-label="Pilotage" className="mb-[var(--space-admin-7)]">
      <div className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-2">
        {PERIODES_PILOTAGE.map((p) => (
          <Link
            key={p.id}
            href={p.id === "mois" ? base : `${base}?periode=${p.id}`}
            className={p.id === periode ? "admin-button" : "admin-button-ghost"}
            aria-current={p.id === periode ? "page" : undefined}
          >
            {p.label}
          </Link>
        ))}
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {periodeLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          label="Dossiers actifs"
          value={tuiles.dossiersActifs}
          icon={FolderOpen}
          href={`${base}/qualiopi/dossiers`}
          meta="À préparer, en cours, signature en attente"
        />
        <AdminStatCard
          label="À solder / impayés"
          value={tuiles.aSolder}
          icon={Receipt}
          tone={tuiles.aSolder !== "0" ? "warning" : "default"}
          href={`${base}/qualiopi/dossiers`}
          meta="Réalisés mais pas payés"
        />
        <AdminStatCard
          label="Alertes critiques"
          value={tuiles.alertesCritiques}
          icon={AlertTriangle}
          tone={tuiles.alertesCritiques > 0 ? "destructive" : "success"}
          href={`${base}/qualiopi/alertes`}
          meta="Non résolues"
        />
        <AdminStatCard
          label="CA réalisé (période)"
          value={fmtEurosCents(tuiles.caRealiseCents)}
          icon={TrendingUp}
          {...(tuiles.caDelta !== null ? { delta: tuiles.caDelta } : {})}
          meta="Formations + audits · vs même période N-1"
        />
        <AdminStatCard
          label="Marge du mois en cours"
          value={fmtEurosCents(tuiles.margeMoisCents)}
          icon={PiggyBank}
          tone={tuiles.margeMoisCents < 0 ? "destructive" : "default"}
          href={`${base}/qualiopi/cockpit-financier`}
          meta="Sessions réalisées uniquement"
        />
      </div>
    </section>
  );
}
