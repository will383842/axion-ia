/**
 * ⛔ LA PAGE DU COMPTE RENDU N'AFFICHE AUCUN HTML PRODUIT PAR L'IA.
 *
 * Une sortie de l'IA (ou une parole transcrite) qui contient `<script>`, un
 * lien, du Markdown, est rendue comme TEXTE : échappée, jamais interprétée.
 * Et ni la page ni le composant n'utilisent `dangerouslySetInnerHTML`, un
 * moteur Markdown, ou un `href` construit depuis le contenu.
 *
 * Mutation qui rougit : rendre `p.texte` par `dangerouslySetInnerHTML` dans
 * `CompteRenduVisio.tsx` → la balise `<script>` apparaît telle quelle.
 * Contre-témoin : le texte, lui, est bien affiché. Angle mort : le navigateur
 * de Will (extensions) n'est pas couvert.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DocumentCompteRenduVue,
  FaitsEtCitations,
} from "@/components/admin/visio/CompteRenduVisio";
import type { DocumentCompteRendu } from "@/features/dossier-client/compte-rendu";
import { RUBRIQUES_COUVERTURE } from "@/server/visio/schemas/communs";
import { couvertureDesFaits } from "@/server/visio/verification/g06-couverture";

const PIEGE =
  "<script>alert(1)</script> [lien](https://exemple.invalid) <img src=x onerror=alert(2)>";

const DOCUMENT: DocumentCompteRendu = {
  v: 1,
  redaction: {
    en_bref: [{ texte: `Le client veut ${PIEGE}`, faits_refs: ["F01"] }],
    ce_qui_a_change: [],
    rubriques: Object.fromEntries(
      RUBRIQUES_COUVERTURE.map((r) => [
        r,
        { statut: "aborde", paragraphes: [{ texte: PIEGE, faits_refs: ["F01"] }] },
      ]),
    ) as DocumentCompteRendu["redaction"]["rubriques"],
    besoins_detectes: [{ hypothese: PIEGE, question: PIEGE, faits_refs: ["F01"] }],
    prochaine_etape_texte: { texte: PIEGE, faits_refs: ["F01"] },
  },
  couverture: couvertureDesFaits(new Map()),
  ebauches: [],
  signaux: [PIEGE],
};

describe("la page du compte rendu n'affiche aucun HTML produit par l'IA", () => {
  it("les balises et liens de l'IA sont échappés, jamais interprétés", () => {
    const html = renderToStaticMarkup(
      <>
        <DocumentCompteRenduVue document={DOCUMENT} />
        <FaitsEtCitations
          faits={[
            {
              id: "f",
              ref: "F01",
              type: "besoin",
              statut: "propose",
              motifRejet: null,
              enonce: PIEGE,
              citation: PIEGE,
              citationDebutMs: 1000,
              citationVerifiee: true,
              certitude: "dit_explicitement",
              confiance: "haute",
              locuteur: "client",
            },
          ]}
        />
      </>,
    );
    expect(html).not.toMatch(/<script>|<img |href="https:\/\/exemple/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Le client veut");
  });

  it("aucun dangerouslySetInnerHTML, aucun moteur Markdown dans la page et le composant", () => {
    for (const f of [
      "src/components/admin/visio/CompteRenduVisio.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/rencontres/[rencontreId]/compte-rendu/page.tsx",
    ]) {
      const code = readFileSync(path.resolve(__dirname, "../../../../..", f), "utf8");
      expect(code, f).not.toMatch(/dangerouslySetInnerHTML=|react-markdown|marked\(|remark|rehype/);
    }
  });
});
