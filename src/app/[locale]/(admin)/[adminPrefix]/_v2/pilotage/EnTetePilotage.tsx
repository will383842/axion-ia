// Tableau de bord de pilotage — section 1 : sélecteur de période + 5 tuiles.
//
// Server Component pur. Le sélecteur est une rangée de LIENS (querystring
// `?periode=`) rendus comme des onglets — zéro JS client, zéro graphique ici.

import Link from "next/link";
import { FolderOpen, Receipt, AlertTriangle, TrendingUp, PiggyBank, Target } from "lucide-react";
import { AdminStatCard } from "@/components/admin/ui";
import {
  PERIODES_PILOTAGE,
  type ObjectifBloc,
  type PeriodePilotage,
  type TuilesPilotage,
} from "@/server/admin/pilotage-dashboard";
import { fmtEurosCents } from "./format";

interface Props {
  adminPrefix: string;
  periode: PeriodePilotage;
  periodeLabel: string;
  tuiles: TuilesPilotage;
  objectif: ObjectifBloc;
}

export function EnTetePilotage({
  adminPrefix,
  periode,
  periodeLabel,
  tuiles,
  objectif,
}: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  // 6ᵉ tuile « Objectif annuel » seulement si une cible est définie —
  // aucune tuile vide sinon (la grille reste alors sur 5 colonnes).
  const avecObjectif = objectif.cibleAnnuelleCents !== null;
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

      <div
        className={[
          "grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2",
          avecObjectif ? "xl:grid-cols-3" : "xl:grid-cols-5",
        ].join(" ")}
      >
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
          meta="Formations + audits réalisés + contrats coaching signés · vs N-1"
        />
        <AdminStatCard
          label="Marge du mois en cours"
          value={fmtEurosCents(tuiles.margeMoisCents)}
          icon={PiggyBank}
          tone={tuiles.margeMoisCents < 0 ? "destructive" : "default"}
          href={`${base}/qualiopi/cockpit-financier`}
          meta="Sessions réalisées uniquement"
        />
        {avecObjectif && objectif.cibleAnnuelleCents !== null ? (
          <AdminStatCard
            label="Objectif annuel"
            value={objectif.pctAtteint !== null ? `${objectif.pctAtteint} %` : "—"}
            icon={Target}
            tone={objectif.pctAtteint !== null && objectif.pctAtteint >= 100 ? "success" : "info"}
            meta={`de la cible · réalisé ${fmtEurosCents(objectif.realiseAnnuelCents)} / cible ${fmtEurosCents(objectif.cibleAnnuelleCents)}`}
          />
        ) : null}
      </div>
    </section>
  );
}
