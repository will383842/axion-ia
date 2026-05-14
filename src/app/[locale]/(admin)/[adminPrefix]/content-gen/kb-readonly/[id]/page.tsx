/**
 * Content Generator — KB entry detail (read-only).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function KbReadonlyDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!entry) notFound();
  const fr = entry.translations[0];

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{fr?.title ?? entry.slug}</h1>
          <p className="admin-meta">
            <code>{entry.slug}</code> · {entry.type} · audience {entry.audience} · {entry.status}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/connaissances/${id}`} className="admin-button-ghost">
          Éditer dans /connaissances (skill)
        </a>
      </div>

      <div className="admin-card">
        <h2>Aperçu FR</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 600, overflow: "auto" }}>
          {(fr?.bodyText ?? fr?.body ?? "").slice(0, 5000)}
        </pre>
      </div>
    </section>
  );
}
