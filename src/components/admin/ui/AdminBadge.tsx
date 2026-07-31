// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 duplications #2/#10).
//
// Badge admin (vs <Badge> public éditorial). Compact, uppercase tracking.
// Variant générique + variant status spécialisé par enum métier.

import { cn } from "@/lib/utils";

type AdminBadgeTone = "neutral" | "info" | "success" | "warning" | "destructive" | "outline";

interface AdminBadgeProps {
  children: React.ReactNode;
  tone?: AdminBadgeTone;
  /** Affichage compact (default true admin). */
  compact?: boolean;
  /** Point de statut coloré (couleur = ton du badge) avant le libellé — style « produit ». */
  dot?: boolean;
  /** Anime le point (statuts en cours : processing/running/queued…). */
  pulse?: boolean;
  className?: string;
}

const TONE_CLASS: Record<AdminBadgeTone, string> = {
  neutral: "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-neutral)]",
  info: "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]",
  success: "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
  warning: "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
  destructive:
    "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
  outline:
    "bg-transparent border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)]",
};

export function AdminBadge({
  children,
  tone = "neutral",
  compact = true,
  dot = false,
  pulse = false,
  className,
}: AdminBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "admin-badge-v2 inline-flex items-center gap-[var(--space-admin-2)] rounded-full font-semibold tracking-wide uppercase",
        compact
          ? "px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]"
          : "px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-[6px] w-[6px] shrink-0 rounded-full bg-current",
            pulse && "motion-safe:animate-pulse",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

// ─── AdminStatusBadge ────────────────────────────────────────────────────

type StatusType =
  "booking" | "invoice" | "quote" | "job" | "publication" | "user-role" | "image-asset" | "review";

interface AdminStatusBadgeProps {
  status: string;
  type: StatusType;
  /** Override label (sinon dérivé du status). */
  label?: string;
  className?: string;
}

/**
 * Map status enum → tone visuel. Couvre les enums Prisma principaux.
 * Pour un status inconnu, retourne "neutral" (sûr par défaut).
 */
function statusToTone(type: StatusType, status: string): AdminBadgeTone {
  const s = status.toLowerCase();
  // success / completed / paid / published
  if (/(^|_)(completed|paid|published|approved|confirmed|success|active|valid)(_|$)/.test(s))
    return "success";
  // warning / pending / processing / draft / queued
  if (
    /(^|_)(pending|processing|queued|draft|review|needs_review|in_progress|awaiting)(_|$)/.test(s)
  )
    return "warning";
  // destructive / failed / cancelled / refused / expired / overdue
  if (
    /(^|_)(failed|cancelled|canceled|refused|rejected|expired|overdue|suspended|error)(_|$)/.test(s)
  )
    return "destructive";
  // info / new / open / scheduled
  if (/(^|_)(new|open|scheduled|info|submitted|ready)(_|$)/.test(s)) return "info";
  // roles
  if (type === "user-role") {
    if (s === "super_admin" || s === "admin") return "info";
    if (s === "editor" || s === "reader") return "neutral";
  }
  return "neutral";
}

/**
 * Libellés FR par défaut pour les valeurs d'enum de statut affichées en badge.
 * Console admin = 100 % français : on traduit les statuts Prisma rendus tels
 * quels. Statut inconnu → fallback `replace(/_/g, " ")` (sûr, jamais d'erreur).
 * Une prop `label` explicite a toujours la priorité sur cette table.
 */
const STATUS_LABELS_FR: Record<string, string> = {
  // génériques / pipeline
  pending: "En attente",
  awaiting: "En attente",
  processing: "En traitement",
  queued: "En file",
  running: "En cours",
  in_progress: "En cours",
  publishing: "Publication…",
  published: "Publié",
  draft: "Brouillon",
  active: "Actif",
  inactive: "Inactif",
  completed: "Terminé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  canceled: "Annulé",
  failed: "Échec",
  error: "Erreur",
  expired: "Expiré",
  overdue: "En retard",
  suspended: "Suspendu",
  refused: "Refusé",
  rejected: "Rejeté",
  approved: "Approuvé",
  accepted: "Accepté",
  sent: "Envoyé",
  paid: "Payé",
  unpaid: "Impayé",
  refunded: "Remboursé",
  archived: "Archivé",
  scheduled: "Planifié",
  open: "Ouvert",
  closed: "Fermé",
  new: "Nouveau",
  submitted: "Soumis",
  ready: "Prêt",
  valid: "Valide",
  no_show: "Absent",
  review: "À relire",
  needs_review: "À relire",
  needs_edits: "Modifications demandées",
  promoted_t1: "Promu tier-1",
  // rôles utilisateur
  super_admin: "Super admin",
  admin: "Administrateur",
  editor: "Éditeur",
  reader: "Lecteur",
};

function defaultLabel(status: string): string {
  const s = status.toLowerCase();
  return STATUS_LABELS_FR[s] ?? status.replace(/_/g, " ");
}

export function AdminStatusBadge({
  status,
  type,
  label,
  className,
}: AdminStatusBadgeProps): React.ReactElement {
  // Point pulsant pour les statuts « en cours » (feeling produit temps réel).
  const pulse = /(^|_)(processing|running|queued|publishing|in_progress|awaiting)(_|$)/.test(
    status.toLowerCase(),
  );
  return (
    <AdminBadge
      tone={statusToTone(type, status)}
      dot
      pulse={pulse}
      {...(className ? { className } : {})}
    >
      {label ?? defaultLabel(status)}
    </AdminBadge>
  );
}
