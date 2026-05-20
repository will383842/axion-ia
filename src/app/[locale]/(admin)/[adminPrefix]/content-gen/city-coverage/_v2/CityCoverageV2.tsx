// Sprint City Quality 6 pilote 2026-05-18 — dashboard couverture villes V2 (FOND).
//
// Recadrage Will 2026-05-18 soir : on mesure la MATIÈRE disponible pour
// ContentGen (data INSEE + secteurs NAF + pôles compétitivité + distances
// + KB sectorielles), pas la copy rédigée des landing pages (Phase C).
//
// Convention V2 (cf. ADR 0028) : AdminPageShell + AdminPageHeader +
// AdminStatCard + AdminCard + AdminBadge.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
} from "@/components/admin/ui";
import {
  getCityCoverage,
  type CityCoverageRow,
  type CityDimension,
  type CriterionStatus,
} from "@/server/actions/content-gen/city-coverage";

interface Props {
  adminPrefix: string;
}

function statusEmoji(status: CriterionStatus): string {
  if (status === "green") return "🟢";
  if (status === "yellow") return "🟡";
  return "🔴";
}

function dimensionTone(scorePct: number): "success" | "warning" | "destructive" {
  if (scorePct >= 100) return "success";
  if (scorePct >= 50) return "warning";
  return "destructive";
}

function formatPct(n: number): string {
  return `${Math.round(n)} %`;
}

function CityDimensionCell({ dim }: { dim: CityDimension }): React.ReactElement {
  const tone = dimensionTone(dim.scorePct);
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <AdminBadge tone={tone}>{formatPct(dim.scorePct)}</AdminBadge>
      <ul className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
        {dim.criteria.map((c) => (
          <li key={c.id} className="flex items-start gap-[var(--space-admin-2)]">
            <span aria-hidden="true">{statusEmoji(c.status)}</span>
            <span className="min-w-0">
              <span className="block">
                {c.label}
                {c.sourced ? (
                  <span
                    aria-label="Donnée sourcée vérifiable"
                    title="Donnée sourcée vérifiable"
                    className="ml-[var(--space-admin-2)]"
                  >
                    🔗
                  </span>
                ) : null}
              </span>
              {c.detail ? (
                <span className="block text-[color:var(--color-admin-fg-muted)]">{c.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CityRowDetail({ row }: { row: CityCoverageRow }): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-admin-5)] md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
      {row.dimensions.map((dim) => (
        <div key={dim.id} className="flex flex-col gap-[var(--space-admin-3)]">
          <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            {dim.label}
          </h3>
          <CityDimensionCell dim={dim} />
        </div>
      ))}
    </div>
  );
}

export async function CityCoverageV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const summary = await getCityCoverage();
  const base = `/fr/${adminPrefix}/content-gen`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Couverture villes pilote (City Quality — fond)"
        description={`Sprint manuel 2026-05-18 — ${summary.totals.totalCities} villes pilote · ${summary.totals.indexableCities} indexables · ${summary.totals.perfectCities} parfaites. Mesure la MATIÈRE data disponible pour ContentGen (pas la copy rédigée).`}
        actions={
          <Link href={`${base}/coverage`} className="admin-button">
            Voir campagnes ContentGen
          </Link>
        }
      />

      {/* ── KPIs synthèse ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Villes pilote"
          value={summary.totals.totalCities}
          meta={`sur ${summary.totalCitiesInBase.toLocaleString("fr-FR")} villes INSEE en base`}
        />
        <AdminStatCard
          label="Indexables Google"
          value={`${summary.totals.indexableCities} / ${summary.totals.totalCities}`}
          tone={
            summary.totals.indexableCities === summary.totals.totalCities ? "success" : "warning"
          }
          meta="secteurs NAF sourcés présents"
        />
        <AdminStatCard
          label="Score moyen data"
          value={formatPct(summary.totals.avgScorePct)}
          tone={dimensionTone(summary.totals.avgScorePct)}
          meta={`${summary.totals.totalCriteriaGreen} / ${summary.totals.totalCriteria} critères verts`}
        />
        <AdminStatCard
          label="Parfaitement sourcées"
          value={`${summary.totals.perfectCities} / ${summary.totals.totalCities}`}
          tone={summary.totals.perfectCities === summary.totals.totalCities ? "success" : "warning"}
          meta="18 / 18 critères verts"
        />
      </div>

      {/* ── Détail par ville ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-[var(--space-admin-6)]">
        {summary.rows.map((row) => (
          <AdminCard key={row.slug} as="article" className="overflow-hidden">
            <header className="mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-3)]">
              <div className="flex flex-wrap items-baseline gap-[var(--space-admin-4)]">
                <span className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
                  {row.nameFr}
                </span>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  INSEE {row.inseeCode} · pop. {row.population.toLocaleString("fr-FR")} ·{" "}
                  {row.region}
                </span>
                <AdminBadge tone={row.indexable ? "success" : "destructive"}>
                  {row.indexable ? "Indexable (data métier)" : "Data métier manquante"}
                </AdminBadge>
                <AdminBadge tone={dimensionTone(row.globalScorePct)}>
                  {formatPct(row.globalScorePct)} · {row.greenCount}/{row.totalCriteria}
                </AdminBadge>
                {row.lastReviewedOn ? (
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    Revu {row.lastReviewedOn}
                    {row.reviewedBy ? ` par ${row.reviewedBy}` : ""}
                  </span>
                ) : (
                  <AdminBadge tone="outline">Non revu</AdminBadge>
                )}
              </div>
              <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Critère vert = donnée présente et sourcée vérifiablement. Jaune = présent mais sans
                source ou en dessous du seuil. Rouge = absent.
              </span>
            </header>
            <CityRowDetail row={row} />
            <div className="mt-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              <span>
                Data enrichie : <code>src/content/villes/economic-data/{row.slug}.ts</code>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Data INSEE (auto-générée) :{" "}
                <code>src/content/villes/data/&lt;region&gt;.ts</code>
              </span>
            </div>
          </AdminCard>
        ))}
      </div>

      {/* ── Légende méthodologique ───────────────────────────────────── */}
      <AdminCard as="section" className="mt-[var(--space-admin-6)]">
        <header className="mb-[var(--space-admin-4)]">
          <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Comment ce tableau est calculé
          </h2>
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Lecture pure de fichiers TS curatés. Zéro DB, zéro API externe. Contrat zéro invention.
          </p>
        </header>
        <ul className="flex flex-col gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          <li>
            <strong>8 dimensions × 18 critères</strong> : identité INSEE (1), économie (2),
            innovation & talents (3), tissu entreprises TPE→GE (3), patrimoine & terroir (4),
            rayonnement local (2), infrastructure transport (2), KB sectorielle (1).
          </li>
          <li>
            <strong>Multi-taille TPE/PME/ETI/GE</strong> : chaque taille d&apos;entreprise trouve
            au moins 2 champs qui lui parlent directement (EPV pour TPE/artisans, zones
            d&apos;activité pour PME, grandes écoles pour ETI, grands groupes pour GE).
          </li>
          <li>
            <strong>Indexable Google</strong> = secteurs NAF sourcés présents (matière métier
            minimum pour ContentGen ; sinon la page serait du bruit anti-duplicate).
          </li>
          <li>
            <strong>Contrat zéro invention</strong> : chaque entrée data doit avoir un champ{" "}
            <code>source</code> (URL INSEE, competitivite.gouv.fr, CCI locale, Wikipédia,
            site officiel pôle). Sans source → champ vide. Le badge 🔗 indique sourcé.
          </li>
          <li>
            <strong>Fond avant forme</strong> : on remplit la matière (data + KB sectorielles)
            d&apos;abord. La copy rédigée pour landing pages se fait Phase C, ContentGen RAG
            composera à partir de cette matière.
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
