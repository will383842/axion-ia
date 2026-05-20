/**
 * Content Generator — Admin dashboard (Sprint 3 § 12.2 master prompt).
 *
 * Lecture KPIs 7j + état queue + KB health + kill-switch status + quick
 * actions vers les sous-sections. Server Component pur — `force-dynamic`
 * pour toujours afficher les dernières valeurs DB.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardKpis, getSectorBreakdownToday } from "@/server/actions/content-gen/dashboard";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { ContentGenDashboardV2 } from "./_v2/ContentGenDashboardV2";
import type { ContentType, SearchIntent } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ContentGenDashboardV2 adminPrefix={adminPrefix} />;
}


function KpiCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly tone?: "warn" | undefined;
}) {
  return (
    <div
      className="admin-card admin-kpi-card"
      style={tone === "warn" ? { borderColor: "var(--color-terracotta)" } : undefined}
    >
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

function QuickGenForm({
  action,
  contentType,
  targetSearchIntent,
  label,
  inputs,
}: {
  readonly action: (fd: FormData) => Promise<void>;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly label: string;
  readonly inputs: ReadonlyArray<{
    readonly name: string;
    readonly placeholder: string;
    readonly required?: boolean;
  }>;
}) {
  return (
    <form
      action={action}
      style={{
        padding: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <input type="hidden" name="contentType" value={contentType} />
      <input type="hidden" name="targetSearchIntent" value={targetSearchIntent} />
      <strong style={{ fontSize: 14 }}>{label}</strong>
      {inputs.map((i) => (
        <input
          key={i.name}
          type="text"
          name={i.name}
          placeholder={i.placeholder}
          required={i.required ?? false}
          className="admin-input"
          style={{ fontSize: 13 }}
        />
      ))}
      <button type="submit" className="admin-button" style={{ fontSize: 13 }}>
        Lancer →
      </button>
    </form>
  );
}
