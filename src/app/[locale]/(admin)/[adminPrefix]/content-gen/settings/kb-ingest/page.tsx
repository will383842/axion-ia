/**
 * Content Generator — KB ingest externe (Sprint 11.5 V2).
 *
 * UI admin pour ingérer du contenu externe dans la KB :
 *   - 1 URL → 1 entrée KB (article tier)
 *   - 1 sitemap.xml → batch 50 URLs max
 *
 * Use cases :
 *   - Veille concurrentielle (URLs de blogs concurrents)
 *   - Études d'autorité (rapports publics)
 *   - Migration depuis ancien site (sitemap.xml)
 *
 * Sécurité : RequireAdmin sur les actions server. Quota 50 URLs/sitemap par appel.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ingestKbFromSitemap,
  ingestKbFromUrl,
} from "@/server/actions/content-gen/kb-ingest-external";
import {
  KbIngestV2,
  type SitemapIngestState,
  type UrlIngestState,
} from "./_v2/KbIngestV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

async function ingestUrlAction(
  _prev: UrlIngestState,
  formData: FormData,
): Promise<UrlIngestState> {
  "use server";
  const url = String(formData.get("url") ?? "");
  try {
    const result = await ingestKbFromUrl(url);
    return { status: "ok", result };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

async function ingestSitemapAction(
  _prev: SitemapIngestState,
  formData: FormData,
): Promise<SitemapIngestState> {
  "use server";
  const sitemapUrl = String(formData.get("sitemapUrl") ?? "");
  const limit = Number(formData.get("limit") ?? 10);
  try {
    const result = await ingestKbFromSitemap(sitemapUrl, limit);
    return { status: "ok", result };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export default async function KbIngestExternalPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <KbIngestV2 urlAction={ingestUrlAction} sitemapAction={ingestSitemapAction} />;
}
