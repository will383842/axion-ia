// Briques de PRÉSENTATION de la fiche d'une candidature : tuiles, cartes, encadrés.
// Composants serveur sans état ni requête : tout arrive déjà calculé par la page.

import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Check } from "lucide-react";
import { Clock } from "lucide-react";
import { Link2Off } from "lucide-react";
import { Archive, CalendarClock, Eye, Handshake, Inbox, ListChecks, LogOut } from "lucide-react";
import { ShieldAlert } from "lucide-react";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cn } from "@/lib/utils";
import { LIBELLE_STATUT, TON_STATUT } from "@/content/recrutement/statuts";
import type { JobApplicationStatus } from "../../../../../../../../prisma/generated/client";

type Ton = "success" | "warning" | "destructive" | "info" | "neutral";

export interface TuileCandidature {
  libelle: string;
  valeur: number;
  ton: "default" | "success" | "warning" | "info";
  icone: LucideIcon;
}

/** Chiffres clés : 2 colonnes sur mobile, 4 dès `sm`. */
export function TuilesCandidature({
  tuiles,
}: {
  tuiles: ReadonlyArray<TuileCandidature>;
}): React.ReactElement {
  return (
    <ul
      aria-label="Chiffres clés de la candidature"
      className="grid list-none grid-cols-2 gap-[var(--space-admin-4)] p-0 sm:grid-cols-4"
    >
      {tuiles.map((t) => (
        <li key={t.libelle}>
          <AdminStatCard label={t.libelle} value={t.valeur} tone={t.ton} icon={t.icone} />
        </li>
      ))}
    </ul>
  );
}

const BORDURE: Record<Ton, string> = {
  success: "border-l-[color:var(--color-admin-success)]",
  warning: "border-l-[color:var(--color-admin-warning)]",
  destructive: "border-l-[color:var(--color-admin-destructive)]",
  info: "border-l-[color:var(--color-admin-info)]",
  neutral: "border-l-[color:var(--color-admin-border-strong)]",
};

/** Carte de liste : bordure gauche colorée selon l'état, espacement généreux. */
export function CarteEtat({
  ton,
  children,
  className,
}: {
  ton: Ton;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-admin-lg)] border border-l-4 border-[color:var(--color-admin-border)]",
        "flex flex-col gap-[var(--space-admin-3)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]",
        BORDURE[ton],
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Les états que la page affiche réellement : ceux d'une vidéo déposée
 * (`analyse`, `disponible`, `rejetee`) et ceux d'un lien (`mort`, `vivant`).
 * Une valeur hors de cette liste ne compile pas : aucune valeur brute
 * d'énumération ne peut donc atteindre l'écran.
 */
export type EtatMedia = "disponible" | "analyse" | "rejetee" | "mort" | "vivant";

const ICONES_ETAT: Record<EtatMedia, { icone: LucideIcon; ton: Ton; libelle: string }> = {
  disponible: { icone: Check, ton: "success", libelle: "Disponible" },
  analyse: { icone: Clock, ton: "warning", libelle: "Analyse en cours" },
  rejetee: { icone: ShieldAlert, ton: "destructive", libelle: "Refusée" },
  mort: { icone: Link2Off, ton: "destructive", libelle: "Lien mort" },
  vivant: { icone: Check, ton: "success", libelle: "Lien vivant" },
};

export function tonDeEtat(etat: EtatMedia): Ton {
  return ICONES_ETAT[etat].ton;
}

/** Pastille d'état LARGE : icône + libellé, ton franc. */
export function PastilleEtat({ etat }: { etat: EtatMedia }): React.ReactElement {
  const d = ICONES_ETAT[etat];
  const Icone = d.icone;
  return (
    <AdminBadge tone={d.ton} compact={false} plein>
      <span className="inline-flex items-center gap-[var(--space-admin-2)]">
        <Icone size={16} aria-hidden="true" />
        {d.libelle}
      </span>
    </AdminBadge>
  );
}

const ICONES_STATUT: Record<JobApplicationStatus, LucideIcon> = {
  new: Inbox,
  reviewing: Eye,
  shortlisted: ListChecks,
  interview: CalendarClock,
  offer: Handshake,
  hired: Check,
  rejected: ShieldAlert,
  withdrawn: LogOut,
  archived: Archive,
};

/** Grande pastille de l'état de la candidature : libellé français, icône, ton franc. */
export function PastilleStatut({ statut }: { statut: JobApplicationStatus }): React.ReactElement {
  const Icone = ICONES_STATUT[statut];
  return (
    <AdminBadge tone={TON_STATUT[statut]} compact={false} plein>
      <span className="inline-flex items-center gap-[var(--space-admin-2)]">
        <Icone size={16} aria-hidden="true" />
        {LIBELLE_STATUT[statut]}
      </span>
    </AdminBadge>
  );
}

/** Encadré teinté lisible (motif, alerte, remarque) : pas d'italique grise. */
export function EncadreTeinte({
  ton = "info",
  titre,
  children,
}: {
  ton?: "info" | "warning" | "error";
  titre?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "admin-alert flex items-start gap-[var(--space-admin-3)] border-l-4 text-[length:var(--text-admin-base)]",
        `admin-alert-${ton}`,
      )}
    >
      <AlertTriangle size={18} aria-hidden="true" className="mt-[2px] shrink-0" />
      <div className="min-w-0">
        {titre ? <strong className="font-semibold">{titre} </strong> : null}
        {children}
      </div>
    </div>
  );
}
