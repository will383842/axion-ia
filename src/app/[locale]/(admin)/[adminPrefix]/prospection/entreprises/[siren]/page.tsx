import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getCompanyBySiren } from "@/server/prospection/admin/queries";
import { logProspectionAccess } from "@/server/actions/prospection/rgpd";

export const dynamic = "force-dynamic";

export default async function EntrepriseFichePage({
  params,
}: {
  params: Promise<{ adminPrefix: string; siren: string }>;
}) {
  const { adminPrefix, siren } = await params;
  const company = await getCompanyBySiren(siren);
  if (!company) notFound();
  // RGPD — accès à des données personnelles (fiche + responsables). Fail-soft.
  await logProspectionAccess("view_person", `fiche:${siren}`).catch(() => {});

  const base = `/fr/${adminPrefix}/prospection`;
  const emails = company.contacts.filter((c) => c.type === "email");
  const phones = company.contacts.filter((c) => c.type === "telephone");

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={company.denomination ?? company.nomComplet ?? company.siren}
        description={`SIREN ${company.siren}${company.naf ? ` · NAF ${company.naf}${company.nafLibelle ? ` (${company.nafLibelle})` : ""}` : ""}`}
        breadcrumbs={<Link href={`${base}/entreprises`}>← Base entreprises</Link>}
        meta={
          <>
            {company.contactabilite && (
              <AdminBadge
                tone={
                  company.contactabilite === "exploitable"
                    ? "success"
                    : company.contactabilite === "partiel"
                      ? "warning"
                      : "neutral"
                }
              >
                {company.contactabilite}
                {company.contactabiliteNuance ? ` · ${company.contactabiliteNuance}` : ""}
              </AdminBadge>
            )}
            {company.optOut && <AdminBadge tone="destructive">opposition RGPD</AdminBadge>}
            {company.statutDiffusion && company.statutDiffusion !== "diffusible" && (
              <AdminBadge tone="destructive">non diffusible</AdminBadge>
            )}
          </>
        }
      />

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Identité</h2>
        <ul className="admin-list">
          <li>
            Forme juridique :{" "}
            {company.formeJuridiqueLibelle ?? company.natureJuridiqueLibelle ?? "—"}
          </li>
          <li>
            Taille : {company.taille ?? "—"}{" "}
            {company.trancheEffectif ? `(tranche ${company.trancheEffectif})` : ""}
          </li>
          <li>Secteur : {company.secteur ?? "—"}</li>
          <li>
            Adresse : {company.adresse ?? "—"} {company.codePostal ?? ""} {company.commune ?? ""} (
            {company.departement ?? "—"})
          </li>
          <li>
            Site web :{" "}
            {company.siteWeb ? (
              <a href={company.siteWeb} target="_blank" rel="noreferrer nofollow">
                {company.siteWeb}
              </a>
            ) : (
              "— (non découvert)"
            )}
          </li>
          <li>
            Score : {company.leadScore ?? "—"} · Enrichissement : {company.enrichmentStatus}
          </li>
        </ul>
      </section>

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Coordonnées</h2>
        <p>
          Email public : {company.emailPublic ?? "—"} · Téléphone public :{" "}
          {company.telephonePublic ?? "—"}
        </p>
        <ul className="admin-list">
          {emails.map((c) => (
            <li key={c.id}>
              ✉️ {c.value} <AdminBadge tone="neutral">{c.verifStatus ?? "?"}</AdminBadge>
            </li>
          ))}
          {phones.map((c) => (
            <li key={c.id}>📞 {c.value}</li>
          ))}
          {emails.length === 0 && phones.length === 0 && (
            <li className="admin-muted">Aucune coordonnée enrichie.</li>
          )}
        </ul>
      </section>

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Responsables ({company.persons.length})</h2>
        {company.persons.length === 0 ? (
          <p className="admin-muted">
            Aucun responsable capté (site non découvert ou pas de page équipe).
          </p>
        ) : (
          <ul className="admin-list">
            {company.persons.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/personnes/${encodeURIComponent(p.personKey)}`}>
                  {p.prenoms ? `${p.prenoms} ` : ""}
                  {p.nom}
                </Link>
                {p.titreVerbatim ? ` — ${p.titreVerbatim}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card">
        <h2 className="admin-section-title">Établissements ({company.establishments.length})</h2>
        <ul className="admin-list">
          {company.establishments.map((e) => (
            <li key={e.id}>
              {e.estSiege ? "🏛️ (siège) " : ""}
              {e.siret} — {e.adresse ?? ""} {e.codePostal ?? ""} {e.commune ?? ""}
            </li>
          ))}
        </ul>
        <p className="admin-muted" style={{ marginTop: "1rem" }}>
          Pour retirer cette entreprise, enregistrez une opposition (SIREN {company.siren}) dans{" "}
          <Link href={`${base}/rgpd`}>RGPD</Link>.
        </p>
      </section>
    </AdminPageShell>
  );
}
