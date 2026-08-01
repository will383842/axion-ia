/**
 * Content Generator — bandeau d'onglets du pôle Villes (phase 2 audit UX,
 * 2026-08-01).
 *
 * Quatre pages mesurent la couverture de la production par ville sur le même
 * corpus ContentGenJob, chacune sous un axe différent (carte/départements,
 * palier de population, type de contenu, région, secteur). La sidebar n'expose
 * plus que « Couverture des villes » (coverage-map) ; ce bandeau, posé en tête
 * des cinq pages, matérialise la famille et permet de passer d'un axe à
 * l'autre sans repasser par la nav.
 *
 * Server Component pur — liens simples, 0 JS.
 */

import Link from "next/link";

export type VillesTabKey = "carte" | "paliers" | "types" | "regions" | "secteurs";

const TABS: ReadonlyArray<{ key: VillesTabKey; label: string; path: string }> = [
  { key: "carte", label: "Carte & départements", path: "/content-gen/coverage-map" },
  { key: "paliers", label: "Par palier de population", path: "/content-gen/cities-coverage" },
  { key: "types", label: "Par type de contenu", path: "/content-gen/city-equity" },
  { key: "regions", label: "Production par région", path: "/content-gen/geo" },
  { key: "secteurs", label: "Croisé ville × secteur", path: "/content-gen/geo/coverage-table" },
];

interface Props {
  adminPrefix: string;
  current: VillesTabKey;
}

export function VillesTabsNav({ adminPrefix, current }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const tabBase =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] whitespace-nowrap";
  const tabActive = `${tabBase} bg-[color:var(--color-admin-surface)] font-semibold text-[color:var(--color-admin-fg)]`;
  const tabIdle = `${tabBase} text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg)]`;

  return (
    <nav
      aria-label="Vues de la couverture des villes"
      className="mb-[var(--space-admin-6)] flex flex-wrap gap-[var(--space-admin-2)]"
    >
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`${base}${t.path}`}
          className={t.key === current ? tabActive : tabIdle}
          aria-current={t.key === current ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
