// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Helper V2 partagé pour les 9 sous-pages stub image-bank
// (analytics, bulk-import, categories, licensing, seo-audit, settings,
// sitemap-status, tags, taxonomy). Migre AdminStubPage vers primitives
// admin/ui (AdminPageShell + AdminPageHeader + AdminCard).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

interface Props {
  title: string;
  description: string;
  back: string;
  sprint?: string;
}

export function AdminStubPageV2({ title, description, back, sprint }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <Link href={back} className="admin-link">
            ← Retour image-bank overview
          </Link>
        }
      />
      <AdminCard className="border-l-4 border-l-[color:var(--color-admin-warning)]">
        <p className="admin-meta-block">
          Cette section est prévue {sprint ?? "Sprint 2.x"}. L&apos;ancre route et la nav admin sont
          déjà câblées.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
