import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getAllProspectionConfig } from "@/server/prospection/config/site-settings";
import { getProspectionControllerIdentity } from "@/server/prospection/rgpd/controller-identity";
import {
  triggerProspectionStockIngest,
  triggerAnnuaireSanteIngest,
} from "@/server/actions/prospection/ops";
import { adminPath } from "@/lib/admin-path";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const [config, identity] = await Promise.all([
    getAllProspectionConfig(),
    getProspectionControllerIdentity(),
  ]);
  const settingsHref = adminPath("fr", "settings");

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Réglages"
        description="Quotas, rate-limits, seuils, fraîcheur, budgets de crawl, poids de score, rétention RGPD. L'identité légale est centralisée (voir ci-dessous)."
      />

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">
          Identité du responsable de traitement{" "}
          {identity.productionReady ? (
            <AdminBadge tone="success">complète</AdminBadge>
          ) : (
            <AdminBadge tone="warning">à compléter</AdminBadge>
          )}
        </h2>
        <p className="admin-muted">
          Source unique : <strong>SiteSetting « legal_overrides »</strong>, éditée dans{" "}
          <a href={settingsHref}>Réglages du site → identité légale</a> (la même valeur alimente les
          mentions légales et les factures). Aucune donnée légale n’est saisie ici.
        </p>
        <ul className="admin-list">
          <li>
            Raison sociale : <strong>{identity.legalName}</strong>
          </li>
          <li>
            SIREN : <strong>{identity.siren ?? "— (à renseigner via le Kbis)"}</strong>
          </li>
          <li>
            SIRET (siège) : <strong>{identity.siret ?? "—"}</strong>
          </li>
          <li>
            Siège : <strong>{identity.addressSiege ?? "—"}</strong>
          </li>
          <li>
            Contact public : <strong>{identity.contactEmail}</strong>
          </li>
          <li>
            Contact RGPD / DPO : <strong>{identity.dpoContact}</strong>
          </li>
          <li>
            AIPD validée par : <strong>{identity.aipdValidatedBy || "—"}</strong>
            {identity.aipdValidatedAt ? ` (${identity.aipdValidatedAt})` : ""}
          </li>
        </ul>
        {!identity.productionReady && (
          <p className="admin-alert" role="alert">
            ⚠️ Avant une collecte en production, compléter : {identity.missing.join(", ")}.
          </p>
        )}
      </section>

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Ingestion du Stock Sirene</h2>
        <p className="admin-muted">
          Déclenche l’ingestion du fichier Stock (chemins <code>PROSPECTION_STOCK_*_PATH</code>).
          Peuple la base entreprises + le dénominateur de couverture. À lancer une fois avant les
          campagnes, puis le delta quotidien (4h30) prend le relais.
        </p>
        <form action={triggerProspectionStockIngest}>
          <button type="submit" className="admin-button">
            Lancer l’ingestion Stock
          </button>
        </form>
      </section>

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Ingestion Annuaire Santé / RPPS (spécialités)</h2>
        <p className="admin-muted">
          Récupère directement la <strong>spécialité fine</strong> (cardiologue, ophtalmologue…), le{" "}
          <strong>téléphone</strong> et l’adresse des professionnels de santé — sans crawler leur
          site (peu en ont). Fichier « PS LibreAccès » (<code>PROSPECTION_RPPS_PATH</code>).
        </p>
        <p className="admin-alert" role="note">
          ⚠️ Données <strong>nominatives</strong> de professionnels de santé. L’ingestion est
          bloquée tant que <code>PROSPECTION_SANTE_INGESTION_ENABLED=true</code> n’est pas
          positionné — à ne faire qu’<strong>après validation de l’AIPD dédiée</strong>.
        </p>
        <form action={triggerAnnuaireSanteIngest}>
          <button type="submit" className="admin-button">
            Lancer l’ingestion Santé (RPPS)
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2 className="admin-section-title">Configuration effective</h2>
        <pre style={{ overflow: "auto", padding: "1rem", fontSize: "0.85rem" }}>
          {JSON.stringify(config, null, 2)}
        </pre>
      </section>
    </AdminPageShell>
  );
}
