/**
 * Admin — Qualiopi · Relevé d'honoraires · Pièces de PRÉSENTATION de la page de détail.
 *
 * Extraites de `[id]/page.tsx` pour être testables sans base de données : elles ne
 * reçoivent que des valeurs déjà lues, ne font aucune requête et ne portent aucune
 * action. Composants serveur, aucun JavaScript client.
 */

import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Banknote,
  CalendarClock,
  Calculator,
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  Lock,
  Pencil,
  Percent,
  Receipt,
  XCircle,
} from "lucide-react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import {
  euros,
  libelleAnomalie,
  LIBELLE_MODELE,
  LIBELLE_NATURE,
  LIBELLE_STATUT_LIGNE,
  LIBELLE_STATUT_RELEVE,
  libellePrestation,
  TON_STATUT_LIGNE,
  TON_STATUT_RELEVE,
} from "./_labels";

type StatutReleve = keyof typeof LIBELLE_STATUT_RELEVE;
type StatutLigne = keyof typeof LIBELLE_STATUT_LIGNE;
type Ton = "neutral" | "info" | "success" | "warning" | "destructive" | "outline";

const ICONE_STATUT_RELEVE: Record<StatutReleve, LucideIcon> = {
  brouillon: Pencil,
  a_valider: Clock,
  valide: CheckCircle2,
  facture_recue: Receipt,
  paye: Banknote,
  annule: XCircle,
};

const ICONE_STATUT_LIGNE: Record<StatutLigne, LucideIcon> = {
  previsionnel: Hourglass,
  calcule: Calculator,
  valide: Lock,
  annule: Ban,
};

/** Bordure gauche d'une carte, selon le ton de l'état. */
const BORDURE_GAUCHE: Record<Ton, string> = {
  neutral: "border-l-[color:var(--color-admin-neutral)]",
  info: "border-l-[color:var(--color-admin-info)]",
  success: "border-l-[color:var(--color-admin-success)]",
  warning: "border-l-[color:var(--color-admin-warning)]",
  destructive: "border-l-[color:var(--color-admin-destructive)]",
  outline: "border-l-[color:var(--color-admin-border-strong)]",
};

/** Pastille LARGE et pleine de l'état d'un relevé, avec son icône. */
export function PastilleStatutReleve({ statut }: { statut: StatutReleve }): React.ReactElement {
  const Icone = ICONE_STATUT_RELEVE[statut];
  return (
    <AdminBadge tone={TON_STATUT_RELEVE[statut]} compact={false} plein>
      <span className="inline-flex items-center gap-[var(--space-admin-2)]">
        <Icone size={16} aria-hidden />
        {LIBELLE_STATUT_RELEVE[statut]}
      </span>
    </AdminBadge>
  );
}

interface TuilesProps {
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  payeAt: Date | null;
  echeance: Date | null;
  retardJours: number | null;
  ecartFacture: boolean;
}

/** Chiffres clés du relevé : calculés sur les données déjà chargées. */
export function TuilesReleve(p: TuilesProps): React.ReactElement {
  let echeanceValeur = "—";
  let echeanceMeta = "Aucune échéance enregistrée";
  let echeanceTon: "default" | "success" | "warning" | "destructive" = "default";
  if (p.payeAt !== null) {
    echeanceValeur = "Payé";
    echeanceMeta = `le ${p.payeAt.toLocaleDateString("fr-FR")}`;
    echeanceTon = "success";
  } else if (p.echeance !== null && p.retardJours !== null) {
    echeanceValeur = `${p.retardJours} j de retard`;
    echeanceMeta = `Échéance le ${p.echeance.toLocaleDateString("fr-FR")}`;
    echeanceTon = "destructive";
  } else if (p.echeance !== null) {
    echeanceValeur = p.echeance.toLocaleDateString("fr-FR");
    echeanceMeta = "À régler avant cette date";
    echeanceTon = "warning";
  }

  return (
    <section
      aria-label="Chiffres clés"
      className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
    >
      <AdminStatCard label="Total HT" value={euros(p.totalHtCents)} icon={Banknote} />
      <AdminStatCard label="TVA" value={euros(p.tvaCents)} icon={Percent} />
      <AdminStatCard
        label="Total TTC"
        value={euros(p.totalTtcCents)}
        icon={Receipt}
        tone={p.ecartFacture ? "destructive" : "info"}
        {...(p.ecartFacture ? { meta: "Écart avec la facture reçue" } : {})}
      />
      <AdminStatCard
        label="Échéance"
        value={echeanceValeur}
        icon={CalendarClock}
        tone={echeanceTon}
        meta={echeanceMeta}
      />
    </section>
  );
}

export interface LigneReleve {
  id: string;
  prestationType: string;
  motif: string | null;
  model: keyof typeof LIBELLE_MODELE;
  nature: keyof typeof LIBELLE_NATURE;
  statut: StatutLigne;
  heures: number | string | null;
  montantHtCents: number;
  rattacheeAuReleve: boolean;
}

/** Une ligne du mois, en carte : état franc à gauche, montant à droite. */
export function CarteLigne({ ligne: l }: { ligne: LigneReleve }): React.ReactElement {
  const ton = TON_STATUT_LIGNE[l.statut];
  const Icone = ICONE_STATUT_LIGNE[l.statut];
  return (
    <li
      className={`flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] sm:flex-row sm:items-start sm:justify-between ${BORDURE_GAUCHE[ton]}`}
      data-statut={l.statut}
    >
      <div className="flex min-w-0 flex-col gap-[var(--space-admin-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <AdminBadge tone={ton} compact={false} plein>
            <span className="inline-flex items-center gap-[var(--space-admin-2)]">
              <Icone size={16} aria-hidden />
              {LIBELLE_STATUT_LIGNE[l.statut]}
            </span>
          </AdminBadge>
          <h4 className="m-0 text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            {libellePrestation(l.prestationType)}
          </h4>
        </div>
        <p className="m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {LIBELLE_MODELE[l.model]} · {LIBELLE_NATURE[l.nature]}
          {l.heures !== null && <> · {l.heures} h</>}
        </p>
        {l.motif !== null && (
          <p className="m-0 rounded-[var(--radius-admin-md)] border-l-4 border-l-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-3)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-destructive-fg)]">
            <span className="font-semibold">Anomalie : </span>
            {libelleAnomalie(l.motif)}
          </p>
        )}
      </div>
      <p className="m-0 text-[length:var(--text-admin-lg)] font-semibold whitespace-nowrap text-[color:var(--color-admin-fg)] tabular-nums sm:text-right">
        {euros(l.montantHtCents)}
        <span className="block text-[length:var(--text-admin-xs)] font-normal text-[color:var(--color-admin-fg-muted)]">
          HT
        </span>
      </p>
    </li>
  );
}

function GroupeLignes({
  titre,
  lignes,
}: {
  titre: string;
  lignes: readonly LigneReleve[];
}): React.ReactElement | null {
  if (lignes.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <h3 className="m-0 flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        <FileText size={16} aria-hidden />
        {titre} ({lignes.length})
      </h3>
      <ul className="m-0 flex list-none flex-col gap-[var(--space-admin-4)] p-0">
        {lignes.map((l) => (
          <CarteLigne key={l.id} ligne={l} />
        ))}
      </ul>
    </div>
  );
}

/** Toutes les lignes du mois, regroupées : comptées dans le total, puis les autres. */
export function LignesDuMois({ lignes }: { lignes: readonly LigneReleve[] }): React.ReactElement {
  if (lignes.length === 0) {
    return (
      <AdminEmptyState
        icon={<FileText size={28} aria-hidden />}
        title="Aucune ligne sur cette période"
        description="Ce relevé ne porte encore aucune ligne du formateur."
      />
    );
  }
  return (
    <div className="flex flex-col gap-[var(--space-admin-6)]">
      <GroupeLignes
        titre="Facturées (dans le total)"
        lignes={lignes.filter((l) => l.rattacheeAuReleve)}
      />
      <GroupeLignes
        titre="Non facturées (hors total)"
        lignes={lignes.filter((l) => !l.rattacheeAuReleve)}
      />
    </div>
  );
}

/** Message envoyé au formateur (désaccord non retenu) : toujours visible, jamais replié. */
export function MessageFormateurNonRetenu({
  paragraphes,
}: {
  paragraphes: string[];
}): React.ReactElement {
  return (
    <blockquote className="admin-muted m-0 border-l-2 pl-[var(--space-admin-4)]">
      <p className="admin-muted">Le formateur recevra ce message (F59) :</p>
      {paragraphes.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </blockquote>
  );
}
