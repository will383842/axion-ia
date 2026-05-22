// P1-2 Sprint P5 - Campaign presets list (6 presets D-P5-1).
// Server Component. Falls back to static list when DB empty (before first seed).
// P5.5 — config preview (verticals, types, batchSize, dailyCap) sur chaque card.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

interface PresetRow {
  slug: string;
  name: string;
  description: string;
  config?: {
    verticals?: string[];
    types?: string[];
    batchSize?: number;
    dailyCap?: number;
  };
}

const SECTOR_SHORT: Record<string, string> = {
  audits: "Audits",
  interventions_formations: "Interventions",
  implementations: "Implantations",
  un_a_un: "1-à-1",
  sites_web_augmentes: "Web IA",
};

const TYPE_SHORT: Record<string, string> = {
  blog_pillar: "Pilier",
  landing_ville: "Landing ville",
  blog_from_title: "Blog titre",
  blog_from_rss: "Blog RSS",
  blog_from_keywords: "Blog kw",
  qa_derived: "FAQ",
  comparison: "Comparatif",
};

const FALLBACK_PRESETS: PresetRow[] = [
  { slug: "pme-audits", name: "PME audits", description: "Campagne audit IA pour PME - blog pilier + landing ville.", config: { verticals: ["audits"], types: ["blog_pillar", "landing_ville"], batchSize: 20, dailyCap: 30 } },
  { slug: "interventions-weekly", name: "Interventions weekly", description: "Articles hebdo interventions formations PME/ETI.", config: { verticals: ["interventions_formations"], types: ["blog_from_title", "blog_from_rss"], batchSize: 10, dailyCap: 14 } },
  { slug: "tpe-burst", name: "TPE burst", description: "Burst articles interventions+audits TPE.", config: { verticals: ["interventions_formations", "audits"], types: ["blog_from_keywords"], batchSize: 50, dailyCap: 50 } },
  { slug: "eti-pilier", name: "ETI pilier", description: "Articles pilier haute qualité ETI.", config: { verticals: ["implementations"], types: ["blog_pillar"], batchSize: 5, dailyCap: 5 } },
  { slug: "cities-paris", name: "Cities Paris", description: "Landing pages ville ancrées Paris.", config: { verticals: ["audits", "interventions_formations"], types: ["landing_ville"], batchSize: 15, dailyCap: 20 } },
  { slug: "rss-daily", name: "RSS daily", description: "Blog depuis RSS quotidien 7h.", config: { verticals: ["interventions_formations"], types: ["blog_from_rss"], batchSize: 7, dailyCap: 7 } },
];

export async function CampaignPresetsV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;

  let presets: PresetRow[] = FALLBACK_PRESETS;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any).campaignTemplate.findMany({
      where: { isActive: true },
      orderBy: { slug: "asc" as const },
    });
    if (rows.length > 0) {
      presets = rows as PresetRow[];
    }
  } catch {
    // DB not yet seeded or model not yet migrated - use fallback
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Presets de campagnes"
        description={`${presets.length} presets disponibles. Sélectionnez un preset pour pré-remplir le wizard.`}
        actions={
          <Link href={`${base}/coverage/new`} className="admin-button">
            Nouvelle campagne libre
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p) => {
          const cfg = p.config ?? {};
          const verticals = (cfg.verticals ?? []).map((v) => SECTOR_SHORT[v] ?? v);
          const types = (cfg.types ?? []).map((t) => TYPE_SHORT[t] ?? t);
          return (
            <AdminCard key={p.slug}>
              <h2 className="admin-h2 mb-[var(--space-admin-2)]">{p.name}</h2>
              <p className="admin-meta mb-[var(--space-admin-3)]">{p.description}</p>
              {(verticals.length > 0 || cfg.batchSize) && (
                <ul className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)] space-y-[var(--space-admin-1)]">
                  {verticals.length > 0 && (
                    <li>
                      <span className="font-medium">Verticales :</span>{" "}
                      {verticals.join(", ")}
                    </li>
                  )}
                  {types.length > 0 && (
                    <li>
                      <span className="font-medium">Types :</span>{" "}
                      {types.join(", ")}
                    </li>
                  )}
                  {cfg.batchSize != null && (
                    <li>
                      <span className="font-medium">Batch :</span> {cfg.batchSize} articles
                    </li>
                  )}
                  {cfg.dailyCap != null && (
                    <li>
                      <span className="font-medium">Cap/jour :</span> {cfg.dailyCap} articles
                    </li>
                  )}
                </ul>
              )}
              <Link
                href={`${base}/coverage/new?preset=${p.slug}`}
                className="admin-button-cta block text-center"
              >
                Utiliser ce preset
              </Link>
            </AdminCard>
          );
        })}
      </div>
    </AdminPageShell>
  );
}
