/**
 * Content Generator — Import en masse de sources RSS.
 *
 * Colle un tableau JSON de flux → bulkAddRssSourcesToDb (idempotent). Pré-rempli
 * avec une liste de flux vérifiés accessibles (RSS_STARTER_FEEDS).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { bulkAddRssSourcesToDb } from "@/server/actions/content-gen/rss-sources";
import { RSS_STARTER_FEEDS } from "@/server/content-gen/rss-starter-feeds";
import { RssImportV2, type RssImportState } from "../_v2/RssImportV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ImportRssPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  async function doImport(_prev: RssImportState, formData: FormData): Promise<RssImportState> {
    "use server";
    const rawText = String(formData.get("feeds") ?? "").trim();
    if (!rawText) return { status: "error", message: "Colle au moins un flux (tableau JSON)." };
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        status: "error",
        message: "JSON invalide — vérifie la syntaxe (un tableau d'objets [ { … } ]).",
      };
    }
    if (!Array.isArray(parsed)) {
      return { status: "error", message: "Le JSON doit être un TABLEAU [ … ] de flux." };
    }
    const result = await bulkAddRssSourcesToDb(parsed);
    return { status: "ok", result };
  }

  const defaultJson = JSON.stringify(RSS_STARTER_FEEDS, null, 2);
  return <RssImportV2 defaultJson={defaultJson} action={doImport} />;
}
