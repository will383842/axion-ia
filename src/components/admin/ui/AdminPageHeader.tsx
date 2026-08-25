// Refonte admin mai 2026 — PR 2 (ADR 0028, PATTERNS.md §spec).
//
// Header de page standard : titre + description + breadcrumbs + actions.
// Server Component pur (pas d'état).
//
// Pattern canonique master prompt §8.2 — typography admin compacte,
// border-b mocha-soft, tokens --color-admin-* + --space-admin-*.

import { cn } from "@/lib/utils";
import { ID_ACTIONS_PAGE } from "@/lib/ancres-admin";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Composant <AdminBreadcrumbs> ou élément équivalent. */
  breadcrumbs?: React.ReactNode;
  /** Boutons / actions (Button, link, etc.) — alignés à droite. */
  actions?: React.ReactNode;
  /** Badges / statuts (AdminStatusBadge, AdminBadge) — sous le titre. */
  meta?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: AdminPageHeaderProps): React.ReactElement {
  return (
    <header
      className={cn(
        "admin-page-header",
        "border-b border-[color:var(--color-admin-border)]",
        "mb-[var(--space-admin-7,24px)] pb-[var(--space-admin-6,16px)]",
        className,
      )}
    >
      {breadcrumbs ? <div className="mb-[var(--space-admin-4,8px)]">{breadcrumbs}</div> : null}
      {/* 🔴 Empilé sous 640 px, en rangée au-dessus.
          Avant : une rangée unique, sans retour à la ligne, avec un bloc
          d'actions en `shrink-0`. Sur un écran étroit — et le viewport réel de
          Will est sous 1024 px — les boutons refusaient de rétrécir, donc
          c'est le TITRE et la DESCRIPTION qui se faisaient écraser : cinq mots
          par ligne dans une colonne d'un tiers de large, la moitié droite de
          l'écran restant vide. Aucun test ne le voyait ; seule une capture à
          392 px l'a montré.
          Au-dessus de 640 px, le comportement est identique à l'ancien. */}
      <div
        className={cn(
          "flex flex-col gap-[var(--space-admin-3,6px)]",
          "sm:flex-row sm:items-start sm:justify-between sm:gap-[var(--space-admin-6,16px)]",
        )}
      >
        <div className="min-w-0">
          {/* 🔴 `truncate` coupe le titre aux points de suspension sans aucun
              recours : sur un écran étroit — et le viewport réel de Will est
              sous 1024 px — le nom de la fiche ouverte devenait illisible ET
              irrécupérable. C'est la primitive la plus réutilisée de la console
              (145 imports). `title` rend le texte complet accessible au survol
              et aux technologies d'assistance ; le titre reste sur une ligne. */}
          <h1
            title={title}
            className={cn(
              "text-[length:var(--text-admin-xl,22px)] font-bold tracking-tight",
              "leading-[var(--lh-admin-tight,1.4)]",
              "text-[color:var(--color-admin-fg)]",
              "truncate",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-[var(--space-admin-2,4px)]",
                "text-[length:var(--text-admin-base,14px)]",
                "text-[color:var(--color-admin-fg-soft)]",
                "max-w-prose",
              )}
            >
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="mt-[var(--space-admin-3,6px)] flex flex-wrap gap-[var(--space-admin-3,6px)]">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          // `flex-wrap` : plusieurs boutons tiennent sur deux lignes plutôt que
          // de déborder. `shrink-0` ne s'applique qu'à partir de la rangée, où
          // il a un sens ; en colonne il n'aurait servi qu'à empêcher
          // l'ajustement.
          <div
            // 🔴 Cible du lien d'évitement « Aller aux actions ».
            //
            // Sans identifiant, aucun raccourci clavier ne pouvait atteindre
            // les boutons de la page : sur le hub d'une session, ils sont
            // précédés de douze sections et d'une barre de sommaire.
            //
            // `tabIndex` à -1 rend la zone atteignable PAR LE LIEN sans
            // l'insérer dans l'ordre de tabulation — sinon on gagnerait un
            // arrêt parasite sur CHAQUE page de la console, pour un service
            // qui ne sert qu'à celles qui sont longues.
            id={ID_ACTIONS_PAGE}
            tabIndex={-1}
            className={cn(
              "flex flex-wrap items-center gap-[var(--space-admin-3,6px)]",
              "sm:shrink-0 sm:flex-nowrap",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
