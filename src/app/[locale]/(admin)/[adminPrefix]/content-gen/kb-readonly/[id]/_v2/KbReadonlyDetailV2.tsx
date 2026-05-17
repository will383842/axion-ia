// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// KB readonly detail V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

interface EntryData {
  id: string;
  slug: string;
  type: string;
  audience: string;
  status: string;
  fr: { title: string; bodyText: string | null; body: string | null } | null;
}

interface Props {
  adminPrefix: string;
  entry: EntryData;
}

export function KbReadonlyDetailV2({ adminPrefix, entry }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title={entry.fr?.title ?? entry.slug}
        description={`${entry.slug} · ${entry.type} · audience ${entry.audience} · ${entry.status}`}
        actions={
          <Link
            href={`/fr/${adminPrefix}/connaissances/${entry.id}`}
            className="admin-button-ghost"
          >
            Éditer dans /connaissances (skill)
          </Link>
        }
      />

      <AdminCard>
        <h2 className="admin-h2">Aperçu FR</h2>
        <pre className="max-h-[600px] overflow-auto text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
          {(entry.fr?.bodyText ?? entry.fr?.body ?? "").slice(0, 5000)}
        </pre>
      </AdminCard>
    </AdminPageShell>
  );
}
