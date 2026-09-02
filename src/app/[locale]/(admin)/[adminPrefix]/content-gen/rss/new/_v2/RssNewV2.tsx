// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
//
// RSS new V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Sprint correctif SP-01 : error UI via RssFormClient.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { addRssSourceToDb, type RssSourceInput } from "@/server/actions/content-gen/rss-sources";
import { RssFormClient } from "@/components/admin/content-gen/RssFormClient";
import { RSS_LANGUAGE_DEFAULT } from "@/components/admin/content-gen/rss-verticale-options";

interface Props {
  adminPrefix: string;
}

export function RssNewV2({ adminPrefix }: Props): React.ReactElement {
  async function add(formData: FormData) {
    "use server";
    // Audit console 2026-09-02 — verticale + langue sont désormais saisies au
    // formulaire (comme à l'édition) ; l'action serveur les acceptait déjà
    // (`RssSourceInputSchema`), elles étaient simplement forcées ici à
    // « transversal / fr ». Mêmes lectures que `RssDetailV2.update`.
    const verticaleRaw = String(formData.get("verticale") ?? "");
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
      verticale: verticaleRaw === "" ? null : (verticaleRaw as RssSourceInput["verticale"]),
      language: String(formData.get("language") ?? RSS_LANGUAGE_DEFAULT),
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
