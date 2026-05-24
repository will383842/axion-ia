// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
//
// RSS new V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Sprint correctif SP-01 : error UI via RssFormClient.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { addRssSourceToDb } from "@/server/actions/content-gen/rss-sources";
import { RssFormClient } from "@/components/admin/content-gen/RssFormClient";

interface Props {
  adminPrefix: string;
}

export function RssNewV2({ adminPrefix }: Props): React.ReactElement {
  async function add(formData: FormData) {
    "use server";
    // Note : verticale + language non exposés dans le form V1 du FormClient ;
    // valeurs par défaut sûres (verticale=null = transversal, language=fr).
    // Le wizard étendu viendra Sprint v7+1 si Will veut filtrer par verticale.
    await addRssSourceToDb({
      url: String(formData.get("url") ?? ""),
      name: String(formData.get("name") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pollIntervalMin: Number(formData.get("pollIntervalMin") ?? 60),
      autoPublish: formData.get("autoPublish") === "on",
      enabled: formData.get("enabled") === "on",
      verticale: null,
      language: "fr",
    });
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader title="Nouvelle source RSS" />

      <AdminCard>
        <RssFormClient action={add} />
      </AdminCard>
    </AdminPageShell>
  );
}
