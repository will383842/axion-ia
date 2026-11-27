/**
 * Hub Facturation — briques VISUELLES (présentation seulement).
 *
 * Composants serveur purs : ils reçoivent des valeurs déjà calculées et déjà
 * formatées par la page, sans requête ni logique métier. Le bouton « Encaisser »
 * (composant client existant) est passé en `action`, tel quel.
 */

import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Coins,
  FileText,
  Receipt,
  Send,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { cn } from "@/lib/utils";

type Ton = "neutral" | "info" | "success" | "warning" | "destructive";

export interface TuileFacturation {
  label: string;
  value: string;
  ton: "default" | "success" | "warning" | "destructive" | "info";
  meta?: string;
}

export function TuilesFacturation({
  tuiles,
}: {
  tuiles: ReadonlyArray<TuileFacturation>;
}): React.ReactElement {
  return (
    <ul
      aria-label="Chiffres clés"
      className="m-0 grid list-none grid-cols-1 gap-[var(--space-admin-4)] p-0 sm:grid-cols-2 lg:grid-cols-4"
    >
      {tuiles.map((t) => (
        <li key={t.label} className="m-0">
          <AdminStatCard
            label={t.label}
            value={t.value}
            tone={t.ton}
            {...(t.meta ? { meta: t.meta } : {})}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  );
}

const ETAT: Record<string, { ton: Ton; icone: LucideIcon; bordure: string }> = {
  brouillon: {
    ton: "neutral",
    icone: FileText,
    bordure: "border-l-[color:var(--color-admin-neutral)]",
  },
  emise: { ton: "info", icone: Send, bordure: "border-l-[color:var(--color-admin-info)]" },
  partiellement_payee: {
    ton: "warning",
    icone: Coins,
    bordure: "border-l-[color:var(--color-admin-warning)]",
  },
  en_retard: {
    ton: "destructive",
    icone: TriangleAlert,
    bordure: "border-l-[color:var(--color-admin-destructive)]",
  },
  payee: {
    ton: "success",
    icone: CheckCircle2,
    bordure: "border-l-[color:var(--color-admin-success)]",
  },
  annulee: { ton: "neutral", icone: Ban, bordure: "border-l-[color:var(--color-admin-neutral)]" },
};

export interface CarteFactureProps {
  id: string;
  numero: string;
  estAvoir: boolean;
  statut: string;
  statutLibelle: string;
  activite: string | null;
  client: string;
  chorusPro: boolean;
  refClient: string | null;
  montant: string;
  canal: string;
  emise: string;
  echeance: string;
  detailHref: string;
  /** Bouton « Encaisser » (composant client existant), ou rien. */
  action?: React.ReactNode;
}

export function CarteFacture(p: CarteFactureProps): React.ReactElement {
  const etat = ETAT[p.statut] ?? ETAT["brouillon"]!;
  const Icone = etat.icone;
  return (
    <li
      data-statut={p.statut}
      className={cn(
        "m-0 flex flex-col gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)]",
        "border border-l-4 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]",
        "p-[var(--space-admin-5)] shadow-[var(--shadow-admin-1)]",
        etat.bordure,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--space-admin-2)]">
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <AdminBadge tone={etat.ton} plein compact={false}>
              <span className="inline-flex items-center gap-[var(--space-admin-2)]">
                <Icone size={16} aria-hidden="true" className="shrink-0" />
                {p.statutLibelle}
              </span>
            </AdminBadge>
            <span className="font-mono text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
              {p.numero}
              {p.estAvoir ? " (avoir)" : ""}
            </span>
          </div>
          <p className="m-0 text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            {p.client}
            {p.chorusPro ? (
              <span
                className="ml-[var(--space-admin-2)] align-middle"
                title="Client secteur public — dépôt Chorus Pro obligatoire"
              >
                <AdminBadge tone="outline">Chorus Pro</AdminBadge>
              </span>
            ) : null}
          </p>
        </div>
        <p className="m-0 text-right text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          {p.montant}
          <span className="block text-[length:var(--text-admin-xs)] font-normal text-[color:var(--color-admin-fg-muted)]">
            TTC
          </span>
        </p>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Activité", p.activite ?? "—"],
          ["Réf. commande", p.refClient ?? "—"],
          ["Canal 2026", p.canal],
          ["Émise", p.emise],
          ["Échéance", p.echeance],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[color:var(--color-admin-fg-muted)]">{k}</dt>
            <dd className="m-0 text-[color:var(--color-admin-fg)]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <AdminButton href={p.detailHref} variant="secondary" iconAfter={ArrowRight}>
          Détail
        </AdminButton>
        {p.action ?? null}
      </div>
    </li>
  );
}

export function ListeFactures({
  cartes,
  titreVide,
  descriptionVide,
}: {
  cartes: ReadonlyArray<CarteFactureProps>;
  titreVide: string;
  descriptionVide: string;
}): React.ReactElement {
  if (cartes.length === 0) {
    return (
      <AdminEmptyState
        icon={<Receipt size={22} />}
        title={titreVide}
        description={descriptionVide}
      />
    );
  }
  return (
    <ul
      aria-label="Factures"
      className="m-0 flex list-none flex-col gap-[var(--space-admin-4)] p-0"
    >
      {cartes.map(({ action, ...c }) => (
        <CarteFacture key={c.id} {...c} {...(action !== undefined ? { action } : {})} />
      ))}
    </ul>
  );
}
