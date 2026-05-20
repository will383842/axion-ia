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
import { ConnaissancesApercuV2 } from "./_v2/ConnaissancesApercuV2";

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
    <ConnaissancesApercuV2
      adminPrefix={adminPrefix}
      entryId={entry.id}
      typeLabel={getKbTypeMeta(entry.type).labelFr}
      statusLabel={getStatusLabel(entry.status, "fr")}
      title={tr.title}
      slug={tr.slug}
      locale={tr.locale}
      excerpt={tr.excerpt}
      sanitizedBodyHtml={sanitizeTiptapHtml(tr.body)}
    />
  );
}

