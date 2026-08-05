/**
 * Tests — famille d'une offre (formation collective vs accompagnement 1-to-1).
 *
 * Vérifié en production le 2026-08-05 : les 4 offres actives sans formation
 * rattachable sont exactement les prestations individuelles + « Sur demande »,
 * et leur page `/formations/<slug>` répond 404.
 */

import { describe, it, expect } from "vitest";
import {
  famillePrestation,
  estOffreUnAUn,
  cheminPublicOffre,
  type FamillePrestation,
} from "./famille-prestation";
import type { OffreFormatPedagogique } from "../../../../prisma/generated/client";

/** Les 8 valeurs de l'enum Prisma, écrites À LA MAIN — un ajout doit se voir. */
const TOUS_LES_FORMATS: OffreFormatPedagogique[] = [
  "collectif_4h",
  "collectif_1jour",
  "collectif_2jours",
  "collectif_3jours",
  "conference",
  "dirigeant_1to1",
  "individuel",
  "sur_devis",
];

describe("famillePrestation", () => {
  it("classe chaque format dans une famille connue — aucun trou", () => {
    const familles: FamillePrestation[] = ["collectif", "un_a_un", "sur_devis"];
    for (const f of TOUS_LES_FORMATS) {
      expect(familles).toContain(famillePrestation(f));
    }
  });

  it("les formats collectifs (conférence incluse) sont du collectif", () => {
    expect(famillePrestation("collectif_4h")).toBe("collectif");
    expect(famillePrestation("collectif_1jour")).toBe("collectif");
    expect(famillePrestation("collectif_2jours")).toBe("collectif");
    expect(famillePrestation("collectif_3jours")).toBe("collectif");
    // Un intervenant, une salle, un groupe : collectif, pas individuel.
    expect(famillePrestation("conference")).toBe("collectif");
  });

  it("dirigeant_1to1 et individuel sont du 1-to-1 — ce sont LES offres sans formation", () => {
    expect(estOffreUnAUn("dirigeant_1to1")).toBe(true);
    expect(estOffreUnAUn("individuel")).toBe(true);
  });

  it("sur_devis n'est PAS présumé 1-to-1 (il peut être un collectif atypique)", () => {
    expect(famillePrestation("sur_devis")).toBe("sur_devis");
    expect(estOffreUnAUn("sur_devis")).toBe(false);
  });

  it("aucun format collectif n'est pris pour du 1-to-1", () => {
    const collectifs = TOUS_LES_FORMATS.filter((f) => famillePrestation(f) === "collectif");
    expect(collectifs).toHaveLength(5);
    for (const f of collectifs) expect(estOffreUnAUn(f)).toBe(false);
  });
});

describe("cheminPublicOffre", () => {
  it("une offre collective pointe vers sa fiche /formations/<slug>", () => {
    expect(cheminPublicOffre("collectif_1jour", "ia-pour-les-equipes")).toBe(
      "/formations/ia-pour-les-equipes",
    );
  });

  /**
   * 🔴 Le cas qui a motivé ce module. Testé en prod le 2026-08-05 :
   * `/fr/formations/dirigeants` → 404, `/fr/un-a-un` → 200.
   */
  it("une prestation individuelle pointe vers /un-a-un, JAMAIS vers /formations/<slug>", () => {
    expect(cheminPublicOffre("dirigeant_1to1", "dirigeants")).toBe("/un-a-un");
    expect(cheminPublicOffre("individuel", "membre-equipe")).toBe("/un-a-un");
    expect(cheminPublicOffre("dirigeant_1to1", "vision-ia-strategique")).not.toContain(
      "/formations/",
    );
  });

  it("« Sur demande » n'annonce aucune page — mieux vaut rien qu'un lien mort", () => {
    expect(cheminPublicOffre("sur_devis", "sur-demande")).toBeNull();
  });

  it("un slug vide ne fabrique pas une URL tronquée", () => {
    expect(cheminPublicOffre("collectif_4h", "")).toBeNull();
  });
});
