// KB-3 — Édition d'une entrée Knowledge Base (FR minimal V1).
//
// V1 : édition métadonnées Entry + body FR.
// V1.5+ (KB-4) : onglets Versions / Relations / Publication / RGPD / Médias.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEntryAction } from "@/server/actions/knowledge/get-entry";
import { ConnaissancesEditForm } from "./ConnaissancesEditForm";
import { WorkflowPanel } from "./WorkflowPanel";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { ConnaissancesEditV2 } from "./_v2/ConnaissancesEditV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ConnaissancesEditPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const userRole = (session.user as { role?: string }).role ?? "reader";

  const entry = await getEntryAction({ id });
  if (!entry || entry.deletedAt) notFound();

  const fr = entry.translations.find((t) => t.locale === "fr");

  const entrySnapshot = {
    id: entry.id,
    type: entry.type,
    domain: entry.domain,
    audience: entry.audience,
    confidentiality: entry.confidentiality,
    status: entry.status,
    pipelineStage: entry.pipelineStage,
    slug: entry.slug,
    briefMarkdown: entry.briefMarkdown,
    targetKeyword: entry.targetKeyword,
    targetWordCount: entry.targetWordCount,
    fr: fr
      ? {
          id: fr.id,
          title: fr.title,
          slug: fr.slug,
          excerpt: fr.excerpt,
          body: fr.body,
        }
      : null,
  };

  if (await isAdminV2Enabled()) {
    return (
      <ConnaissancesEditV2
        adminPrefix={adminPrefix}
        entry={entrySnapshot}
        entryId={entry.id}
        status={entry.status}
        pipelineStage={entry.pipelineStage}
        userRole={userRole}
        title={fr?.title ?? "(sans titre)"}
        type={entry.type}
        domain={entry.domain}
        audience={entry.audience}
      />
    );
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{fr?.title ?? "(sans titre)"}</h1>
          <p className="admin-meta">
            {entry.type} · {entry.domain} · {entry.audience} · statut {entry.status}
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <a
            href={`/fr/${adminPrefix}/connaissances/${entry.id}/apercu`}
            className="admin-button-ghost"
            target="_blank"
            rel="noopener noreferrer"
          >
            Aperçu ↗
          </a>
          <a href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
            ← Liste
          </a>
        </div>
      </div>

      <WorkflowPanel
        entryId={entry.id}
        status={entry.status}
        pipelineStage={entry.pipelineStage}
        userRole={userRole}
      />

      <ConnaissancesEditForm
        adminPrefix={adminPrefix}
        entry={{
          id: entry.id,
          type: entry.type,
          domain: entry.domain,
          audience: entry.audience,
          confidentiality: entry.confidentiality,
          status: entry.status,
          pipelineStage: entry.pipelineStage,
          slug: entry.slug,
          briefMarkdown: entry.briefMarkdown,
          targetKeyword: entry.targetKeyword,
          targetWordCount: entry.targetWordCount,
          fr: fr
            ? {
                id: fr.id,
                title: fr.title,
                slug: fr.slug,
                excerpt: fr.excerpt,
                body: fr.body,
              }
            : null,
        }}
      />
    </section>
  );
}
