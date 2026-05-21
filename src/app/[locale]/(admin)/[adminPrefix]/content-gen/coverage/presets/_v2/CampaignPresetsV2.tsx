// P1-2 Sprint P5 - Campaign presets list (6 presets D-P5-1).
// Server Component. Falls back to static list when DB empty (before first seed).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

const FALLBACK_PRESETS = [
  { slug: "pme-audits", name: "PME audits", description: "Campagne audit IA pour PME - blog pilier + landing ville." },
  { slug: "interventions-weekly", name: "Interventions weekly", description: "Articles hebdo interventions formations PME/ETI." },
  { slug: "tpe-burst", name: "TPE burst", description: "Burst articles interventions+audits TPE." },
  { slug: "eti-pilier", name: "ETI pilier", description: "Articles pilier haute qualite ETI." },
  { slug: "cities-paris", name: "Cities Paris", description: "Landing pages ville ancrees Paris." },
  { slug: "rss-daily", name: "RSS daily", description: "Blog depuis RSS quotidien 7h." },
] as const;

export async function CampaignPresetsV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;

  // Load presets from DB, fall back to static list if empty/unavailable
  let presets: ReadonlyArray<{ slug: string; name: string; description: string }> = FALLBACK_PRESETS;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any).campaignTemplate.findMany({
      where: { isActive: true },
      orderBy: { slug: "asc" as const },
    });
    if (rows.length > 0) {
      presets = rows as ReadonlyArray<{ slug: string; name: string; description: string }>;
    }
  } catch {
    // DB not yet seeded or model not yet migrated - use fallback
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Presets de campagnes"
        description={`${presets.length} presets disponibles. Selectionnez un preset pour pre-remplir le wizard.`}
        actions={
          <Link href={`${base}/coverage/new`} className="admin-button">
            Nouvelle campagne libre
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p) => (
          <AdminCard key={p.slug}>
            <h2 className="admin-h2 mb-[var(--space-admin-2)]">{p.name}</h2>
            <p className="admin-meta mb-[var(--space-admin-4)]">{p.description}</p>
            <Link
              href={`${base}/coverage/new?preset=${p.slug}`}
              className="admin-button-cta block text-center"
            >
              Utiliser ce preset
            </Link>
          </AdminCard>
        ))}
      </div>
    </AdminPageShell>
  );
}
