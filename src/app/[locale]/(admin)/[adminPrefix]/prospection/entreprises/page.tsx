import Link from "next/link";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { listCompanies } from "@/server/prospection/admin/queries";
import { logProspectionAccess } from "@/server/actions/prospection/rgpd";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listCompanies>>[number];

export default async function EntreprisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const take = 50;
  const rows = await listCompanies({
    departement: sp.departement,
    secteur: sp.secteur,
    taille: sp.taille,
    contactabilite: sp.contactabilite,
    cursor: sp.cursor,
    take,
  });
  // RGPD — journal d'accès (recherche de données personnelles). Fail-soft.
  await logProspectionAccess("search", JSON.stringify(sp)).catch(() => {});
  const hasMore = rows.length > take;
  const page = rows.slice(0, take);
  const base = `/fr/${adminPrefix}/prospection/entreprises`;
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>,
  );

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    {
      key: "siren",
      header: "SIREN",
      cell: (c) => <Link href={`${base}/${c.siren}`}>{c.siren}</Link>,
    },
    { key: "denomination", header: "Dénomination", cell: (c) => c.denomination ?? "—" },
    { key: "secteur", header: "Secteur", cell: (c) => c.secteur ?? "—" },
    { key: "taille", header: "Taille", cell: (c) => c.taille ?? "—" },
    { key: "dep", header: "Dép.", cell: (c) => c.departement ?? "—" },
    {
      key: "contactabilite",
      header: "Contactabilité",
      cell: (c) => (
        <AdminBadge
          tone={
            c.contactabilite === "exploitable"
              ? "success"
              : c.contactabilite === "partiel"
                ? "warning"
                : "neutral"
          }
        >
          {c.contactabilite ?? "—"}
        </AdminBadge>
      ),
    },
    { key: "leadScore", header: "Score", cell: (c) => c.leadScore ?? "—", align: "right" },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Base entreprises"
        description="Entreprises collectées (diffusibles, non opposées). Filtres par dép./secteur/taille/contactabilité — pagination keyset."
      />
      <form
        method="get"
        className="admin-toolbar"
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}
      >
        <input
          name="departement"
          defaultValue={sp.departement}
          placeholder="Département (ex. 38)"
        />
        <input name="secteur" defaultValue={sp.secteur} placeholder="Secteur (ex. btp)" />
        <input name="taille" defaultValue={sp.taille} placeholder="Taille (ex. PME)" />
        <input
          name="contactabilite"
          defaultValue={sp.contactabilite}
          placeholder="Contactabilité"
        />
        <button type="submit" className="admin-button">
          Filtrer
        </button>
      </form>
      <AdminTable
        columns={columns}
        rows={page}
        getRowId={(c) => c.id}
        emptyState={
          <AdminEmptyState
            title="Aucune entreprise"
            description="Lancez une campagne + le stock Sirene pour peupler la base."
          />
        }
      />
      {hasMore && page.length > 0 && (
        <p style={{ marginTop: "1rem" }}>
          <Link
            className="admin-button"
            href={`${base}?${(() => {
              qs.set("cursor", page[page.length - 1]!.id);
              return qs.toString();
            })()}`}
          >
            Page suivante →
          </Link>
        </p>
      )}
    </AdminPageShell>
  );
}
