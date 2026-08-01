// Tableau de bord d'accueil — refonte UI 2026-08-01 (couche 4).
//
// CE QUI N'ALLAIT PAS
// C'est la première page de la console, et elle ne répondait à aucune question
// utile :
//   - « Activité récente » affichait les CLÉS BRUTES du journal
//     (`qualiopi.piece.lien_signature`, `facturation.plan_recurrent.statut`) ;
//   - « Ops · Monitoring » listait des CHEMINS D'URL (`/infra`, `/alerts`,
//     `/2fa/setup`) comme dans une page de débogage ;
//   - trois compteurs de contenu et rien sur ce qui attend une action, alors
//     que « À traiter » existe et porte une pastille dans la navigation.
//
// CE QUI CHANGE
// La page s'ouvre sur ce qui attend : combien, de quelle nature, et un lien
// direct. Le reste devient du contexte. Les clés du journal passent par
// `decrireAction` (voir src/lib/admin/activity-labels.ts), qui les traduit par
// leur STRUCTURE et non par une table — 206 clés existent et il en apparaît à
// chaque sprint.
//
// NB : ne pas préfixer un numéro de PR par « # » dans src/app —
// `scripts/check-anti-hex.sh` y verrait une couleur hexadécimale codée en dur.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { decrireAction } from "@/lib/admin/activity-labels";
import type { ActivityIconKey } from "@/lib/admin/activity-labels";
import {
  FolderKanban,
  Inbox,
  Server,
  Bell,
  ShieldCheck,
  Globe,
  LogOut,
  CircleCheck,
  CircleAlert,
  PenLine,
  Mail,
  ChevronRight,
  History,
  Zap,
  Newspaper,
  Send,
  Handshake,
  Signature,
  FileText,
  Building2,
  ChartColumn,
  Landmark,
  SearchCheck,
  Banknote,
  Star,
  Award,
  Settings,
  GraduationCap,
  CircleDollarSign,
  Library,
  Lock,
  Palette,
  Image as ImageIcon,
  Pin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Forme donnée à chaque famille d'action du journal.
 *
 * `activity-labels.ts` nomme la famille (`document`, `facturation`…) sans jamais
 * la dessiner : c'est du code de bibliothèque, testé sans DOM. La correspondance
 * vers un composant se fait donc ici, au seul endroit qui rend le journal.
 */
const ICONE_ACTIVITE: Record<ActivityIconKey, LucideIcon> = {
  coaching: Handshake,
  signature: Signature,
  document: FileText,
  devis: PenLine,
  organisation: Building2,
  alerte: Bell,
  rapport: ChartColumn,
  financeur: Landmark,
  audit: SearchCheck,
  remuneration: Banknote,
  appreciation: Star,
  attestation: Award,
  reglage: Settings,
  formation: GraduationCap,
  facturation: CircleDollarSign,
  email: Mail,
  connaissances: Library,
  rgpd: Lock,
  newsletter: Send,
  article: Newspaper,
  marque: Palette,
  media: ImageIcon,
  inconnu: Pin,
};

interface DashboardV2Props {
  adminPrefix: string;
  email: string | null;
  role: string;
  logoutAction: () => Promise<void> | void;
  kpis: {
    totalSubmissions: number;
    totalArticles: number;
    totalSubscribers: number;
  };
  /** Ce qui attend une action — même source que la pastille de la navigation. */
  aTraiter: {
    signatures: number;
    emails: number;
    alertes: number;
    total: number;
  };
  activityRows: ReadonlyArray<{ id: string; action: string; secondary: string }>;
}

/** Raccourci vers un outil, avec son repère visuel. */
const RACCOURCIS: ReadonlyArray<{
  icone: LucideIcon;
  titre: string;
  description: string;
  chemin: string;
}> = [
  {
    icone: FolderKanban,
    titre: "Dossiers",
    description: "Où en est chaque affaire, du devis au solde encaissé",
    chemin: "/qualiopi/dossiers",
  },
  {
    icone: Inbox,
    titre: "Boîte de réception",
    description: "Appels réservés, messages, candidatures, podcasts",
    chemin: "/contacts",
  },
  {
    icone: Server,
    titre: "Infrastructure",
    description: "14 outils, statut en direct, liens directs",
    chemin: "/infra",
  },
  {
    icone: Bell,
    titre: "Alertes",
    description: "Sentry · UptimeRobot · Coolify, agrégées",
    chemin: "/alerts",
  },
  {
    icone: ShieldCheck,
    titre: "Double authentification",
    description: "Activer la 2FA sur votre compte",
    chemin: "/2fa/setup",
  },
  {
    icone: Globe,
    titre: "Toutes les URLs",
    description: "Catalogue vivant des pages publiques et leur indexabilité",
    chemin: "/site-explorer",
  },
];

function Compteur({
  icon: Icon,
  n,
  libelle,
}: {
  icon: LucideIcon;
  n: number;
  libelle: string;
}): React.ReactElement | null {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-admin-3)]",
        "rounded-[var(--radius-admin-pill)] bg-[color:var(--color-admin-paper)]",
        "px-[var(--space-admin-5)] py-[var(--space-admin-3)]",
        "text-[length:var(--text-admin-sm)] font-medium",
        "border border-[color:var(--color-admin-border)]",
      )}
    >
      <Icon
        size={15}
        aria-hidden="true"
        className="shrink-0 text-[color:var(--color-admin-fg-muted)]"
      />
      <strong className="tabular-nums">{n}</strong>
      {libelle}
    </span>
  );
}

export function DashboardV2({
  adminPrefix,
  email,
  role,
  logoutAction,
  kpis,
  aTraiter,
  activityRows,
}: DashboardV2Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const rienAFaire = aTraiter.total === 0;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Tableau de bord"
        description={`Connecté en tant que ${email ?? "—"} · ${role}`}
        actions={
          // Le rail porte aussi un bouton de déconnexion, mais UNIQUEMENT quand
          // il est déployé : replié, il n'en affiche aucun et le menu
          // utilisateur n'en propose pas non plus. On garde donc celui-ci.
          <form action={logoutAction}>
            <button
              type="submit"
              className="admin-button-ghost inline-flex items-center gap-[var(--space-admin-2)]"
            >
              <LogOut size={15} aria-hidden="true" />
              Déconnexion
            </button>
          </form>
        }
      />

      {/* ————— Ce qui attend une action ————— */}
      <section
        aria-label="À traiter"
        className={cn(
          "mb-[var(--space-admin-7)] rounded-[var(--radius-admin-xl)] border p-[var(--space-admin-card)]",
          rienAFaire
            ? "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)]"
            : "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-destructive-soft)]",
        )}
      >
        {rienAFaire ? (
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-success-fg)]">
            <CircleCheck
              size={16}
              aria-hidden="true"
              className="mr-[var(--space-admin-2)] inline-block align-[-2px]"
            />
            <strong>Rien n’attend d’action.</strong> Tout est à jour — signatures, e-mails et
            alertes sont traités.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-6)]">
            <div className="min-w-0">
              <h2 className="text-[length:var(--text-admin-xl)] font-bold tracking-tight text-[color:var(--color-admin-fg)]">
                <CircleAlert
                  size={20}
                  aria-hidden="true"
                  className="mr-[var(--space-admin-2)] inline-block align-[-3px] text-[color:var(--color-admin-destructive)]"
                />
                {aTraiter.total} chose
                {aTraiter.total > 1 ? "s" : ""} à traiter
              </h2>
              <div className="mt-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-3)]">
                <Compteur
                  icon={PenLine}
                  n={aTraiter.signatures}
                  libelle="signature(s) à contresigner"
                />
                <Compteur icon={Mail} n={aTraiter.emails} libelle="e-mail(s) à valider" />
                <Compteur icon={Bell} n={aTraiter.alertes} libelle="alerte(s) non lue(s)" />
              </div>
            </div>
            <Link
              href={`${base}/qualiopi/a-traiter`}
              className="admin-button inline-flex shrink-0 items-center gap-[var(--space-admin-2)]"
            >
              Ouvrir la liste
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* ————— Repères de contenu ————— */}
      <section
        aria-label="Repères contenu"
        className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3"
      >
        <AdminStatCard
          label="Soumissions totales"
          value={kpis.totalSubmissions}
          href={`${base}/submissions`}
        />
        <AdminStatCard label="Articles publiés" value={kpis.totalArticles} href={`${base}/blog`} />
        <AdminStatCard
          label="Abonnés newsletter"
          value={kpis.totalSubscribers}
          href={`${base}/newsletter`}
        />
      </section>

      <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        {/* ————— Journal ————— */}
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            <History size={18} aria-hidden="true" className="shrink-0" />
            Activité récente
          </h2>
          {activityRows.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucune activité enregistrée.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-4)]">
              {activityRows.map((a) => {
                const { icone, texte } = decrireAction(a.action);
                const IconeAction = ICONE_ACTIVITE[icone];
                return (
                  <li key={a.id} className="flex items-start gap-[var(--space-admin-4)]">
                    <IconeAction
                      size={16}
                      aria-hidden="true"
                      className="mt-[2px] shrink-0 text-[color:var(--color-admin-fg-muted)]"
                    />
                    <span className="min-w-0 text-[length:var(--text-admin-sm)]">
                      <strong className="font-medium text-[color:var(--color-admin-fg)]">
                        {texte}
                      </strong>
                      <span className="ml-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
                        {a.secondary}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-[var(--space-admin-6)]">
            <Link
              href={`${base}/activity-logs`}
              className="admin-button-ghost inline-flex items-center gap-[var(--space-admin-2)]"
            >
              Voir tout le journal
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </AdminCard>

        {/* ————— Raccourcis ————— */}
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            <Zap size={18} aria-hidden="true" className="shrink-0" />
            Raccourcis
          </h2>
          <ul className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
            {RACCOURCIS.map((r) => (
              <li key={r.chemin}>
                <Link
                  href={`${base}${r.chemin}`}
                  className={cn(
                    "flex h-full items-start gap-[var(--space-admin-4)]",
                    "rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)]",
                    "bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-5)]",
                    "transition-colors hover:border-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface-hover)]",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none",
                  )}
                >
                  <r.icone
                    size={20}
                    aria-hidden="true"
                    className="mt-[2px] shrink-0 text-[color:var(--color-admin-fg-muted)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
                      {r.titre}
                    </span>
                    <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {r.description}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
