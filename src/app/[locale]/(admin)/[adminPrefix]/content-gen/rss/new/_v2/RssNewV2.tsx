// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// RSS new V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Sprint correctif SP-01 : error UI via RssFormClient.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { addRssSource } from "@/server/actions/content-gen/rss";
import { RssFormClient } from "@/components/admin/content-gen/RssFormClient";

interface Props {
  adminPrefix: string;
}

export function RssNewV2({ adminPrefix }: Props): React.ReactElement {
  async function add(formData: FormData) {
    "use server";
    await addRssSource({
      url: String(formData.get("url") ?? ""),
      name: String(formData.get("name") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pollIntervalMin: Number(formData.get("pollIntervalMin") ?? 60),
      autoPublish: formData.get("autoPublish") === "on",
      enabled: formData.get("enabled") === "on",
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
