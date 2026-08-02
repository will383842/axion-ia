// Tableau de bord de pilotage — section 1 : sélecteur de période + 5 tuiles.
//
// Server Component pur. Le sélecteur est le sélecteur segmenté standard de la
// console (`AdminFilterTabs`, liens `?periode=`) — les gros boutons pleins
// faisaient concurrence aux vraies actions. Les tuiles CA et marge portent la
// tendance mensuelle de l'année en micro-courbe SVG serveur : un chiffre seul
// ne dit pas s'il monte ou s'il tombe.
//
// Grille : 2 → 3 → 5 colonnes. Le palier intermédiaire manquait — entre
// 1024 et ~1500 px de fenêtre, cinq tuiles en `grid-cols-2` laissaient une
// orpheline sur sa ligne face à un vide (vu en production le 2026-08-02).

import { FolderOpen, Receipt, AlertTriangle, TrendingUp, PiggyBank } from "lucide-react";
import { AdminStatCard, AdminFilterTabs } from "@/components/admin/ui";
import {
  PERIODES_PILOTAGE,
  type PeriodePilotage,
  type TuilesPilotage,
} from "@/server/admin/pilotage-dashboard";
import { fmtEurosCents } from "./format";

const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

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

  // La tendance s'arrête au mois courant : les mois à venir valent zéro par
  // construction et dessineraient une fausse chute en fin de courbe.
  const moisCourant = new Date().getMonth(); // base 0
  const caTendance = tuiles.caParMoisCents.slice(0, moisCourant + 1);
  const margeTendance = tuiles.margeParMoisCents.slice(0, moisCourant + 1);
  const labelsCa = caTendance.map((v, i) => `${MOIS_COURTS[i] ?? ""} : ${fmtEurosCents(v)}`);
  const labelsMarge = margeTendance.map((v, i) => `${MOIS_COURTS[i] ?? ""} : ${fmtEurosCents(v)}`);

  return (
    <section aria-label="Pilotage" className="mb-[var(--space-admin-7)]">
      <div className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <AdminFilterTabs
          options={PERIODES_PILOTAGE.map((p) => ({
            value: p.id,
            label: p.label,
            href: p.id === "mois" ? base : `${base}?periode=${p.id}`,
          }))}
          current={periode}
        />
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {periodeLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] min-[1500px]:grid-cols-5 sm:grid-cols-2 lg:grid-cols-3">
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
          trend={caTendance}
          trendLabels={labelsCa}
        />
        <AdminStatCard
          label="Marge du mois en cours"
          value={fmtEurosCents(tuiles.margeMoisCents)}
          icon={PiggyBank}
          tone={tuiles.margeMoisCents < 0 ? "destructive" : "default"}
          href={`${base}/qualiopi/cockpit-financier`}
          meta="Sessions réalisées uniquement"
          trend={margeTendance}
          trendLabels={labelsMarge}
        />
      </div>
    </section>
  );
}
