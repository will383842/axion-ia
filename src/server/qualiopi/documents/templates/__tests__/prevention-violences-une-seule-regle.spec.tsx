/**
 * CLIQUET — prévention et traitement des violences, du harcèlement et des
 * discriminations (indicateur 12, décret n° 2026-728, en vigueur le
 * 1er novembre 2026) : UNE règle, imprimée pareil partout.
 *
 * ## Les défauts fermés (analyse d'écarts du 02/10/2026, B1 et C)
 *
 *  - même article numéroté « 3 quater » sur la page publique et « 3 ter » dans
 *    le PDF remis (et, en cascade, l'échelle et la procédure décalées) ;
 *  - « signalement prévu à l'article 40 du code de procédure pénale » :
 *    l'alinéa 2 vise les autorités et les fonctionnaires, pas une SAS ;
 *  - canal de signalement non donné (« adresse publiée dans les mentions
 *    légales »), aucun délai de réponse, aucun recours extérieur nommé ;
 *  - livret d'accueil et convocation muets : information du stagiaire par
 *    simple renvoi au règlement.
 *
 * ## Ce que ce fichier garde
 *
 * Le texte RENDU (page : contenu de `getLegal` ; PDF : arbre react-pdf via
 * `collectPdfText`). Les attentes sont écrites ICI en toutes lettres, et non
 * relues dans `src/content/prevention-violences.ts` : une constante vidée ou
 * réécrite doit faire rougir.
 */

import { describe, expect, it } from "vitest";
import React from "react";

import { getLegal } from "@/content/legal";

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import type { OrganismeIdentite } from "../../organisme";
import { ConvocationPdf, type ConvocationData } from "../convocation";
import { LivretAccueilPdf, type LivretAccueilData } from "../livret-accueil";
import { ReglementInterieurPdf } from "../reglement-interieur";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://axion-ia.com",
  referentHandicapNom: "Williams Jullin",
};

const PAGE = getLegal("reglement-interieur");
const PAGE_FR = PAGE.fr.sections.map((s) => `${s.title} ${s.body}`).join(" ");
const PAGE_TOUT = JSON.stringify(PAGE);

const PDF = collectPdfTextNormalized(
  React.createElement(ReglementInterieurPdf, {
    data: { numero: "AXI-RI-TEST", dateVersion: "2 octobre 2026" },
    identite: IDENTITE,
  }),
);

function convocation(modalite: ConvocationData["modalite"]): string {
  const data: ConvocationData = {
    numero: "CONV-TEST",
    intituleFormation: "IA pour bien commencer",
    dateDebut: "1 octobre 2026",
    dateFin: "1 octobre 2026",
    horaires: "09h00–17h00",
    dureeHeures: 7,
    modalite,
    lieu: "Salle A, 1 rue de la Paix, 75001 Paris",
    nomFormateur: "Sophie Martin",
    contactEmail: "contact@axion-ia.com",
    nomStagiaire: "Jean Dupont",
  };
  return collectPdfTextNormalized(
    React.createElement(ConvocationPdf, { data, identite: IDENTITE }),
  );
}

function livret(): string {
  const data: LivretAccueilData = {
    numero: "LA-TEST",
    contactPedagogique: { nomPrenom: "Williams Jullin", email: "contact@axion-ia.com" },
    dateVersion: "2 octobre 2026",
  };
  return collectPdfTextNormalized(
    React.createElement(LivretAccueilPdf, { data, identite: IDENTITE }),
  );
}

/** Les titres « Article N — … » du PDF, dans l'ordre. */
function titresArticlesPdf(): string[] {
  return [
    ...PDF.matchAll(
      /Article \d+(?: bis| ter| quater)? — [^.:]*?(?= (?:Tout|Le|La|Les|L'|Sont|Constitue|Aucune|Des|Pour|Chaque|Toute|Conformément)\b)/g,
    ),
  ].map((m) => m[0].trim());
}

describe("règlement intérieur — même numérotation sur la page et dans le PDF", () => {
  it("l'article sur les violences est le « 3 quater » des deux côtés, et plus jamais un « 3 ter »", () => {
    const titre =
      "Article 3 quater — Prévention des violences, du harcèlement et des discriminations";
    expect(PAGE.fr.sections.map((s) => s.title)).toContain(titre);
    expect(PDF).toContain(titre);
    expect(PDF).not.toContain("Article 3 ter — Prévention");
  });

  it("l'échelle (3 bis) et la procédure (3 ter) portent le même numéro des deux côtés", () => {
    for (const titre of [
      "Article 3 — Discipline et comportement",
      "Article 3 bis — Échelle des sanctions",
      "Article 3 ter — Procédure disciplinaire et droits de la défense",
    ]) {
      expect(
        PAGE.fr.sections.map((s) => s.title),
        `page : ${titre}`,
      ).toContain(titre);
      expect(PDF, `PDF : ${titre}`).toContain(titre);
    }
    expect(PDF).not.toContain("Article 3 bis — Procédure");
  });

  it("chaque article numéroté du PDF existe sous le même titre sur la page", () => {
    const titresPage = new Set(PAGE.fr.sections.map((s) => s.title));
    const titresPdf = titresArticlesPdf();
    // Contre-témoin : sans titres extraits, la comparaison serait vide.
    expect(titresPdf.length).toBeGreaterThanOrEqual(10);
    expect(titresPdf.filter((t) => !titresPage.has(t))).toEqual([]);
  });

  it("les renvois internes visent les bons articles : échelle 3 bis, procédure 3 ter", () => {
    for (const [nom, texte] of [
      ["page", PAGE_FR],
      ["PDF", PDF],
    ] as const) {
      expect(texte, nom).toContain(
        "sanction choisie dans l'échelle de l'article 3 bis, prononcée selon la procédure de l'article 3 ter",
      );
    }
  });
});

describe("règlement intérieur — signaler, traiter, suites, recours (page ET PDF)", () => {
  const ATTENDUS: ReadonlyArray<readonly [string, string]> = [
    ["à qui", "au représentant légal de l'organisme, Williams Jullin, Président"],
    ["par écrit, à l'adresse existante", "par écrit à contact@axion-ia.com"],
    ["l'objet du message", "en indiquant « SIGNALEMENT » en objet"],
    ["en séance", "de vive voix au formateur pendant la session, qui le consigne le jour même"],
    ["confidentialité", "traité de manière confidentielle"],
    ["accusé de réception", "accuse réception par écrit sous 48 heures ouvrées"],
    ["mesures de protection", "suspension de la participation de la personne mise en cause"],
    ["réponse motivée", "une réponse écrite et motivée sous 15 jours ouvrés"],
    ["protection du signalant", "Aucune mesure défavorable ne peut être prise"],
    ["suite pénale", "porte les faits à la connaissance du procureur de la République"],
    ["recours non subordonné", "passer par l'organisme n'est jamais un préalable"],
    ["Défenseur des droits", "Défenseur des droits pour toute discrimination (09 69 39 00 00"],
    ["site du Défenseur", "defenseurdesdroits.fr"],
    ["3919", "le 3919, Violences Femmes Info"],
    ["urgence", "17 ou 112 en cas d'urgence"],
  ];

  it.each(ATTENDUS)("page publique : %s", (_quoi, phrase) => {
    expect(PAGE_FR).toContain(phrase);
  });

  it.each(ATTENDUS)("PDF remis : %s", (_quoi, phrase) => {
    expect(PDF).toContain(phrase);
  });

  it("🔴 plus aucune version ne cite « l'article 40 du code de procédure pénale »", () => {
    expect(PAGE_TOUT).not.toMatch(/article 40 du code de proc/i);
    expect(PDF).not.toMatch(/article 40 du code de proc/i);
  });

  it("aucun numéro de téléphone de l'organisme n'y est publié (ordre permanent)", () => {
    expect(PAGE_FR).not.toMatch(/\+33|07 43|7 43 33/);
    expect(PDF).not.toMatch(/\+33|07 43|7 43 33/);
  });
});

describe("livret d'accueil et convocation — information directe du stagiaire", () => {
  const PIECES: ReadonlyArray<readonly [string, () => string]> = [
    ["livret d'accueil", livret],
    ["convocation présentiel", () => convocation("présentiel")],
    ["convocation distanciel", () => convocation("distanciel")],
    ["convocation mixte", () => convocation("mixte")],
  ];

  it.each(PIECES)("%s : encart, renvoi au règlement et contact de signalement", (_nom, texte) => {
    const t = texte();
    expect(t).toContain("Prévention des violences, du harcèlement et des discriminations");
    expect(t).toContain("dont les violences sexistes et sexuelles");
    expect(t).toContain("à l'article 3 quater du règlement intérieur des stagiaires");
    expect(t).toContain("à Williams Jullin, Président : par écrit à contact@axion-ia.com");
    expect(t).toContain("avec « SIGNALEMENT » en objet");
    expect(t).toContain("accusé de réception sous 48 heures ouvrées");
    expect(t).toContain("réponse motivée sous 15 jours ouvrés");
    expect(t).toContain("Défenseur des droits (09 69 39 00 00, defenseurdesdroits.fr)");
    expect(t).toContain("3919");
  });
});
