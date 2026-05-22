// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Job detail V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// IMPORTANT : JobLogStream préservé intégralement (contrat SSE inchangé).
// Server Actions retry/cancel inline préservées.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { JobLogStream } from "@/components/admin/content-gen/JobLogStream";
import { JobsLiveStream } from "@/components/admin/content-gen/JobsLiveStream";
import { cancelJob, retryJob } from "@/server/actions/content-gen/jobs";

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
}

interface Props {
  job: JobData;
}

export function JobDetailV2({ job }: Props): React.ReactElement {
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
        description={`${job.contentType} · ${job.status} · créé ${job.createdAt.toISOString().slice(0, 16)}`}
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
        <h2 className="admin-h2">Timeline</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>Statut :</strong> {job.status}
          </li>
          <li>
            <strong>Priorité :</strong> {job.priority}
          </li>
          <li>
            <strong>Retries :</strong> {job.retryCount}
          </li>
          <li>
            <strong>Démarré :</strong> {job.startedAt?.toISOString() ?? "—"}
          </li>
          <li>
            <strong>Terminé :</strong> {job.completedAt?.toISOString() ?? "—"}
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
          <li>Intent : {job.targetSearchIntent}</li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Métriques</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>Quality :</strong> {job.qualityScore ?? "—"}
          </li>
          <li>
            <strong>SEO :</strong> {job.seoScore ?? "—"}
          </li>
          <li>
            <strong>Plagiat :</strong>{" "}
            {job.plagiarismScore ? Number(job.plagiarismScore).toFixed(2) : "—"}
          </li>
          <li>
            <strong>Readability :</strong>{" "}
            {job.readabilityScore ? Number(job.readabilityScore).toFixed(2) : "—"}
          </li>
          <li>
            <strong>Doctrine OK :</strong>{" "}
            {job.doctrineCheckPassed === null ? "—" : job.doctrineCheckPassed ? "✅" : "❌"}
          </li>
          <li>
            <strong>Tokens :</strong> in {job.tokensInput ?? 0} / out {job.tokensOutput ?? 0}
          </li>
          <li>
            <strong>Coût :</strong> {job.costUsd ? `$${Number(job.costUsd).toFixed(4)}` : "—"}
          </li>
        </ul>
      </AdminCard>

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
        <h2 className="admin-h2">Live stream (logs)</h2>
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
                    <td>{l.timestamp.toISOString().slice(11, 19)}</td>
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
