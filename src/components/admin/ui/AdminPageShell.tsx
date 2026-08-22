// Refonte admin mai 2026 — PR 2 (ADR 0028, PATTERNS.md §1).
//
// Wrapper standard de page admin. Server Component pur (pas d'état).
// Variante `width="narrow"` pour les pages formulaire.
//
// Usage canonique :
//   <AdminPageShell>
//     <AdminPageHeader title="..." />
//     <AdminToolbar filters={...} />
//     <Suspense fallback={<AdminLoadingState variant="table" />}>
//       <DataTable />
//     </Suspense>
//   </AdminPageShell>

import { cn } from "@/lib/utils";

interface AdminPageShellProps {
  children: React.ReactNode;
  /**
   * Largeur du contenu :
   * - "full" (default) : max-width 1440px (refonte largeur juin 2026 — était
   *   1280px, mais le cap réel était 960px car le conteneur portait
   *   `.admin-main` (admin.css:894, max-width:960px). Cap levé côté layout V2 ;
   *   le shell
   *   redevient la SSOT de largeur. 1440px = densité dashboard 2026 sans
   *   lignes de tableau trop longues).
   * - "narrow" : max-width 720px (formulaires longs, settings).
   * - "wide" : sans contrainte (tables très denses, content-gen jobs).
   */
  width?: "full" | "narrow" | "wide";
  className?: string;
}

const WIDTH_CLASS: Record<NonNullable<AdminPageShellProps["width"]>, string> = {
  full: "max-w-[1440px]",
  narrow: "max-w-[720px]",
  wide: "max-w-none",
};

export function AdminPageShell({
  children,
  width = "full",
  className,
}: AdminPageShellProps): React.ReactElement {
  return (
    <section
      className={cn(
        "admin-page-shell mx-auto w-full",
        WIDTH_CLASS[width],
        "px-[var(--space-admin-6,16px)] py-[var(--space-admin-7,24px)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
