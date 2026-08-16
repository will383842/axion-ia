/**
 * Une pièce signée ne se reproduit qu'avec le gabarit qui l'a produite.
 *
 * Le défaut fermé : `exemplaire-signe.ts` rejoue un instantané de DONNÉES à
 * travers le composant de rendu D'AUJOURD'HUI. Sa propre doctrine pose pourtant
 * que « l'exemplaire signé ne correspondrait plus à ce qui a été signé » — règle
 * tenue sur les données, rompue sur le texte.
 *
 * Conséquence réelle : la convention bipartite a été enrichie le 02/08, la
 * tripartite le 16/08. Chaque retouche réécrivait rétroactivement l'exemplaire
 * signé de toutes les pièces déjà signées, opposant au signataire des clauses
 * qu'il n'a jamais lues.
 */

import { describe, expect, it } from "vitest";
import {
  GABARIT_VERSIONS,
  versionGabaritCourante,
  versionGabaritInstantane,
} from "./gabarit-versions";

describe("version courante par type de pièce", () => {
  it("rend `null` pour un type non signable — la question ne se pose pas", () => {
    expect(versionGabaritCourante("attestation")).toBeNull();
    expect(versionGabaritCourante("programme")).toBeNull();
    expect(versionGabaritCourante("")).toBeNull();
  });

  it("rend un entier positif pour chaque pièce signable", () => {
    for (const [type, v] of Object.entries(GABARIT_VERSIONS)) {
      expect(v, type).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(v), type).toBe(true);
    }
  });

  it("les deux conventions retouchées portent une version SUPÉRIEURE à 1", () => {
    // C'est ce qui rend les pièces signées avant la retouche non reproductibles
    // — le but même du mécanisme. Si quelqu'un les ramène à 1, les exemplaires
    // redeviennent silencieusement infidèles.
    expect(versionGabaritCourante("convention")).toBeGreaterThan(1);
    expect(versionGabaritCourante("convention_tripartite")).toBeGreaterThan(1);
  });
});

describe("version portée par un instantané", () => {
  it("un instantané SANS version est lu comme la version 1", () => {
    // Toutes les pièces d'avant le mécanisme. En cas de doute on refuse : les
    // lire comme « à jour » ferait passer pour fidèle un exemplaire qui ne
    // l'est pas.
    expect(versionGabaritInstantane({ data: {} })).toBe(1);
    expect(versionGabaritInstantane({})).toBe(1);
  });

  it("relit la version qu'il porte", () => {
    expect(versionGabaritInstantane({ data: {}, gabaritVersion: 2 })).toBe(2);
    expect(versionGabaritInstantane({ data: {}, gabaritVersion: 7 })).toBe(7);
  });

  it("une version absurde retombe sur 1 plutôt que d'être crue", () => {
    // Zéro, négatif, texte, NaN : autant de façons dont un instantané corrompu
    // pourrait faire croire à une correspondance. Le repli prudent refuse.
    for (const v of [0, -1, "2", null, undefined, Number.NaN, {}]) {
      expect(versionGabaritInstantane({ data: {}, gabaritVersion: v })).toBe(1);
    }
  });

  it("tolère un instantané qui n'est pas un objet", () => {
    expect(versionGabaritInstantane(null)).toBe(1);
    expect(versionGabaritInstantane("texte")).toBe(1);
    expect(versionGabaritInstantane(42)).toBe(1);
  });
});

describe("le scénario réel qui a motivé le mécanisme", () => {
  it("une convention signée AVANT la retouche du 16/08 est détectée comme non reproductible", () => {
    // Instantané d'une pièce générée avant le mécanisme : aucune version.
    const instantaneAvant = { data: { numero: "AXI-DOC-2026-032" } };
    const courante = versionGabaritCourante("convention");

    expect(versionGabaritInstantane(instantaneAvant)).not.toBe(courante);
  });

  it("une convention générée APRÈS la retouche reste reproductible", () => {
    const courante = versionGabaritCourante("convention");
    const instantaneApres = { data: {}, gabaritVersion: courante };

    expect(versionGabaritInstantane(instantaneApres)).toBe(courante);
  });

  it("le devis n'est PAS impacté — sa garde de certification change les données, pas le texte", () => {
    // Un exemplaire signé rejoue son instantané : les montants qui y figuraient
    // au moment de la signature y sont toujours. Bumper le devis refuserait des
    // exemplaires parfaitement fidèles, et une garde qui refuse à tort finit
    // désarmée.
    expect(versionGabaritCourante("devis")).toBe(1);
  });
});
