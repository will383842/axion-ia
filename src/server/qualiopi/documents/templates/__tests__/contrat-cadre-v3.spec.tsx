// @vitest-environment node

/**
 * Lot L7a — le contrat-cadre v3 imprime le texte ARRÊTÉ, et seulement lui.
 *
 * Le texte est arrêté par la direction le 10/10/2026 : il est repris mot pour
 * mot dans `contrat-cadre.tsx`. Ce fichier vérifie, sur le texte RENDU :
 *  · les clauses qui portent de l'argent ou un engagement (honoraires, forfait,
 *    annulation, date limite, non-sollicitation, préavis) ;
 *  · que chaque variante n'imprime que ses propres passages ;
 *  · qu'aucun repère de rédaction (« [SI … ] ») ni mot proscrit ne s'imprime ;
 *  · qu'un champ manquant se voit, pour que l'émetteur refuse avant d'émettre.
 */

import { beforeAll, describe, expect, it } from "vitest";
import React from "react";

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";

import {
  ContratCadrePdf,
  champsManquantsContratCadre,
  type ContratCadreData,
} from "../contrat-cadre";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84000000000",
  qualiopi: "",
  siret: "12345678900011",
  adresseSiege: "1 rue de la Formation, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Formation, 42000 Saint-Étienne",
  email: "contact@exemple.fr",
  telephone: "",
  site: "https://www.exemple.fr",
  representantLegalNom: "Camille Martin",
  representantLegalQualite: "Présidente",
  capitalSocial: "1 000 €",
  rcsVille: "Saint-Étienne",
  siren: "123456789",
};

const INDEPENDANT: ContratCadreData = {
  numero: "AXI-DOC-2026-900",
  nature: "independant",
  cocontractant: {
    prenomNom: "Alex Durand",
    siret: "98765432100017",
    adresse: "5 chemin des Tilleuls, 69001 Lyon",
    numeroDeclaration: null,
    tvaIntracom: null,
    email: "alex@exemple.fr",
  },
  mandatAutofacturation: true,
  axion: {
    regionDeclaration: "Auvergne-Rhône-Alpes",
    adresseFormateurs: "formateurs@exemple.fr",
  },
  dateContrat: "12/10/2026",
};

const ORGANISME: ContratCadreData = {
  ...INDEPENDANT,
  nature: "organisme",
  cocontractant: {
    prenomNom: "Dominique Leroy",
    societe: { denomination: "Formations Leroy", forme: "SARL", capital: "5 000" },
    qualiteRepresentant: "Gérant",
    siret: "11122233300014",
    adresse: "8 place du Marché, 38000 Valence",
    numeroDeclaration: "84380000000",
    regionDeclaration: "Auvergne-Rhône-Alpes",
    tvaIntracom: "FR00111222333",
    email: "contact@leroy.exemple",
  },
  mandatAutofacturation: false,
};

/**
 * Le collecteur sépare d'un espace chaque enfant d'un nœud ; @react-pdf, lui,
 * les accole. On retire donc l'espace qu'il insère devant une ponctuation qui
 * n'en prend jamais en français (« Durand , » → « Durand, »).
 */
const texte = (data: ContratCadreData, identite: OrganismeIdentite = IDENTITE): string =>
  collectPdfTextNormalized(React.createElement(ContratCadrePdf, { data, identite }))
    .replace(/ ([,.)])/g, "$1")
    .replace(/\( /g, "(");

const ind = texte(INDEPENDANT);
const org = texte(ORGANISME);

describe("contrat-cadre v3 — le texte arrêté est imprimé", () => {
  it("porte sa version et la date d'arrêt", () => {
    for (const t of [ind, org]) {
      expect(t).toContain("Version 3 du 10 octobre 2026");
      expect(t).toContain("Annexe 4 version 1");
    }
  });

  it("imprime les 35 articles et les 4 annexes, dans l'ordre", () => {
    let depuis = 0;
    for (let n = 1; n <= 35; n += 1) {
      const i = ind.indexOf(`Article ${n} —`, depuis);
      expect(i, `Article ${n}`).toBeGreaterThan(-1);
      depuis = i;
    }
    for (let n = 1; n <= 4; n += 1) {
      const i = ind.indexOf(`Annexe ${n} —`, depuis);
      expect(i, `Annexe ${n}`).toBeGreaterThan(-1);
      depuis = i;
    }
  });

  it("💶 les montants et délais qui engagent sont ceux du texte arrêté", () => {
    for (const t of [ind, org]) {
      expect(t).toContain(
        "Les honoraires sont de 350 € HT par journée et de 175 € HT par demi-journée.",
      );
      expect(t).toContain("Ce forfait ne dépasse jamais 150 € HT par journée.");
      expect(t).toContain(
        "la moitié des honoraires des journées et demi-journées annulées vous est due",
      );
      expect(t).toContain("au plus tard 30 jours après la dernière journée réalisée de la mission");
      expect(t).toContain("Vous êtes payé que le client ait payé Axion ou non.");
      expect(t).toContain("indemnité forfaitaire pour frais de recouvrement de 40 €");
      expect(t).toContain("Pendant le contrat et pendant 12 mois après votre dernière mission");
      expect(t).toContain("30 jours si la durée de la relation est inférieure à un an");
      expect(t).toContain("90 jours si elle dépasse deux ans.");
      expect(t).toContain("soit 175 € HT, par autofacture");
    }
  });

  it("une lettre couvre une mission de 1 à N jours (décision du 10/10)", () => {
    expect(ind).toContain(
      "Une mission peut durer une demi-journée, une journée ou plusieurs jours, consécutifs ou non : une seule lettre couvre toutes ses dates.",
    );
  });

  it("le contrat ne prend effet qu'à la contresignature, signé avec un code", () => {
    expect(ind).toContain("Le contrat prend effet à la date de cette contresignature.");
    expect(ind).toContain(
      "vous saisissez le code à usage unique reçu à votre adresse électronique",
    );
  });

  it("aucune clause de l'ancien contrat ne survit (cession, 18 mois, Qualiopi exigé)", () => {
    for (const t of [ind, org]) {
      expect(t).not.toContain("dix-huit (18) mois");
      expect(t).not.toContain("cédés à l'organisme à titre exclusif");
      expect(t).not.toMatch(/non-concurrence/i);
      expect(t).toContain("Aucune certification Qualiopi ne vous est demandée.");
    }
  });
});

describe("contrat-cadre v3 — chaque variante n'imprime que ses passages", () => {
  it("indépendant : entreprise individuelle, numéro en cours, TVA sans objet", () => {
    expect(ind).toContain(
      "Alex Durand, formateur indépendant, exerçant en entreprise individuelle, y compris sous le régime de la micro-entreprise, sous le numéro SIRET 98765432100017",
    );
    expect(ind).toContain("Numéro de déclaration d'activité : en cours d'obtention (article 19).");
    expect(ind).toContain("Numéro de TVA intracommunautaire : sans objet.");
    expect(ind).toContain("7.1 Vous animez la mission vous-même.");
    expect(ind).toContain("comme formateur indépendant désigné par Axion");
    expect(ind).toContain("sur le compte à votre nom déclaré dans votre dossier");
  });

  it("indépendant en société : la société et son dirigeant", () => {
    const t = texte({
      ...INDEPENDANT,
      cocontractant: {
        ...INDEPENDANT.cocontractant,
        societe: { denomination: "Durand Conseil", forme: "SASU", capital: "500" },
        numeroDeclaration: "84690000000",
      },
    });
    expect(t).toContain(
      "exerçant par la société Durand Conseil, SASU, au capital de 500 €, immatriculée sous le numéro SIRET",
    );
    expect(t).toContain("son dirigeant, qui anime lui-même les formations.");
    expect(t).toContain("Numéro de déclaration d'activité : 84690000000.");
  });

  it("organisme : intervenants désignés, 13.4, 18.3, K bis — absents chez l'indépendant", () => {
    const passagesOrganisme = [
      "intervenants désignés » (article 7)",
      "Chaque proposition indique l'intervenant désigné",
      "13.4 Vous pouvez choisir, à la signature, de ne pas donner ce mandat.",
      "18.3 Vous déposez aussi un extrait K ou K bis",
      "Extrait K ou K bis",
      "et sous celui de votre organisme",
      "comme organisme sous-traitant désigné par Axion",
      "sur le compte au nom de l'organisme déclaré",
      "Vous les communiquez à vos seuls intervenants désignés",
      "CV de moins de 24 mois pour chaque intervenant désigné",
    ];
    for (const p of passagesOrganisme) {
      expect(org, p).toContain(p);
      expect(ind, p).not.toContain(p);
    }
    expect(org).not.toContain("7.1 Vous animez la mission vous-même.");
    expect(org).toContain(
      "Formations Leroy, SARL, au capital de 5 000 €, immatriculée sous le numéro SIRET 11122233300014",
    );
  });

  it("aucun repère de rédaction ni crochet ne s'imprime", () => {
    for (const t of [ind, org]) {
      expect(t).not.toMatch(/\[SI |FIN SI|\[Prénom|\[SIRET|\[date/);
      expect(t).not.toContain("[");
    }
  });

  it("aucun mot proscrit", () => {
    const proscrits =
      /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial)\b/i;
    for (const t of [ind, org]) expect(t).not.toMatch(proscrits);
  });

  it("Axion certifiée : la mention Qualiopi et son certificateur s'impriment", () => {
    const t = texte(
      { ...INDEPENDANT, axion: { ...INDEPENDANT.axion, certificateur: "Certificateur X" } },
      { ...IDENTITE, qualiopi: "FR-0001" },
    );
    expect(t).toContain(
      "Certification Qualiopi n° FR-0001, délivrée par Certificateur X, au titre de la catégorie « actions de formation ».",
    );
    expect(ind).not.toContain("Certification Qualiopi n°");
  });
});

describe("contrat-cadre v3 — un champ manquant se voit avant l'émission", () => {
  it("données complètes : rien ne manque", () => {
    expect(champsManquantsContratCadre(INDEPENDANT, IDENTITE)).toEqual([]);
    expect(champsManquantsContratCadre(ORGANISME, IDENTITE)).toEqual([]);
  });

  it("un champ d'Axion ou du cocontractant manquant est listé, et s'imprime en blanc", () => {
    const sansRegion = { ...INDEPENDANT, axion: { ...INDEPENDANT.axion, regionDeclaration: "" } };
    expect(champsManquantsContratCadre(sansRegion, IDENTITE)).toContain(
      "Axion — région de déclaration",
    );
    expect(texte(sansRegion)).toContain("auprès du préfet de la région ____________");

    expect(
      champsManquantsContratCadre(INDEPENDANT, { ...IDENTITE, capitalSocial: null }),
    ).toContain("Axion — capital");
    expect(
      champsManquantsContratCadre(
        { ...ORGANISME, cocontractant: { ...ORGANISME.cocontractant, numeroDeclaration: null } },
        IDENTITE,
      ),
    ).toContain("Numéro de déclaration d'activité");
  });

  it("Axion certifiée sans certificateur : refusé", () => {
    expect(
      champsManquantsContratCadre(INDEPENDANT, { ...IDENTITE, qualiopi: "FR-0001" }),
    ).toContain("Axion — certificateur");
  });
});

describe("contrat-cadre v3 — rendu PDF", () => {
  it("rend un PDF dans les deux variantes", async () => {
    for (const data of [INDEPENDANT, ORGANISME]) {
      const { buffer } = await renderPdfToBuffer(
        React.createElement(ContratCadrePdf, { data, identite: IDENTITE }),
      );
      expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
    }
  }, 60_000);
});
