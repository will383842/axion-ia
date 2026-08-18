/**
 * Relecture des prix du livre KDP, AVANT tirage.
 *
 * Ce bloc était l'écran `catalogue-imprime` tout entier (2026-08-16, demande
 * Will). Il devient une pièce de l'onglet « Imprimés › Livre KDP ». Le contenu
 * n'a pas changé : les faits du livre — prix, durée, titre, format, accroche —
 * viennent du SITE (`scripts/export-catalogue-kdp.ts`), et cette table les
 * affiche exactement comme ils partiront à l'impression, pour qu'on puisse les
 * relire sans ouvrir un PDF de 20 Mo.
 *
 * L'ÉCRITURE DU LIVRE N'EST PAS ICI. Objectifs, lignes avant/après, rubrique et
 * effectif sont figés côté générateur (`objectifs-livre.cjs`, `prose-livre.cjs`)
 * parce qu'ils sont écrits POUR LE PAPIER — les objectifs du site font
 * 225 caractères contre 58 pour ceux du livre, les verser tels quels ferait
 * déborder les cadres. Ce bloc dit donc ce que le SITE pilote.
 */
import { AlertTriangle } from "lucide-react";

import { FORMATIONS_V2, type FormationV2 } from "@/content/formations/catalog-v2";
import {
  formatDureeFr,
  getFormationModalites,
  formatModalitesFr,
} from "@/content/formations/catalog-v2-facts";
import { formatFormationPrice } from "@/content/pricing";

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

export function RelecturePrixKdp() {
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
    <>
      <h2 className="admin-section-title" style={{ marginTop: "var(--space-admin-5)" }}>
        Les faits, tels qu’ils partiront à l’impression
      </h2>
      <p style={{ marginBottom: "var(--space-admin-3)" }}>
        Modifier une valeur se fait là où on la modifie déjà — c’est le site qui pilote, le livre
        suit.
      </p>

      {incomplets.length > 0 ? (
        <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
          <h3
            className="admin-section-title"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-admin-2)" }}
          >
            <AlertTriangle size={20} aria-hidden="true" />
            {incomplets.length} offre(s) incomplète(s)
          </h3>
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
    </>
  );
}
