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
  emoji: string;
  titre: string;
  description: string;
  chemin: string;
}> = [
  {
    emoji: "📁",
    titre: "Dossiers",
    description: "Où en est chaque affaire, du devis au solde encaissé",
    chemin: "/qualiopi/dossiers",
  },
  {
    emoji: "📨",
    titre: "Boîte de réception",
    description: "Appels réservés, messages, candidatures, podcasts",
    chemin: "/contacts",
  },
  {
    emoji: "🖥️",
    titre: "Infrastructure",
    description: "14 outils, statut en direct, liens directs",
    chemin: "/infra",
  },
  {
    emoji: "🔔",
    titre: "Alertes",
    description: "Sentry · UptimeRobot · Coolify, agrégées",
    chemin: "/alerts",
  },
  {
    emoji: "🔐",
    titre: "Double authentification",
    description: "Activer la 2FA sur votre compte",
    chemin: "/2fa/setup",
  },
  {
    emoji: "🌐",
    titre: "Toutes les URLs",
    description: "Catalogue vivant des pages publiques et leur indexabilité",
    chemin: "/site-explorer",
  },
];

function Compteur({
  emoji,
  n,
  libelle,
}: {
  emoji: string;
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
      <span aria-hidden="true">{emoji}</span>
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
        title="👋 Tableau de bord"
        description={`Connecté en tant que ${email ?? "—"} · ${role}`}
        actions={
          // Le rail porte aussi un bouton de déconnexion, mais UNIQUEMENT quand
          // il est déployé : replié, il n'en affiche aucun et le menu
          // utilisateur n'en propose pas non plus. On garde donc celui-ci.
          <form action={logoutAction}>
            <button type="submit" className="admin-button-ghost">
              🚪 Déconnexion
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
            <span aria-hidden="true">✅</span> <strong>Rien n’attend d’action.</strong> Tout est à
            jour — signatures, e-mails et alertes sont traités.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-6)]">
            <div className="min-w-0">
              <h2 className="text-[length:var(--text-admin-xl)] font-bold tracking-tight text-[color:var(--color-admin-fg)]">
                <span aria-hidden="true">🔴</span> {aTraiter.total} chose
                {aTraiter.total > 1 ? "s" : ""} à traiter
              </h2>
              <div className="mt-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-3)]">
                <Compteur
                  emoji="✍️"
                  n={aTraiter.signatures}
                  libelle="signature(s) à contresigner"
                />
                <Compteur emoji="📧" n={aTraiter.emails} libelle="e-mail(s) à valider" />
                <Compteur emoji="🔔" n={aTraiter.alertes} libelle="alerte(s) non lue(s)" />
              </div>
            </div>
            <Link href={`${base}/qualiopi/a-traiter`} className="admin-button shrink-0">
              Ouvrir la liste →
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
          label="📥 Soumissions totales"
          value={kpis.totalSubmissions}
          href={`${base}/submissions`}
        />
        <AdminStatCard
          label="📰 Articles publiés"
          value={kpis.totalArticles}
          href={`${base}/blog`}
        />
        <AdminStatCard
          label="📬 Abonnés newsletter"
          value={kpis.totalSubscribers}
          href={`${base}/newsletter`}
        />
      </section>

      <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        {/* ————— Journal ————— */}
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            🕒 Activité récente
          </h2>
          {activityRows.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucune activité enregistrée.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-4)]">
              {activityRows.map((a) => {
                const { emoji, texte } = decrireAction(a.action);
                return (
                  <li key={a.id} className="flex items-start gap-[var(--space-admin-4)]">
                    <span aria-hidden="true" className="shrink-0 leading-[1.4]">
                      {emoji}
                    </span>
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
            <Link href={`${base}/activity-logs`} className="admin-button-ghost">
              Voir tout le journal →
            </Link>
          </p>
        </AdminCard>

        {/* ————— Raccourcis ————— */}
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            ⚡ Raccourcis
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
                  <span aria-hidden="true" className="shrink-0 text-[length:var(--text-admin-lg)]">
                    {r.emoji}
                  </span>
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
