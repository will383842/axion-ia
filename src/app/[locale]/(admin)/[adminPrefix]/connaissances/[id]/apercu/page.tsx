// KB-3 — Aperçu SSR draft d'une entrée KB.
// Rendu HTML pur, robots noindex, accessible admin uniquement.
//
// V1 minimal : injecte le body HTML stocké. V2 (KB-12) : sanitization Tiptap
// stricte + render JSON → React via helper renderTiptapJsonToReact.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEntryAction } from "@/server/actions/knowledge/get-entry";
import { getKbTypeMeta } from "@/content/knowledge/types";
import { getStatusLabel } from "@/content/knowledge/statuses";
import { sanitizeTiptapHtml } from "@/lib/knowledge/tiptap-sanitize";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "Aperçu (brouillon) · Axion-IA",
};

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string; locale: string }>;
  searchParams: Promise<{ locale?: string }>;
}

export default async function ConnaissancesApercuPage({ params, searchParams }: PageProps) {
  const { adminPrefix, id } = await params;
  const sp = await searchParams;
  const previewLocale = sp.locale === "en" ? "en" : "fr";
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const entry = await getEntryAction({ id });
  if (!entry || entry.deletedAt) notFound();

  const tr = entry.translations.find((t) => t.locale === previewLocale) ?? entry.translations[0];
  if (!tr) notFound();

  return (
    <section className="admin-preview">
      <div className="admin-preview-banner" role="status">
        <strong>Aperçu (brouillon)</strong> — non indexé. {getKbTypeMeta(entry.type).labelFr} ·{" "}
        {getStatusLabel(entry.status, "fr")} ·{" "}
        <a href={`/fr/${adminPrefix}/connaissances/${entry.id}`} className="admin-link">
          ← Retour édition
        </a>
      </div>

      <article className="admin-preview-content">
        <header>
          <h1>{tr.title}</h1>
          {tr.excerpt ? <p className="admin-preview-excerpt">{tr.excerpt}</p> : null}
          <p className="admin-meta">
            Slug : <code>{tr.slug}</code> · Locale : {tr.locale}
          </p>
        </header>
        <div
          className="admin-preview-body"
          dangerouslySetInnerHTML={{ __html: sanitizeTiptapHtml(tr.body) }}
        />
      </article>
    </section>
  );
}
