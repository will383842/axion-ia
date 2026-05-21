// P0-2 Sprint P5 — Layout content-gen avec CTA "Nouvelle campagne" terracotta
// persistant sur toutes les sous-pages. Visible sur /coverage, /quality, /geo,
// /costs, /jobs, /settings/*, etc.
//
// Sticky top-0 dans le flux admin-main : colle en haut de la zone principale
// lorsque l'utilisateur scrolle vers le bas d'une page longue.

import Link from "next/link";

interface ContentGenLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenLayout({ children, params }: ContentGenLayoutProps) {
  const { adminPrefix } = await params;
  const base = `/fr/${adminPrefix}/content-gen`;

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-6)] py-[var(--space-admin-2)]">
        <nav
          aria-label="Fil d'ariane Content Generator"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          <Link href={base} className="hover:text-[color:var(--color-admin-fg)]">
            Content Generator
          </Link>
        </nav>
        <Link
          href={`${base}/coverage/new`}
          className="admin-button-cta text-[length:var(--text-admin-xs)]"
        >
          + Nouvelle campagne
        </Link>
      </div>
      {children}
    </>
  );
}
