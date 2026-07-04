import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getPersonByKey } from "@/server/prospection/admin/queries";
import { logProspectionAccess } from "@/server/actions/prospection/rgpd";

export const dynamic = "force-dynamic";

export default async function PersonneFichePage({
  params,
}: {
  params: Promise<{ adminPrefix: string; personKey: string }>;
}) {
  const { adminPrefix, personKey } = await params;
  const rows = await getPersonByKey(decodeURIComponent(personKey));
  if (rows.length === 0) notFound();
  await logProspectionAccess("view_person", `personKey:${personKey}`).catch(() => {});

  const base = `/fr/${adminPrefix}/prospection`;
  const head = rows[0]!;
  const optedOut = rows.some((r) => r.optOut);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`${head.prenoms ? `${head.prenoms} ` : ""}${head.nom}`}
        description={`Responsable présent dans ${rows.length} entreprise(s). Les occurrences sont reliées par personKey — jamais fusionnées.`}
        breadcrumbs={<Link href={`${base}/personnes`}>← Personnes</Link>}
        meta={optedOut ? <AdminBadge tone="destructive">opposition RGPD</AdminBadge> : undefined}
      />
      <section className="admin-card">
        <h2 className="admin-section-title">Occurrences</h2>
        <ul className="admin-list">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/entreprises/${r.company.siren}`}>
                {r.company.denomination ?? r.company.siren}
              </Link>
              {r.titreVerbatim ? ` — ${r.titreVerbatim}` : ""} ({r.company.departement ?? "—"})
              {r.optOut && " · opposé"}
            </li>
          ))}
        </ul>
        <p className="admin-muted" style={{ marginTop: "1rem" }}>
          Opposition transverse (toutes entreprises) : enregistrez une opposition de type{" "}
          <strong>personKey</strong> = <code>{head.personKey}</code> dans{" "}
          <Link href={`${base}/rgpd`}>RGPD</Link>.
        </p>
      </section>
    </AdminPageShell>
  );
}
