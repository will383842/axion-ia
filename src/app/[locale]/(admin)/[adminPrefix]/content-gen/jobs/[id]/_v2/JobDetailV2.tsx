// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Job detail V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// IMPORTANT : JobLogStream préservé intégralement (contrat SSE inchangé).
// Server Actions retry/cancel inline préservées.
// SP-04 P1 — liens contextuels template parent + review-queue associée.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEtatBooleen,
} from "@/components/admin/ui";
import { JobLogStream } from "@/components/admin/content-gen/JobLogStream";
import { JobsLiveStream } from "@/components/admin/content-gen/JobsLiveStream";
import { cancelJob, retryJob } from "@/server/actions/content-gen/jobs";
import { formatDateFr } from "@/lib/format-date-fr";
import { libelleModele } from "@/components/admin/content-gen/template-labels";
import {
  contentTypeLabelFr,
  jobStatusLabelFr,
  searchIntentLabelFr,
} from "@/server/content-gen/shared/admin-labels";

// Heure seule (Europe/Paris) avec secondes — la table des logs horodate des
// étapes d'un même job, la date complète serait répétée sur chaque ligne.
const HEURE_LOG_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface JobLog {
  id: string;
  timestamp: Date;
  level: string;
  step: string;
  message: string;
}

interface JobData {
  id: string;
  contentType: string;
  status: string;
  priority: number;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  anchorVilleSlug: string | null;
  anchorDepartementCode: string | null;
  anchorRegionSlug: string | null;
  targetAudienceSize: string | null;
  targetAudienceOrganisation: string | null;
  targetSearchIntent: string;
  qualityScore: number | null;
  seoScore: number | null;
  plagiarismScore: unknown;
  readabilityScore: unknown;
  doctrineCheckPassed: boolean | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: unknown;
  errorMessage: string | null;
  createdAt: Date;
  logs: ReadonlyArray<JobLog>;
  // Liens contextuels SP-04 P1
  templateId?: string | null;
  campaignId?: string | null;
  template?: { id: string; slug: string; name: string; version: number } | null;
  reviewQueue?: { id: string; status: string } | null;
}

interface Props {
  job: JobData;
  adminPrefix?: string;
}

export function JobDetailV2({ job, adminPrefix }: Props): React.ReactElement {
  async function retry() {
    "use server";
    await retryJob(job.id);
  }

  async function cancel() {
    "use server";
    await cancelJob(job.id);
  }

  const isRunning =
    job.status === "running" ||
    job.status === "queued" ||
    job.status === "generating_text" ||
    job.status === "generating_image" ||
    job.status === "quality_improving";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Job ${job.id.slice(0, 12)}…`}
        description={`${contentTypeLabelFr(job.contentType)} · ${jobStatusLabelFr(job.status)} · créé ${formatDateFr(job.createdAt)}`}
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            {job.status === "failed" || job.status === "cancelled" ? (
              <form action={retry}>
                <button type="submit" className="admin-button">
                  Rejouer
                </button>
              </form>
            ) : null}
            {isRunning ? (
              <form action={cancel}>
                <button type="submit" className="admin-button-ghost">
                  Annuler
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Chronologie</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>Statut :</strong> {jobStatusLabelFr(job.status)}
          </li>
          <li>
            <strong>Priorité :</strong> {job.priority}
          </li>
          <li>
            <strong>Tentatives :</strong> {job.retryCount}
          </li>
          <li>
            <strong>Démarré :</strong> {formatDateFr(job.startedAt)}
          </li>
          <li>
            <strong>Terminé :</strong> {formatDateFr(job.completedAt)}
          </li>
          <li>
            <strong>Durée :</strong>{" "}
            {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)} s` : "—"}
          </li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Géo + audience</h2>
        <ul className="admin-inline-list">
          <li>Ville : {job.anchorVilleSlug ?? "—"}</li>
          <li>Dépt : {job.anchorDepartementCode ?? "—"}</li>
          <li>Région : {job.anchorRegionSlug ?? "—"}</li>
          <li>Taille : {job.targetAudienceSize ?? "—"}</li>
          <li>Organisation : {job.targetAudienceOrganisation ?? "—"}</li>
          <li>Intention : {searchIntentLabelFr(job.targetSearchIntent)}</li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Métriques</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>Qualité :</strong> {job.qualityScore ?? "—"}
          </li>
          <li>
            <strong>SEO :</strong> {job.seoScore ?? "—"}
          </li>
          <li>
            <strong>Plagiat :</strong>{" "}
            {job.plagiarismScore ? Number(job.plagiarismScore).toFixed(2) : "—"}
          </li>
          <li>
            <strong>Lisibilité :</strong>{" "}
            {job.readabilityScore ? Number(job.readabilityScore).toFixed(2) : "—"}
          </li>
          <li>
            <strong>Doctrine OK :</strong>{" "}
            {job.doctrineCheckPassed === null ? (
              "—"
            ) : (
              <AdminEtatBooleen
                actif={job.doctrineCheckPassed}
                libelles={{ vrai: "Contrôle doctrine réussi", faux: "Contrôle doctrine échoué" }}
              />
            )}
          </li>
          <li>
            <strong>Jetons :</strong> {job.tokensInput ?? 0} en entrée, {job.tokensOutput ?? 0} en
            sortie
          </li>
          <li>
            <strong>Coût :</strong> {job.costUsd ? `$${Number(job.costUsd).toFixed(4)}` : "—"}
          </li>
        </ul>
      </AdminCard>

      {/* Liens contextuels P1 */}
      {adminPrefix && (job.template || job.reviewQueue || job.campaignId) ? (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Liens contextuels</h2>
          <ul className="admin-inline-list">
            {job.template ? (
              <li>
                <strong>Modèle :</strong>{" "}
                <Link
                  href={`/fr/${adminPrefix}/content-gen/templates/${job.template.id}`}
                  className="admin-link"
                >
                  {libelleModele(job.template.slug, job.template.name)} (v{job.template.version})
                </Link>
              </li>
            ) : null}
            {job.campaignId ? (
              <li>
                <strong>Campagne :</strong>{" "}
                <Link
                  href={`/fr/${adminPrefix}/content-gen/coverage/${encodeURIComponent(job.campaignId)}`}
                  className="admin-link"
                >
                  {job.campaignId.slice(0, 12)}…
                </Link>
              </li>
            ) : null}
            {job.reviewQueue ? (
              <li>
                <strong>Revue :</strong>{" "}
                <Link
                  href={`/fr/${adminPrefix}/content-gen/review-queue/${encodeURIComponent(job.reviewQueue.id)}`}
                  className="admin-link"
                >
                  Revue #{job.reviewQueue.id.slice(0, 8)}… · {job.reviewQueue.status}
                </Link>
              </li>
            ) : null}
          </ul>
        </AdminCard>
      ) : null}

      {job.errorMessage ? (
        <AdminCard className="mb-[var(--space-admin-5)] border-l-4 border-l-[color:var(--color-admin-destructive)]">
          <h2 className="admin-h2">Erreur</h2>
          <pre className="text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
            {job.errorMessage}
          </pre>
        </AdminCard>
      ) : null}

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Progression temps réel</h2>
        {/* Sprint A-suite P6 — Item 5. JobsLiveStream : statut + progress bar + qualityScore SSE. */}
        <JobsLiveStream jobId={job.id} initialStatus={job.status} />
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Flux en direct (journaux)</h2>
        <JobLogStream jobId={job.id} />
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Logs persistés ({job.logs.length})</h2>
        {job.logs.length === 0 ? (
          <p className="admin-meta-block">Aucun log persisté.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Horodatage</th>
                  <th>Niveau</th>
                  <th>Étape</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {job.logs.map((l) => (
                  <tr key={l.id}>
                    <td>{HEURE_LOG_FR.format(l.timestamp)}</td>
                    <td>{l.level}</td>
                    <td>
                      <code>{l.step}</code>
                    </td>
                    <td title={l.message}>{l.message.slice(0, 120)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
