// Le registre des documents remis à l'apporteur : une seule liste (titre, phrase, chemin,
// condition d'affichage), lue par la page « Mes documents » et réutilisable par les e-mails.
import { describe, expect, it } from "vitest";

import {
  CHEMIN_LIVRET,
  DOCUMENTS_REMIS,
  documentsRemis,
  type ContexteDocuments,
} from "../documents-remis";

const ESPACE = "/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/jeton-valide";
const ctx = (over: Partial<ContexteDocuments> = {}): ContexteDocuments => ({
  espace: ESPACE,
  sousContrat: true,
  contratSigneDisponible: true,
  livretDisponible: true,
  ...over,
});
const cles = (c: ContexteDocuments) => documentsRemis(c).map((d) => d.cle);

describe("le registre", () => {
  it("six documents, dans l'ordre, chacun avec un titre et une phrase", () => {
    expect(DOCUMENTS_REMIS.map((d) => d.cle)).toEqual([
      "contrat",
      "guide",
      "fiche-commissions",
      "livret",
      "charte",
      "outils",
    ]);
    for (const d of DOCUMENTS_REMIS) {
      expect(d.titre.trim().length).toBeGreaterThan(3);
      expect(d.description.trim().length).toBeGreaterThan(10);
    }
  });

  it("aucun montant, aucun pourcentage, aucun mot interdit dans les textes", () => {
    for (const d of DOCUMENTS_REMIS) {
      const t = `${d.titre} ${d.description}`;
      expect(t).not.toMatch(/\d\s*(€|%|euros?)/i);
      expect(t).not.toMatch(
        /gr[e]noble|aucun\s+gain\s+gar[a]nti|conférence|salari[ée]|obj[e]ctif/i,
      );
    }
  });
});

describe("ce que voit l'apporteur", () => {
  it("sous contrat signé, tout présent : les cinq visibles (fiche des commissions masquée le 27/11), avec leurs adresses", () => {
    const docs = documentsRemis(ctx());
    expect(docs.map((d) => [d.cle, d.href])).toEqual([
      ["contrat", `${ESPACE}/contrat?dl=1`],
      ["guide", `${ESPACE}/guide`],
      ["livret", CHEMIN_LIVRET],
      ["charte", `${ESPACE}/charte`],
      ["outils", `${ESPACE}/outils`],
    ]);
    expect(CHEMIN_LIVRET).toBe("/documents/apporteurs/livret-apporteur.pdf");
  });

  it("contrat signé mais fichier absent : pas de ligne contrat", () => {
    expect(cles(ctx({ contratSigneDisponible: false }))).toEqual([
      "guide",
      "livret",
      "charte",
      "outils",
    ]);
  });

  it("dossier pas encore signé : ni contrat, ni charte, ni outils", () => {
    expect(cles(ctx({ sousContrat: false, contratSigneDisponible: false }))).toEqual(["livret"]);
    // Même si un fichier de contrat existait, il ne s'affiche pas hors contrat signé.
    expect(cles(ctx({ sousContrat: false }))).not.toContain("contrat");
  });

  it("livret absent de public/ : pas de ligne livret", () => {
    expect(cles(ctx({ livretDisponible: false }))).not.toContain("livret");
  });

  it("les PDF s'ouvrent dans un nouvel onglet, les pages de l'espace non", () => {
    const parCle = Object.fromEntries(documentsRemis(ctx()).map((d) => [d.cle, d.nouvelOnglet]));
    expect(parCle).toEqual({
      contrat: true,
      guide: true,
      livret: true,
      charte: true,
      outils: false,
    });
  });
});

describe("le guide de démarrage", () => {
  const guide = (c: ContexteDocuments) => documentsRemis(c).find((d) => d.cle === "guide");

  it("sous contrat signé : ouvrir et télécharger (PDF A4), par la route contrôlée", () => {
    expect(guide(ctx())).toMatchObject({
      titre: "Votre guide de démarrage",
      href: `${ESPACE}/guide`,
      telechargement: `${ESPACE}/guide?dl=1`,
      actionTelechargement: "Télécharger le guide (PDF A4)",
    });
  });

  it("avant la signature : aucune ligne guide", () => {
    expect(guide(ctx({ sousContrat: false, contratSigneDisponible: false }))).toBeUndefined();
  });

  it("la phrase est celle de la couverture du guide validé, sans montant", () => {
    const d = guide(ctx())!;
    expect(d.description).toBe(
      "Ce guide vous est remis avec votre contrat : une idée par page, vous piochez ce qui vous plaît, à votre rythme.",
    );
    expect(`${d.titre} ${d.description} ${d.action} ${d.actionTelechargement}`).not.toMatch(
      /\d\s*(€|%|euros?)/i,
    );
  });

  it("aucun autre document n'a de lien d'enregistrement", () => {
    for (const d of documentsRemis(ctx())) {
      if (d.cle !== "guide") expect(d.telechargement).toBeUndefined();
    }
  });
});
