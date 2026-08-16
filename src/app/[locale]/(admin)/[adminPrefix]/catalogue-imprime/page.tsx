// Admin — relecture du catalogue imprimé AVANT tirage KDP.
//
// POURQUOI CETTE PAGE (2026-08-16, demande Will)
//
// Le catalogue papier est distribué en main propre : un prix faux ne se corrige
// pas. Depuis le branchement SSOT (`scripts/export-catalogue-kdp.ts`), les FAITS
// du livre — prix, durée, titre, format, accroche — viennent d'ici, du site.
// Cette page les affiche exactement comme ils partiront à l'impression, pour
// qu'on puisse les relire sans ouvrir un PDF de 20 Mo.
//
// CE QU'ELLE NE MONTRE PAS, ET POURQUOI
//
// Pas l'état des 4 PDF KDP. Ils vivent hors dépôt, sur le poste de fabrication
// (`Catalogue_formations_Axion_IA/catalogue-kdp`) ; la console tourne dans un
// conteneur en production et n'y a aucun accès. Afficher une fraîcheur qu'on ne
// peut pas mesurer serait pire que de ne rien afficher — on croirait le
// catalogue à jour. Décision Will 2026-08-16 : relire le contenu, pas les
// fichiers.
//
// L'ÉCRITURE DU LIVRE N'EST PAS ICI NON PLUS. Objectifs, lignes avant/après,
// rubrique et effectif sont figés côté générateur (`objectifs-livre.cjs`,
// `prose-livre.cjs`) parce qu'ils sont écrits pour le papier — les objectifs du
// site font 225 caractères contre 58 pour ceux du livre, les verser tels quels
// ferait déborder les cadres. Cette page dit donc ce que le SITE pilote.
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { FORMATIONS_V2, type FormationV2 } from "@/content/formations/catalog-v2";
import {
  formatDureeFr,
  getFormationModalites,
  formatModalitesFr,
} from "@/content/formations/catalog-v2-facts";
import { formatFormationPrice } from "@/content/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Catalogue imprimé · Axion-IA" };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

/**
 * ⚠️ La matrice tarifaire est indexée par `categorie`, PAS par `gamme` — les
 * deux champs existent sur FormationV2 et se confondent. Passer `gamme` rend
 * « Sur devis » partout : un catalogue sans un seul prix. Même piège que dans
 * `scripts/export-catalogue-kdp.ts`, où l'erreur a réellement été commise.
 */
function prixImprime(f: FormationV2): string {
  if (f.surDevis || !f.categorie) return "Sur devis";
  return formatFormationPrice(f.categorie, f.duree, "fr");
}

export default async function CatalogueImprimePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const offres = FORMATIONS_V2.map((f) => ({
    slug: f.slugFr,
    titre: f.titreFr,
    duree: formatDureeFr(f),
    format: formatModalitesFr(getFormationModalites(f)),
    prix: prixImprime(f),
    accroche: f.accrocheFr,
    surDevis: f.surDevis || !f.categorie,
    manque: [
      !f.titreFr && "titre",
      !f.accrocheFr && "accroche",
      !f.programme?.length && "programme",
    ].filter(Boolean) as string[],
  }));

  const incomplets = offres.filter((o) => o.manque.length > 0);
  const surDevis = offres.filter((o) => o.surDevis);

  return (
    <div>
      <AdminPageHeader
        title="Catalogue imprimé"
        description="Les faits tels qu’ils partiront à l’impression. Le catalogue papier est distribué en main propre : un prix faux ne se corrige pas. Modifier une valeur ici se fait là où on la modifie déjà — c’est le site qui pilote, le livre suit."
      />

      <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
        <h2 className="admin-section-title">Avant de commander un tirage</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2em", lineHeight: 1.7 }}>
          <li>Relire les {offres.length} offres ci-dessous — surtout les prix.</li>
          <li>
            Régénérer les données :{" "}
            <code className="admin-code-inline">pnpm tsx scripts/export-catalogue-kdp.ts</code>
          </li>
          <li>
            Reconstruire et exporter les 4 PDF (cf.{" "}
            <code className="admin-code-inline">catalogue-kdp/README.md</code>).
          </li>
        </ol>
        <p style={{ marginBottom: 0, marginTop: "var(--space-admin-3)" }}>
          L’état des PDF n’est pas affichable ici : ils vivent sur le poste de fabrication, hors
          dépôt. La console n’y a pas accès et ne peut pas mesurer leur fraîcheur.
        </p>
      </section>

      {incomplets.length > 0 ? (
        <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
          <h2
            className="admin-section-title"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-admin-2)" }}
          >
            <AlertTriangle size={20} aria-hidden="true" />
            {incomplets.length} offre(s) incomplète(s)
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
            {incomplets.map((o) => (
              <li key={o.slug}>
                <b>{o.slug}</b> — manque : {o.manque.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Offre</th>
              <th>Durée</th>
              <th>Format</th>
              <th style={{ textAlign: "right" }}>Prix imprimé</th>
            </tr>
          </thead>
          <tbody>
            {offres.map((o) => (
              <tr key={o.slug}>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.titre}</div>
                  <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{o.accroche}</div>
                </td>
                <td>{o.duree}</td>
                <td style={{ fontSize: "0.9em" }}>{o.format}</td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.prix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "var(--space-admin-4)", opacity: 0.75 }}>
        {offres.length} offres au catalogue du site, dont {surDevis.length} sur devis. Le livre en
        imprime 21 : la composition et l’ordre sont portés par{" "}
        <code className="admin-code-inline">catalogue-kdp/objectifs-livre.cjs</code>, parce qu’une
        double-page est produite par entrée et que les numéros du sommaire sont écrits en dur —
        ajouter une offre décalerait toute la pagination, et l’épaisseur du dos avec elle.
      </p>
    </div>
  );
}
