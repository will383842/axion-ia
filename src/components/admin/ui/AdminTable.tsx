// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A2 critère 8 / A3 finding #3).
//
// Table générique typée admin : header sticky, sortable, row hover, empty
// fallback. La sélection bulk (checkbox) et les actions par ligne sont des
// extensions ajoutées en PR 4 (AdminBulkActions).
//
// Server Component (sort/filter passent par URL searchParams côté consumer,
// pas de state interne). La pagination est un composant séparé
// (<AdminPagination> en PR 4).

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AdminTableColumn<T> {
  /** Identifiant unique de la colonne (utilisé pour aria-sort + sort URL). */
  key: string;
  header: string;
  /** Rendu de la cellule pour une ligne donnée. */
  cell: (row: T) => React.ReactNode;
  /** Active le tri (consumer doit gérer le sort via searchParams). */
  sortable?: boolean;
  /** Largeur fixe (px) ou pourcentage. */
  width?: string;
  align?: "left" | "right" | "center";
  /** Cache la colonne sous un breakpoint (Tailwind). */
  hiddenBelow?: "sm" | "md" | "lg";
}

interface AdminTableProps<T> {
  columns: ReadonlyArray<AdminTableColumn<T>>;
  rows: ReadonlyArray<T>;
  getRowId: (row: T) => string;
  /** Colonne actions (déroulant, lien détail) en dernière colonne. */
  rowAction?: (row: T) => React.ReactNode;
  /**
   * Rend la LIGNE ENTIÈRE cliquable (lien étiré) vers l'href retourné.
   * Opt-in : à n'utiliser que sur des listes SANS élément interactif en cellule
   * (le lien étiré recouvre la ligne). Clic n'importe où → ouvre le détail.
   */
  rowHref?: (row: T) => string | undefined;
  /**
   * Sort actuel (passé via searchParams) — utilisé pour aria-sort uniquement.
   * Le consumer fabrique les href triés (pas de mutation côté table).
   */
  currentSort?: { column: string; direction: "asc" | "desc" };
  /** Fallback empty (généralement <AdminEmptyState>). */
  emptyState?: React.ReactNode;
  /** Caption table (sr-only ou visible selon le consumer). */
  caption?: string;
  className?: string;
}

const HIDDEN_CLASS: Record<NonNullable<AdminTableColumn<unknown>["hiddenBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const ALIGN_CLASS: Record<NonNullable<AdminTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function AdminTable<T>({
  columns,
  rows,
  getRowId,
  rowAction,
  rowHref,
  currentSort,
  emptyState,
  caption,
  className,
}: AdminTableProps<T>): React.ReactElement {
  if (rows.length === 0 && emptyState) {
    return <div className="admin-table-empty-wrapper">{emptyState}</div>;
  }
  return (
    <div
      className={cn(
        "admin-table-wrapper w-full overflow-x-auto",
        // Modernisation 2026-07-08 (style SOS) : radius xl + ombre douce = table
        // "carte" au lieu du cadre plat.
        "rounded-[var(--radius-admin-xl)] border border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper)] shadow-[var(--shadow-admin-1)]",
        className,
      )}
    >
      <table className="w-full border-collapse text-[length:var(--text-admin-base)]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => {
              const ariaSort =
                currentSort?.column === col.key
                  ? currentSort.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : col.sortable
                    ? "none"
                    : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
                    "text-[length:var(--text-admin-xs)] font-semibold tracking-wide whitespace-nowrap uppercase",
                    "text-[color:var(--color-admin-fg-muted)]",
                    // Refonte UI 2026-08-01 (couche 2) — fond creusé sur la
                    // ligne d'en-tête : sans lui, l'en-tête et la première
                    // ligne de données étaient deux bandes blanches séparées
                    // par un simple filet, et le regard ne trouvait pas où
                    // commençaient les données. Aligné sur `.admin-table`,
                    // pour que les tableaux « legacy » et ceux issus de ce
                    // composant se ressemblent sur une même page.
                    "bg-[color:var(--color-admin-surface-sunken)]",
                    "border-b border-[color:var(--color-admin-border)]",
                    col.align ? ALIGN_CLASS[col.align] : "text-left",
                    col.hiddenBelow ? HIDDEN_CLASS[col.hiddenBelow] : "",
                  )}
                >
                  {col.header}
                </th>
              );
            })}
            {rowAction ? (
              <th
                scope="col"
                className={cn(
                  "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
                  "bg-[color:var(--color-admin-surface-sunken)]",
                  "border-b border-[color:var(--color-admin-border)]",
                )}
              >
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const href = rowHref?.(row);
            return (
              <tr
                key={id}
                className={cn(
                  "transition-colors",
                  "hover:bg-[color:var(--color-admin-surface-hover)]",
                  // Ligne entière cliquable : `relative` établit le contexte pour
                  // le lien étiré (absolute inset-0) placé dans la 1re cellule.
                  href && "relative cursor-pointer",
                )}
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-[var(--space-admin-5)] py-[var(--space-admin-5)]",
                      "text-[color:var(--color-admin-fg)]",
                      "border-b border-[color:var(--color-admin-border)]",
                      col.align ? ALIGN_CLASS[col.align] : "text-left",
                      col.hiddenBelow ? HIDDEN_CLASS[col.hiddenBelow] : "",
                    )}
                  >
                    {ci === 0 && href ? (
                      <Link
                        href={href}
                        aria-label="Ouvrir le détail"
                        className="absolute inset-0 z-[1] rounded-[var(--radius-admin-md)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:outline-none"
                      />
                    ) : null}
                    {col.cell(row)}
                  </td>
                ))}
                {rowAction ? (
                  <td
                    className={cn(
                      "px-[var(--space-admin-5)] py-[var(--space-admin-5)] text-right",
                      "border-b border-[color:var(--color-admin-border)]",
                    )}
                  >
                    {rowAction(row)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
