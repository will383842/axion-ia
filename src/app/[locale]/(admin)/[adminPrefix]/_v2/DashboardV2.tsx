// Tableau de bord de PILOTAGE (refonte console phase 3, audit UX 2026-08-01).
//
// Server Component pur : toutes les données arrivent en props, déjà assemblées
// par `getPilotageDashboard` (le fetch reste dans le wrapper — un seul point
// d'entrée DB). Sept sections, du plus urgent au plus froid, puis l'activité
// récente et les liens d'exploitation en bas de page. Zéro lib graphique :
// les seules « courbes » sont des barres CSS rendues côté serveur.
//
// NB : ne pas préfixer un numéro de PR par « # » dans src/app —
// `scripts/check-anti-hex.sh` y verrait une couleur hex codée en dur.

import Link from "next/link";
import {
  Server,
  Bell,
  ShieldCheck,
  ChevronRight,
  Handshake,
  Signature,
  FileText,
  PenLine,
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
  Mail,
  Library,
  Lock,
  Send,
  Newspaper,
  Palette,
  Image as ImageIcon,
  Pin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import type { PilotageDashboard } from "@/server/admin/pilotage-dashboard";
import type { ActivityIconKey } from "@/lib/admin/activity-labels";
import { EnTetePilotage } from "./pilotage/EnTetePilotage";
import { AlertesCritiques } from "./pilotage/AlertesCritiques";
import { CalendrierPrevisionnel } from "./pilotage/CalendrierPrevisionnel";
import { ActiviteSection } from "./pilotage/ActiviteSection";
import { FormateursSection } from "./pilotage/FormateursSection";
import { FinancierSection } from "./pilotage/FinancierSection";
import { PipelineSection } from "./pilotage/PipelineSection";
import { libelleRole } from "./pilotage/format";

/**
 * Forme donnée à chaque famille d'action du journal.
 *
 * `activity-labels.ts` nomme la famille (`document`, `facturation`…) sans
 * jamais la dessiner — c'est du code de bibliothèque, testé sans DOM. La
 * correspondance vers lucide se fait ici, au seul endroit qui rend le journal.
 * Le type union force l'exhaustivité : une famille sans forme ne compile pas.
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

/** Raccourcis d'exploitation — libellé métier, jamais un chemin d'URL. */
const RACCOURCIS: ReadonlyArray<{
  icone: LucideIcon;
  titre: string;
  description: string;
  chemin: string;
}> = [
  {
    icone: Server,
    titre: "Infrastructure",
    description: "14 outils, statut en direct, liens directs",
    chemin: "/infra",
  },
  {
    icone: Bell,
    titre: "Alertes ops",
    description: "Sentry · UptimeRobot · Coolify, agrégées",
    chemin: "/alerts",
  },
  {
    icone: ShieldCheck,
    titre: "Double authentification",
    description: "Activer la 2FA sur votre compte",
    chemin: "/2fa/setup",
  },
];

interface DashboardV2Props {
  adminPrefix: string;
  role: string;
  logoutAction: () => Promise<void> | void;
  dashboard: PilotageDashboard;
  activityRows: ReadonlyArray<{
    id: string;
    icone: ActivityIconKey;
    primary: string;
    secondary: string;
  }>;
}

export function DashboardV2({
  adminPrefix,
  role,
  logoutAction,
  dashboard,
  activityRows,
}: DashboardV2Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminPageShell>
      {/* La description disait « Connecté en tant que <email> · <rôle> » — une
          information que le pied de la barre latérale porte déjà, à la place la
          plus chère de la page. La description dit maintenant à quoi sert la
          page ; l'identité reste dans la barre latérale. */}
      <AdminPageHeader
        title="Tableau de bord"
        description={`Ce qui attend, ce qui rentre, ce qui bloque — ${libelleRole(role).toLowerCase()}.`}
        actions={
          <form action={logoutAction}>
            <button type="submit" className="admin-button-ghost">
              Déconnexion
            </button>
          </form>
        }
      />

      {/* 1 — Sélecteur de période + tuiles de pilotage. */}
      <EnTetePilotage
        adminPrefix={adminPrefix}
        periode={dashboard.periode}
        periodeLabel={dashboard.periodeLabel}
        tuiles={dashboard.tuiles}
        objectif={dashboard.objectif}
      />

      {/* 2 — Alertes critiques (toujours visible, même vide). */}
      <AlertesCritiques adminPrefix={adminPrefix} alertes={dashboard.alertesCritiques} />

      {/* 3 — Calendrier & prévisionnel (le cœur). */}
      <CalendrierPrevisionnel
        adminPrefix={adminPrefix}
        calendrier={dashboard.calendrier}
        previsionnelBloque={dashboard.previsionnelBloque}
      />

      {/* 4 — Activité par famille de prestation. */}
      <ActiviteSection activites={dashboard.activites} periodeLabel={dashboard.periodeLabel} />

      {/* 5 — Formateurs. */}
      <FormateursSection adminPrefix={adminPrefix} formateurs={dashboard.formateurs} />

      {/* 6 — Financier. */}
      <FinancierSection
        adminPrefix={adminPrefix}
        financier={dashboard.financier}
        objectif={dashboard.objectif}
      />

      {/* 7 — Pipeline commercial. */}
      <PipelineSection adminPrefix={adminPrefix} pipeline={dashboard.pipeline} />

      {/* Journal + raccourcis, côte à côte en bas de page : deux blocs froids
          qui n'ont pas à occuper chacun toute la largeur. */}
      <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        <AdminCard>
          <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Activité récente
          </h2>
          {activityRows.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucune activité enregistrée.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-4)]">
              {activityRows.map((a) => {
                const IconeAction = ICONE_ACTIVITE[a.icone];
                return (
                  <li key={a.id} className="flex items-start gap-[var(--space-admin-4)]">
                    <IconeAction
                      size={16}
                      aria-hidden="true"
                      className="mt-[2px] shrink-0 text-[color:var(--color-admin-fg-muted)]"
                    />
                    <span className="min-w-0 text-[length:var(--text-admin-sm)]">
                      <strong className="font-medium text-[color:var(--color-admin-fg)]">
                        {a.primary}
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
          <p className="mt-[var(--space-admin-5)]">
            <Link href={`${base}/activity-logs`} className="admin-button-ghost">
              Voir tout le journal
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </AdminCard>

        <AdminCard>
          <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Exploitation
          </h2>
          <ul className="flex flex-col gap-[var(--space-admin-3)]">
            {RACCOURCIS.map((r) => (
              <li key={r.chemin}>
                <Link
                  href={`${base}${r.chemin}`}
                  className="flex items-start gap-[var(--space-admin-4)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-5)] transition-colors hover:border-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:outline-none"
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
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="ml-auto shrink-0 self-center text-[color:var(--color-admin-fg-muted)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
