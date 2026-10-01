// @vitest-environment node
/**
 * UX-06 : la page du compte rendu n'affiche plus de libellés techniques.
 *   · « CLIENT_1 » devient « Voix 1 côté client » ;
 *   · « Réextraire » / « Réécrire » deviennent « Relire l'enregistrement
 *     depuis le début » / « Rédiger à nouveau le texte », avec une ligne d'aide ;
 *   · une piste d'offre montre le TITRE du projet évoqué, pas « Projet J1 » ;
 *   · l'étape « Ébauche de devis » s'appelle « Offres du catalogue évoquées »
 *     (aucun devis n'est pré-rempli, décision de Williams).
 *
 * Mutation qui fait rougir : remettre un des anciens libellés.
 * Angle mort : `VueCompteRendu` (serveur, lit la base) est lu comme un texte.
 */

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocumentCompteRenduVue } from "../CompteRenduVisio";
import { LIBELLE_ETAPE_VISIO } from "@/features/dossier-client/libelles";
import type { DocumentCompteRendu } from "@/features/dossier-client/compte-rendu";
import { RUBRIQUES_COUVERTURE } from "@/server/visio/schemas/communs";
import { couvertureDesFaits } from "@/server/visio/verification/g06-couverture";

const VUE = readFileSync("src/components/admin/visio/VueCompteRendu.tsx", "utf8");
const RENDU = VUE.slice(VUE.indexOf("export"));

describe("la page du compte rendu parle la langue de Will", () => {
  it("voix et boutons en clair", () => {
    expect(RENDU).not.toContain("CLIENT_{");
    expect(RENDU).toContain("Voix {i + 1} côté client");
    expect(RENDU).not.toMatch(/>\s*Réextraire\s*</);
    expect(RENDU).not.toMatch(/>\s*Réécrire\s*</);
    expect(RENDU).toContain("Relire l&apos;enregistrement depuis le début");
    expect(RENDU).toContain("Rédiger à nouveau le texte");
  });

  it("l'étape des pistes d'offre ne promet pas de devis", () => {
    expect(LIBELLE_ETAPE_VISIO.ebaucher).toBe("Offres du catalogue évoquées");
  });

  it("une piste d'offre montre le titre du projet évoqué", () => {
    const document: DocumentCompteRendu = {
      v: 1,
      redaction: {
        en_bref: [],
        ce_qui_a_change: [],
        rubriques: Object.fromEntries(
          RUBRIQUES_COUVERTURE.map((r) => [r, { statut: "aborde", paragraphes: [] }]),
        ) as unknown as DocumentCompteRendu["redaction"]["rubriques"],
        besoins_detectes: [],
        prochaine_etape_texte: { texte: "Rappeler", faits_refs: [] },
      },
      couverture: couvertureDesFaits(new Map()),
      ebauches: [{ projetRef: "J1", lignes: [], hypotheses: [], manquant: [], sansReference: [] }],
      signaux: [],
    };
    const html = renderToStaticMarkup(
      <DocumentCompteRenduVue document={document} intitules={new Map([["J1", "Formation RH"]])} />,
    );
    expect(html).toContain("Formation RH");
    expect(html).not.toContain("Projet J1");
  });
});
