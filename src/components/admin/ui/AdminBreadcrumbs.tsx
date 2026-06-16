// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A1 finding #5 / A8 #4).
//
// Breadcrumbs admin a11y avec truncation responsive. Server Component.
//
// Refonte UX content-gen 2026-06-16 (DECISION-IA.md §5 Étape C-3) :
//   Ajout d'un résolveur `buildBreadcrumbsFromPath()` qui dérive le fil
//   d'Ariane depuis le SSOT `admin-nav.ts` — pathname → pôle (subGroup) → page,
//   y compris les niveaux 3 (champ `parent` : on remonte le parent puis le
//   pôle/groupe). Les libellés clairs du SSOT deviennent la SOURCE UNIQUE
//   d'affichage. Les autres sections admin (groupes ≠ content_gen) restent
//   résolues à l'identique : [racine] › [libellé groupe] › [libellé page].
//   Le composant `<AdminBreadcrumbs items={…}>` historique reste inchangé
//   (les pages qui passent `items` manuellement ne sont pas affectées).

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildAdminNav,
  ADMIN_NAV_GROUP_LABELS,
  CONTENT_GEN_POLE_LABELS,
  type AdminNavItem,
} from "@/lib/admin-nav";

export interface AdminBreadcrumbItem {
  label: string;
  /** Optionnel : si absent, item rendu sans lien (typiquement dernier). */
  href?: string;
}

interface AdminBreadcrumbsProps {
  items: ReadonlyArray<AdminBreadcrumbItem>;
  /** Tronque si plus de N items (collapse middle). */
  truncate?: number;
  className?: string;
}

export function AdminBreadcrumbs({
  items,
  truncate = 5,
  className,
}: AdminBreadcrumbsProps): React.ReactElement {
  const displayed: ReadonlyArray<AdminBreadcrumbItem> =
    items.length > truncate && items.length > 0
      ? [items[0] as AdminBreadcrumbItem, { label: "…" } as AdminBreadcrumbItem, ...items.slice(-2)]
      : items;
  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cn(
        "admin-breadcrumbs flex flex-wrap items-center gap-[var(--space-admin-2)]",
        "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        {displayed.map((item, i) => {
          const isLast = i === displayed.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-[var(--space-admin-2)]">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="underline-offset-2 hover:text-[color:var(--color-admin-fg)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-[color:var(--color-admin-fg)]" : ""}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-[color:var(--color-admin-border-strong)]">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Résolution pathname → fil d'Ariane via le SSOT `admin-nav.ts`
// (DECISION-IA.md §5 Étape C-3). Source unique d'affichage = libellés SSOT.
// ──────────────────────────────────────────────────────────────────────────

/** Retire le querystring et le hash, et normalise les slashs de fin. */
function normalizePath(path: string): string {
  const noHash = path.split("#")[0] ?? path;
  const noQuery = noHash.split("?")[0] ?? noHash;
  if (noQuery.length > 1 && noQuery.endsWith("/")) {
    return noQuery.replace(/\/+$/, "");
  }
  return noQuery;
}

/**
 * Aligne un pathname courant sur la convention des hrefs SSOT.
 * Les hrefs SSOT sont toujours préfixés `/fr/<adminPrefix>` ; un pathname
 * runtime peut être en `/en/<adminPrefix>` (avant redirect) → on réécrit la
 * locale en `fr` pour que la comparaison href ↔ pathname soit stable.
 */
function canonicalizeLocale(path: string): string {
  return path.replace(/^\/(?:fr|en)(\/|$)/, "/fr$1");
}

/**
 * Trouve l'item SSOT correspondant à un pathname (match exact sur le href
 * normalisé, querystring ignoré). Retourne `undefined` si aucun item exact.
 */
function findNavItem(pathname: string, nav: ReadonlyArray<AdminNavItem>): AdminNavItem | undefined {
  return nav.find((item) => normalizePath(item.href) === pathname);
}

/**
 * Construit le fil d'Ariane d'une page admin **depuis le SSOT**.
 *
 * Règles :
 *   - racine admin (`/fr/<adminPrefix>`) toujours en tête (libellé du SSOT,
 *     groupe `main`, généralement « Tableau de bord »).
 *   - groupe `content_gen` : on insère le **pôle** (subGroup) entre le libellé
 *     de groupe et la page — [racine] › [Génération de contenu] › [pôle] › [page].
 *   - niveaux 3 (`parent` renseigné, hors sidebar) : on remonte d'abord le
 *     parent (N2) — qui porte le `subGroup`/`group` — puis on chaîne la page N3.
 *   - autres groupes : [racine] › [libellé groupe] › [page].
 *
 * Si le pathname n'est pas connu du SSOT, on retombe sur un fil minimal
 * [racine] (jamais d'erreur). Les pages qui veulent un libellé sur-mesure
 * continuent d'utiliser `<AdminBreadcrumbs items={…}>` directement.
 *
 * @param pathname - chemin courant (avec ou sans querystring/locale).
 * @param adminPrefix - segment admin résolu (cf. src/lib/admin-path.ts).
 */
export function buildBreadcrumbsFromPath(
  pathname: string,
  adminPrefix: string,
): AdminBreadcrumbItem[] {
  const nav = buildAdminNav(adminPrefix);
  const target = normalizePath(canonicalizeLocale(pathname));
  const root = `/fr/${adminPrefix}`;

  // Racine admin — toujours premier crumb. Libellé tiré du SSOT (item `main`
  // dont le href === racine), sinon repli « Tableau de bord ».
  const rootItem = nav.find((item) => normalizePath(item.href) === root);
  const crumbs: AdminBreadcrumbItem[] = [
    { label: rootItem?.label ?? "Tableau de bord", href: root },
  ];

  // La page racine elle-même : le fil se réduit au seul crumb racine (sans lien).
  if (target === root) {
    return [{ label: rootItem?.label ?? "Tableau de bord" }];
  }

  // Résolution de l'item courant. Si introuvable directement, on tente sans
  // tenir compte d'un éventuel item N3 (parent) déjà couvert par findNavItem.
  const current = findNavItem(target, nav);
  if (!current) {
    // Chemin inconnu du SSOT : fil minimal [racine] (jamais d'erreur).
    return crumbs;
  }

  // Remontée éventuelle vers le parent (N3 → N2) avant d'ajouter les niveaux.
  const parentItem = current.parent
    ? findNavItem(normalizePath(canonicalizeLocale(current.parent)), nav)
    : undefined;

  // L'item « porteur de section » (celui qui définit group + subGroup) est le
  // parent s'il existe, sinon l'item courant lui-même.
  const sectionItem = parentItem ?? current;

  // Libellé de groupe (sauf `main`, déjà représenté par la racine).
  // Le groupe content_gen est cliquable (→ tableau de bord) ; les autres ne le
  // sont pas. On construit l'objet sans clé `href` plutôt qu'avec `undefined`
  // (interdit par exactOptionalPropertyTypes).
  if (sectionItem.group !== "main") {
    crumbs.push(
      sectionItem.group === "content_gen"
        ? {
            label: ADMIN_NAV_GROUP_LABELS[sectionItem.group],
            href: `${root}/content-gen`,
          }
        : { label: ADMIN_NAV_GROUP_LABELS[sectionItem.group] },
    );
  }

  // Pôle (content_gen uniquement) : crumb intermédiaire non cliquable
  // (un pôle n'est pas une page, c'est un regroupement de sidebar).
  if (sectionItem.group === "content_gen" && sectionItem.subGroup) {
    crumbs.push({ label: CONTENT_GEN_POLE_LABELS[sectionItem.subGroup] });
  }

  // Page N2 (parent) si on est sur un N3, avec lien cliquable.
  if (parentItem) {
    crumbs.push({ label: parentItem.label, href: normalizePath(parentItem.href) });
  }

  // Page courante (toujours en dernier, sans lien — c'est `aria-current`).
  crumbs.push({ label: current.label });

  return crumbs;
}
