/**
 * Indicateur 10 — le besoin déclaré et la réponse de l'organisme, écrits une fois.
 *
 * Le cas réel qui fonde ces tests : « oui » au positionnement, fiche stagiaire
 * ensuite décochée (aucune adaptation nécessaire après échange), inscription
 * vide. Le moteur ne voyait plus le besoin ; rien ne gardait la réponse.
 */
import { describe, expect, it } from "vitest";

import {
  REPONSE_AUCUNE_ADAPTATION,
  besoinAdaptationDeclare,
  debutConsignationCourante,
  estReponseAucuneAdaptation,
  etatReponseAdaptation,
  whereBesoinAdaptationDeclare,
} from "./reponse-organisme";
import { sectionIndicateur10 } from "./dossier-adaptation";

describe("besoin d'adaptation déclaré", () => {
  it("🔴 un « oui » au positionnement reste un besoin déclaré quand la fiche est décochée", () => {
    expect(
      besoinAdaptationDeclare({
        situationHandicap: false,
        reponsesPositionnements: [{ besoinAdaptation: true }],
      }),
    ).toBe(true);
  });

  it("la fiche stagiaire (portail « mon compte » ou console) suffit", () => {
    expect(besoinAdaptationDeclare({ situationHandicap: true, reponsesPositionnements: [] })).toBe(
      true,
    );
  });

  it("un « non », une question non posée ou une saisie par l'organisme ne déclarent rien", () => {
    for (const reponses of [
      { besoinAdaptation: false },
      {},
      null,
      { saisie_admin: true, besoinAdaptation: true },
    ]) {
      expect(
        besoinAdaptationDeclare({ situationHandicap: false, reponsesPositionnements: [reponses] }),
      ).toBe(false);
    }
  });

  it("le filtre base est POSITIF sur les deux sources — jamais une exclusion JSON", () => {
    const plat = JSON.stringify(whereBesoinAdaptationDeclare());
    expect(plat).toContain('"situationHandicap":true');
    expect(plat).toContain('"path":["besoinAdaptation"],"equals":true');
    expect(plat).not.toContain("NOT");
  });
});

describe("réponse de l'organisme", () => {
  it("🔴 « aucune adaptation nécessaire » est une réponse consignée, pas une absence", () => {
    expect(etatReponseAdaptation(true, REPONSE_AUCUNE_ADAPTATION)).toBe("consignee");
    expect(estReponseAucuneAdaptation(REPONSE_AUCUNE_ADAPTATION)).toBe(true);
  });

  it("besoin déclaré sans réponse = à consigner ; une chaîne blanche n'est pas une réponse", () => {
    expect(etatReponseAdaptation(true, null)).toBe("a_consigner");
    expect(etatReponseAdaptation(true, "   ")).toBe("a_consigner");
    expect(etatReponseAdaptation(false, null)).toBe("sans_besoin");
  });

  it("la date de consignation est le début de la période qui dure encore", () => {
    const j = (jour: number): Date => new Date(Date.UTC(2026, 8, jour, 10));
    // Consignée le 1er, retouchée le 3 : consignée depuis le 1er.
    expect(
      debutConsignationCourante([
        { createdAt: j(3), renseignee: true },
        { createdAt: j(1), renseignee: true },
      ]),
    ).toEqual(j(1));
    // Effacée le 4, réécrite le 6 : consignée depuis le 6.
    expect(
      debutConsignationCourante([
        { createdAt: j(1), renseignee: true },
        { createdAt: j(4), renseignee: false },
        { createdAt: j(6), renseignee: true },
      ]),
    ).toEqual(j(6));
    expect(debutConsignationCourante([{ createdAt: j(4), renseignee: false }])).toBeNull();
  });
});

describe("dossier d'audit de la session — section indicateur 10", () => {
  const debut = new Date("2026-09-05T07:00:00.000Z");

  it("dit, par stagiaire, la réponse et sa date par rapport au début", () => {
    const { lignes, nbAConsigner } = sectionIndicateur10(
      [
        {
          stagiaire: "Alice Test",
          besoinDeclare: true,
          adaptationsRealisees: REPONSE_AUCUNE_ADAPTATION,
          consigneeLe: new Date("2026-09-04T09:00:00.000Z"),
        },
        {
          stagiaire: "Bruno Test",
          besoinDeclare: true,
          adaptationsRealisees: "Supports agrandis",
          consigneeLe: new Date("2026-09-06T09:00:00.000Z"),
        },
        {
          stagiaire: "Chloé Test",
          besoinDeclare: true,
          adaptationsRealisees: null,
          consigneeLe: null,
        },
        {
          stagiaire: "Denis Test",
          besoinDeclare: false,
          adaptationsRealisees: null,
          consigneeLe: null,
        },
      ],
      debut,
    );
    const texte = lignes.join("\n");
    expect(texte).toMatch(
      /Alice Test — besoin déclaré — réponse consignée le .*avant le début.*aucune adaptation nécessaire/,
    );
    expect(texte).toMatch(/Bruno Test — besoin déclaré — réponse consignée le .*APRÈS le début/);
    expect(texte).toContain("Chloé Test — besoin déclaré — AUCUNE RÉPONSE CONSIGNÉE");
    expect(texte).not.toContain("Denis Test");
    expect(texte).toContain("1 autre stagiaire sans besoin déclaré");
    expect(nbAConsigner).toBe(1);
  });

  it("🔴 ne peut pas porter le détail déclaré — la section ne le reçoit même pas", () => {
    const { lignes } = sectionIndicateur10(
      [
        {
          stagiaire: "Alice Test",
          besoinDeclare: true,
          adaptationsRealisees: null,
          consigneeLe: null,
        },
      ],
      debut,
    );
    expect(lignes.join("\n")).toContain("jamais reproduit dans ce dossier");
    expect(lignes.join("\n")).not.toMatch(/fiche stagiaire|chiffr/i);
  });
});
