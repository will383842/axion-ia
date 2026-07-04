import Link from "next/link";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { countContactsByTab, listCompanies } from "@/server/prospection/admin/queries";
import { logProspectionAccess } from "@/server/actions/prospection/rgpd";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "exploitable", label: "✅ Prêts à l'emploi" },
  { key: "partiel", label: "🟡 À enrichir" },
  { key: "non_contactable", label: "🔴 Non contactables" },
] as const;

type Row = Awaited<ReturnType<typeof listCompanies>>[number];

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { adminPrefix } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.find((t) => t.key === rawTab)?.key ?? "exploitable") as string;
  const base = `/fr/${adminPrefix}/prospection/contacts`;

  const [counts, rows] = await Promise.all([
    countContactsByTab(),
    listCompanies({ contactabilite: tab, take: 50 }),
  ]);
  await logProspectionAccess("search", `contacts:${tab}`).catch(() => {});

  const countOf: Record<string, number> = {
    exploitable: counts.exploitable,
    partiel: counts.partiel,
    non_contactable: counts.nonContactable,
  };

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    { key: "denomination", header: "Entreprise", cell: (c) => c.denomination ?? c.siren },
    { key: "email", header: "Email", cell: (c) => c.emailPublic ?? "—" },
    { key: "tel", header: "Téléphone", cell: (c) => c.telephonePublic ?? "—" },
    {
      key: "nuance",
      header: "Type",
      cell: (c) => <AdminBadge tone="neutral">{c.contactabiliteNuance ?? "—"}</AdminBadge>,
    },
    { key: "score", header: "Score", cell: (c) => c.leadScore ?? "—", align: "right" },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Contacts"
        description="Entreprises regroupées par exploitabilité (nominatif vs générique)."
      />
      <nav className="admin-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${base}?tab=${t.key}`}
            className={`admin-tab ${tab === t.key ? "admin-tab-active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label} ({(countOf[t.key] ?? 0).toLocaleString("fr-FR")})
          </Link>
        ))}
      </nav>
      <AdminTable
        columns={columns}
        rows={rows.slice(0, 50)}
        getRowId={(c) => c.id}
        emptyState={<AdminEmptyState title="Aucun contact dans cet onglet" />}
      />
    </AdminPageShell>
  );
}
