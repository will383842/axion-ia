/**
 * Admin — Qualiopi · Onglets de filtre « actives / archivées / toutes ».
 *
 * POURQUOI
 * --------
 * Les listes `qualiopi/formations` et `qualiopi/offres` affichaient TOUTES les
 * lignes d'un bloc, archives comprises : 57 formations (22 vivantes + 35
 * archivées) et 67 offres (26 actives + 41 inactives). Or une ligne archivée ne
 * peut pas être supprimée — elle porte l'historique légal des sessions,
 * conventions, attestations et factures (conservation 5 ans). Elle doit donc
 * rester consultable, mais ne pas noyer le travail courant.
 *
 * Ce composant rend trois liens de filtre (Server Component, aucun JS envoyé au
 * client) pilotant un paramètre d'URL. Défaut = actives, archives masquées.
 */

import Link from "next/link";

/** Valeur du paramètre d'URL. `actives` est le défaut implicite (param absent). */
export type ArchiveFilter = "actives" | "archivees" | "toutes";

/** Nom du paramètre d'URL porté par les onglets. */
export const ARCHIVE_FILTER_PARAM = "vue";

/**
 * Normalise le paramètre d'URL. Toute valeur inattendue (ou absente) retombe sur
 * `actives` : la vue par défaut ne montre jamais les archives.
 */
export function parseArchiveFilter(raw: string | string[] | undefined): ArchiveFilter {
  const v = typeof raw === "string" ? raw : undefined;
  return v === "archivees" || v === "toutes" ? v : "actives";
}

interface ArchiveFilterTabsProps {
  /** Filtre courant (issu de `parseArchiveFilter`). */
  current: ArchiveFilter;
  /** Chemin de la page, préfixe locale inclus (liens résolus sans redirection). */
  basePath: string;
  /** Compteurs affichés dans chaque onglet. */
  counts: { actives: number; archivees: number };
  /** Libellé du singulier/pluriel décrit (« formation », « offre »). */
  nomEntite: string;
}

const TAB_BASE =
  "rounded-[var(--radius-admin-sm)] border px-[var(--space-admin-3)] py-[var(--space-admin-2)] " +
  "text-[length:var(--text-admin-sm)] font-medium transition-colors";

const TAB_ACTIVE =
  "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-white";

const TAB_IDLE =
  "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)] " +
  "hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-fg)]";

export function ArchiveFilterTabs({
  current,
  basePath,
  counts,
  nomEntite,
}: ArchiveFilterTabsProps) {
  const total = counts.actives + counts.archivees;

  const tabs: ReadonlyArray<{ key: ArchiveFilter; label: string; count: number; href: string }> = [
    // `actives` = défaut → lien SANS paramètre (URL propre, pas de doublon d'état).
    { key: "actives", label: "Actives", count: counts.actives, href: basePath },
    {
      key: "archivees",
      label: "Archivées",
      count: counts.archivees,
      href: `${basePath}?${ARCHIVE_FILTER_PARAM}=archivees`,
    },
    {
      key: "toutes",
      label: "Toutes",
      count: total,
      href: `${basePath}?${ARCHIVE_FILTER_PARAM}=toutes`,
    },
  ];

  return (
    <nav
      aria-label={`Filtrer les ${nomEntite}s`}
      className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`${TAB_BASE} ${t.key === current ? TAB_ACTIVE : TAB_IDLE}`}
        >
          {t.label} <span className="tabular-nums opacity-80">({t.count})</span>
        </Link>
      ))}

      {current === "actives" && counts.archivees > 0 ? (
        <p className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {counts.archivees} {nomEntite}
          {counts.archivees > 1 ? "s" : ""} archivée{counts.archivees > 1 ? "s" : ""} masquée
          {counts.archivees > 1 ? "s" : ""} — conservées pour l&apos;historique légal (sessions,
          conventions, attestations, factures).
        </p>
      ) : null}
    </nav>
  );
}
