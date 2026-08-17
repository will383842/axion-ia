/**
 * Admin — Synchro CRM (lot L5, plan §2.9 « Observabilité de la synchro »).
 *
 * La carte de santé de la synchronisation site → Axion CRM Pro, et du sens
 * inverse (consentements). Tout ce qu'elle affiche est DÉRIVÉ des statuts de
 * l'outbox : rien n'est recopié dans une table de métriques, donc rien ne peut
 * diverger de la réalité qu'elle prétend décrire.
 *
 * 🔴 Règle d'or du chantier (leçon IndexNow) : un agrégateur vert qui ne relaie
 * rien est le pire des états. Cette page affiche donc l'ÉCART de réconciliation
 * recalculé à chaque affichage, et non un « tout va bien » que personne
 * n'aurait vérifié.
 *
 * Lecture seule, à une exception près : le bouton « Rejouer » d'une ligne en
 * erreur. Il refuse d'agir tant que `CRM_SYNC_ENABLED` n'est pas allumé.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Clock, Inbox, Layers, ShieldCheck } from "lucide-react";

import { auth } from "@/auth";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { getCrmSyncHealth } from "@/server/crm-sync/health";
import { rejouerLigneCrmSyncAction } from "@/server/actions/crm-sync/replay";

import { RejouerBouton } from "./_components/RejouerBouton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Synchro CRM | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

function dateFr(value: Date | null): string {
  if (!value) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function retardLisible(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `${heures} h`;
  return `${Math.floor(heures / 24)} j`;
}

export default async function SynchroCrmPage({ params }: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sante = await getCrmSyncHealth();

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  const backlogDepasse = sante.backlog > sante.backlogThreshold;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Synchro CRM"
        description="Santé du canal site → Axion CRM Pro (outbox) et des consentements reçus du CRM. Les compteurs sont dérivés des statuts de l'outbox, jamais recopiés."
      />

      {/* État des drapeaux — une file vide n'est une anomalie que si la synchro
          est allumée. Sans ce bandeau, une page à zéro se lit comme « tout va
          bien » alors qu'elle peut simplement signifier « rien n'est branché ». */}
      <AdminCard className="mb-[var(--space-admin-6)]">
        <div className="flex flex-wrap items-center gap-[var(--space-admin-5)]">
          <ShieldCheck
            aria-hidden="true"
            className="size-5 text-[color:var(--color-admin-fg-muted)]"
          />
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <span className="font-semibold">Synchro : </span>
            {sante.enabled ? "activée" : "désactivée (CRM_SYNC_ENABLED)"}
          </p>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <span className="font-semibold">Flux candidats : </span>
            {sante.candidatesEnabled ? "ouvert" : "fermé (CRM_SYNC_CANDIDATES_ENABLED)"}
          </p>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <span className="font-semibold">Canal : </span>
            {sante.configured ? "URL et secret présents" : "URL ou secret absent"}
          </p>
        </div>
        {!sante.enabled && (
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Tant que le drapeau est éteint, aucune ligne n&apos;est écrite : des compteurs à zéro
            sont l&apos;état NORMAL, pas un incident.
          </p>
        )}
      </AdminCard>

      {/* Les cinq compteurs du plan §2.9. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-5">
        <AdminStatCard
          label="Dernier succès"
          value={dateFr(sante.lastSentAt)}
          meta={`${sante.sent24h} acquittés sur 24 h`}
          tone={sante.lastSentAt ? "success" : "default"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="File d'attente"
          value={sante.backlog}
          meta={`seuil d'alerte : ${sante.backlogThreshold}`}
          tone={backlogDepasse ? "destructive" : "default"}
          icon={Layers}
        />
        <AdminStatCard
          label="Échecs 24 h"
          value={sante.failures24h}
          meta="dernière tentative en échec"
          tone={sante.failures24h > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Abandons définitifs"
          value={sante.counts.gave_up}
          meta="n'arriveront pas sans rejeu"
          tone={sante.counts.gave_up > 0 ? "destructive" : "default"}
          icon={Ban}
        />
        <AdminStatCard
          label="Retard max"
          value={retardLisible(sante.oldestPendingMinutes)}
          meta={
            sante.oldestPendingAt ? `plus vieux en attente : ${dateFr(sante.oldestPendingAt)}` : "—"
          }
          tone={
            sante.oldestPendingMinutes !== null && sante.oldestPendingMinutes > 60
              ? "warning"
              : "default"
          }
          icon={Clock}
        />
      </div>

      {/* Réconciliation — le SIGNAL DE VIE rendu visible en console. */}
      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h3">Réconciliation source ↔ outbox</h2>
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          Comparaison des enregistrements créés sur {sante.reconciliation.windowDays} jours avec les
          références réellement émises. Le batch quotidien fait la même chose et alerte ; ce tableau
          la recalcule à l&apos;affichage, sans aucun effet de bord.
        </p>

        {!sante.reconciliation.enabled ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Synchro désactivée — rien à réconcilier.
          </p>
        ) : sante.reconciliation.since === null ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune ligne d&apos;outbox à ce jour : la comparaison ne remonte jamais avant le premier
            événement émis, pour ne pas accuser la période où la synchro n&apos;existait pas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className={headCls}>Famille</th>
                  <th className={headCls}>Univers</th>
                  <th className={headCls}>Sources</th>
                  <th className={headCls}>Émises</th>
                  <th className={headCls}>Manquantes</th>
                </tr>
              </thead>
              <tbody>
                {sante.reconciliation.families.map((famille) => (
                  <tr
                    key={famille.family}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    <td className={cellCls}>{famille.label}</td>
                    <td className={cellCls}>{famille.universe}</td>
                    <td className={cellCls}>{famille.skipped ? "—" : famille.sources}</td>
                    <td className={cellCls}>{famille.skipped ? "—" : famille.emitted}</td>
                    <td className={cellCls}>
                      {famille.skipped ? (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          {famille.skipped}
                        </span>
                      ) : famille.missing === 0 ? (
                        <span className="text-[color:var(--color-admin-success-fg)]">0</span>
                      ) : (
                        <span className="text-[color:var(--color-admin-destructive-fg)]">
                          {famille.missing}
                          {famille.missingIds.length > 0 && (
                            <span className="text-[color:var(--color-admin-fg-muted)]">
                              {" "}
                              ({famille.missingIds.slice(0, 3).join(", ")}…)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Sens entrant — consentements reçus du CRM. */}
      <AdminCard className="mb-[var(--space-admin-6)]">
        <div className="flex flex-wrap items-center gap-[var(--space-admin-5)]">
          <Inbox aria-hidden="true" className="size-5 text-[color:var(--color-admin-fg-muted)]" />
          <h2 className="admin-h3">Consentements reçus du CRM</h2>
        </div>
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          {sante.inbound.total} événement(s) au total, dont {sante.inbound.last24h} sur 24 h.
          Dernier reçu : {dateFr(sante.inbound.lastAt)}.
        </p>
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Une opposition venue du CRM est appliquée localement et ne repart jamais vers lui
          (anti-boucle par origine).
        </p>
      </AdminCard>

      {/* Les lignes en erreur, avec leur corps exact et le bouton de rejeu. */}
      <h2 className="admin-h2 mb-[var(--space-admin-4)]">Lignes en erreur</h2>

      {sante.errors.length === 0 ? (
        <AdminEmptyState
          title="Aucune ligne en erreur"
          description={
            sante.enabled
              ? "Tout ce qui a été enfilé a été acquitté ou attend encore son tour."
              : "La synchro est désactivée : aucune ligne n'existe."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Événement</th>
                <th className={headCls}>Source</th>
                <th className={headCls}>Tentatives</th>
                <th className={headCls}>Code</th>
                <th className={headCls}>Erreur</th>
                <th className={headCls}>Dernière tentative</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sante.errors.map((ligne) => (
                <tr
                  key={ligne.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span
                      className={
                        ligne.status === "gave_up"
                          ? "text-[color:var(--color-admin-destructive-fg)]"
                          : "text-[color:var(--color-admin-warning-fg)]"
                      }
                    >
                      {ligne.status === "gave_up" ? "abandon définitif" : "échec"}
                    </span>
                  </td>
                  <td className={cellCls}>{ligne.eventType}</td>
                  <td className={cellCls}>
                    <span className="break-all">{ligne.subjectRef}</span>
                  </td>
                  <td className={cellCls}>{ligne.attempts}</td>
                  <td className={cellCls}>{ligne.responseStatus ?? "—"}</td>
                  <td className={cellCls}>
                    <span className="break-words">{ligne.lastError ?? "—"}</span>
                    {/* Le corps est REPLIÉ : il porte des données personnelles
                        déchiffrées, et il n'a d'intérêt qu'au moment du
                        diagnostic. Ouvert par défaut, il transformerait cette
                        page en fuite passive de PII à l'écran. */}
                    <details className="mt-[var(--space-admin-2)]">
                      <summary className="cursor-pointer text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Voir le corps envoyé
                      </summary>
                      <pre className="mt-[var(--space-admin-2)] max-h-64 overflow-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                        {JSON.stringify(ligne.payload, null, 2)}
                      </pre>
                    </details>
                  </td>
                  <td className={cellCls}>{dateFr(ligne.lastAttemptAt)}</td>
                  <td className={cellCls}>
                    <RejouerBouton id={ligne.id} action={rejouerLigneCrmSyncAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
