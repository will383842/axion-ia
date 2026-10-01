/**
 * m-3 (2e vérification du chantier visio) — sur la carte du jour d'un rendez-vous
 * du dossier client, « Point fait : A eu lieu · Devis — modifiable ci-dessous »
 * mentait : le formulaire court n'y garde qu'« Absent » et « Reporté ». Un
 * point « a eu lieu » se modifie dans « Après l'appel », et la carte le dit.
 *
 * Mutation qui rougit : retirer la branche `pointAuDossier && … eu_lieu`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync("src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx", "utf8");

describe("m-3 — la carte du jour dit où modifier le point", () => {
  it("un point « a eu lieu » du dossier client renvoie vers « Après l'appel »", () => {
    expect(PAGE).toMatch(
      /pointAuDossier && r\.suivi\.issue === "eu_lieu"\s*\?\s*"modifiable dans « Après l'appel »"/,
    );
  });

  it("contre-témoin : ailleurs, le point reste modifiable sur la carte", () => {
    expect(PAGE).toContain('"modifiable ci-dessous"');
  });
});
