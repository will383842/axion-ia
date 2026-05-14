/**
 * Content Generator — Job detail timeline (§ 12.1quinquies v1.9).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { JobLogStream } from "@/components/admin/content-gen/JobLogStream";
import { cancelJob, getJob, retryJob } from "@/server/actions/content-gen/jobs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const job = await getJob(id);
  if (!job) notFound();

  async function retry() {
    "use server";
    await retryJob(id);
  }

  async function cancel() {
    "use server";
    await cancelJob(id);
  }

  const isRunning =
    job.status === "running" ||
    job.status === "queued" ||
    job.status === "generating_text" ||
    job.status === "generating_image" ||
    job.status === "quality_improving";

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Job {job.id.slice(0, 12)}…</h1>
          <p className="admin-meta">
            {job.contentType} · {job.status} · créé {job.createdAt.toISOString().slice(0, 16)}
          </p>
        </div>
        <div className="admin-dashboard-actions">
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
      </div>

      <div className="admin-card">
        <h2>Timeline</h2>
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
      </div>

      <div className="admin-card">
        <h2>Géo + audience</h2>
        <ul className="admin-inline-list">
          <li>Ville : {job.anchorVilleSlug ?? "—"}</li>
          <li>Dépt : {job.anchorDepartementCode ?? "—"}</li>
          <li>Région : {job.anchorRegionSlug ?? "—"}</li>
          <li>Taille : {job.targetAudienceSize ?? "—"}</li>
          <li>Organisation : {job.targetAudienceOrganisation ?? "—"}</li>
          <li>Intent : {job.targetSearchIntent}</li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Métriques</h2>
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
      </div>

      {job.errorMessage ? (
        <div className="admin-card" style={{ borderColor: "var(--color-terracotta)" }}>
          <h2>Erreur</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{job.errorMessage}</pre>
        </div>
      ) : null}

      <div className="admin-card">
        <h2>Live stream</h2>
        <JobLogStream jobId={job.id} />
      </div>

      <div className="admin-card">
        <h2>Logs persistés ({job.logs.length})</h2>
        {job.logs.length === 0 ? (
          <p>Aucun log persisté.</p>
        ) : (
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
        )}
      </div>
    </section>
  );
}
