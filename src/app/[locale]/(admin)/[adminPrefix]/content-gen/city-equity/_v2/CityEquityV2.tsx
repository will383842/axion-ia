// Page équité contenu villes — matrice ville × type de contenu × nombre de jobs.
// Permet de détecter les déséquilibres géographiques ou par type dans les campagnes.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
} from "@/components/admin/ui";
import {
  getCityContentEquityMatrix,
  getContentTypeEquitySummary,
  type CityEquityRow,
} from "@/server/actions/content-gen/city-equity";

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 ≥100k",
  2: "Tier 2 20-100k",
  3: "Tier 3 10-20k",
  4: "Tier 4 5-10k",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  landing_ville: "Landing ville",
  blog_article: "Blog article",
  blog_from_rss: "Blog RSS",
  blog_from_keywords: "Blog mots-clés",
  blog_from_title: "Blog titre",
  comparison: "Comparatif",
  guide_pilier: "Guide pilier",
  qa_derived: "Q/A dérivé",
  faq_standalone: "FAQ",
};

function cellTone(count: number): string {
  if (count === 0) return "bg-red-50 text-red-700 font-semibold";
  if (count === 1) return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

function EquityRow({
  row,
  contentTypes,
}: {
  row: CityEquityRow;
  contentTypes: ReadonlyArray<string>;
}) {
  return (
    <tr className="border-b border-[color:var(--color-admin-border)] last:border-0 hover:bg-[color:var(--color-admin-surface-hover)]">
      <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium whitespace-nowrap">
        <span>{row.cityName}</span>
        <span className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
          {TIER_LABELS[row.tier] ?? `Tier ${row.tier}`}
        </span>
      </td>
      {contentTypes.map((type) => {
        const count = row.byType[type] ?? 0;
        return (
          <td
            key={type}
            className={`px-[var(--space-admin-2)] py-[var(--space-admin-2)] text-center text-[length:var(--text-admin-sm)] ${cellTone(count)}`}
          >
            {count}
          </td>
        );
      })}
      <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-center text-[length:var(--text-admin-sm)] font-semibold">
        {row.total}
      </td>
      <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-center">
        {row.hasGap ? (
          <AdminBadge tone="destructive">Gap</AdminBadge>
        ) : (
          <AdminBadge tone="success">OK</AdminBadge>
        )}
      </td>
    </tr>
  );
}

interface Props {
  adminPrefix: string;
  campaignId?: string;
  tier?: number;
}

export async function CityEquityV2({ adminPrefix: _adminPrefix, campaignId, tier }: Props) {
  const [matrix, typeSummary] = await Promise.all([
    getCityContentEquityMatrix({
      ...(campaignId !== undefined ? { campaignId } : {}),
      ...(tier !== undefined ? { tier } : {}),
    }),
    getContentTypeEquitySummary(campaignId),
  ]);

  const { rows, contentTypes, totalByType, avgPerCity, gapCitiesCount } = matrix;

  // Grouper les lignes par tier pour affichage
  const tierGroups = new Map<number, CityEquityRow[]>();
  for (const row of rows) {
    if (!tierGroups.has(row.tier)) tierGroups.set(row.tier, []);
    tierGroups.get(row.tier)!.push(row);
  }
  const sortedTiers = [...tierGroups.keys()].sort();

  if (rows.length === 0) {
    return (
      <AdminPageShell>
        <AdminPageHeader
          title="Équité contenu — Villes"
          description="Aucun contenu géolocalisé trouvé. Lancez une campagne de type « ville »."
        />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Équité contenu — Villes"
        description="Matrice ville × type de contenu. Rouge = 0 contenu généré pour ce type."
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-4">
        <AdminStatCard label="Villes couvertes" value={String(rows.length)} />
        <AdminStatCard
          label="Villes avec gap"
          value={String(gapCitiesCount)}
          tone={gapCitiesCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="Moy. contenus/ville" value={avgPerCity.toFixed(1)} />
        <AdminStatCard label="Types de contenus" value={String(contentTypes.length)} />
      </div>

      {/* Résumé par type */}
      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold">
          Résumé par type de contenu
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)] text-left">
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] font-medium">
                  Type
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right font-medium">
                  Total jobs
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right font-medium">
                  Villes couvertes
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right font-medium">
                  Villes manquantes
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right font-medium">
                  Min/Moy/Max
                </th>
              </tr>
            </thead>
            <tbody>
              {typeSummary.map((s) => (
                <tr
                  key={s.contentType}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] font-medium">
                    {CONTENT_TYPE_LABELS[s.contentType] ?? s.contentType}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right">
                    {s.totalJobs}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right text-green-700">
                    {s.citiesWithType}
                  </td>
                  <td
                    className={`px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right ${s.citiesWithoutType > 0 ? "font-semibold text-red-700" : "text-[color:var(--color-admin-fg-soft)]"}`}
                  >
                    {s.citiesWithoutType}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right text-[color:var(--color-admin-fg-soft)]">
                    {s.minPerCity} / {s.avgPerCity.toFixed(1)} / {s.maxPerCity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Matrice détaillée par tier */}
      {sortedTiers.map((tierNum) => {
        const tierRows = tierGroups.get(tierNum) ?? [];
        return (
          <AdminCard key={tierNum} className="mb-[var(--space-admin-4)]">
            <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold">
              {TIER_LABELS[tierNum] ?? `Tier ${tierNum}`}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[length:var(--text-admin-sm)]">
                <thead>
                  <tr className="border-b border-[color:var(--color-admin-border)] text-left">
                    <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] font-medium whitespace-nowrap">
                      Ville
                    </th>
                    {contentTypes.map((type) => (
                      <th
                        key={type}
                        className="px-[var(--space-admin-2)] py-[var(--space-admin-2)] text-center text-[length:var(--text-admin-xs)] font-medium whitespace-nowrap"
                        title={CONTENT_TYPE_LABELS[type] ?? type}
                      >
                        {CONTENT_TYPE_LABELS[type]?.split(" ").slice(-1)[0] ?? type}
                      </th>
                    ))}
                    <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-center font-medium">
                      Total
                    </th>
                    <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-center font-medium">
                      Statut
                    </th>
                  </tr>
                  <tr className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-alt)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                    <td className="px-[var(--space-admin-3)] py-[var(--space-admin-1)] italic">
                      Total tier
                    </td>
                    {contentTypes.map((type) => (
                      <td
                        key={type}
                        className="px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-center font-medium"
                      >
                        {tierRows.reduce((s, r) => s + (r.byType[type] ?? 0), 0)}
                      </td>
                    ))}
                    <td className="px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-center font-semibold">
                      {tierRows.reduce((s, r) => s + r.total, 0)}
                    </td>
                    <td />
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map((row) => (
                    <EquityRow key={row.citySlug} row={row} contentTypes={contentTypes} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[color:var(--color-admin-border)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-soft)]">
                    <td className="px-[var(--space-admin-3)] py-[var(--space-admin-1)]">
                      Total global
                    </td>
                    {contentTypes.map((type) => (
                      <td
                        key={type}
                        className="px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-center"
                      >
                        {totalByType[type] ?? 0}
                      </td>
                    ))}
                    <td className="px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-center">
                      {rows.reduce((s, r) => s + r.total, 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </AdminCard>
        );
      })}
    </AdminPageShell>
  );
}
