/**
 * Tests — moyens/changement-session.ts (chantier QNC, lot L07).
 */

import { describe, expect, it, vi } from "vitest";

import {
  changementsModaliteLieu,
  controlerLienDistanciel,
  enregistrerChangements,
} from "./changement-session";

const LIEU = {
  lieuType: "nos_locaux",
  lieuIntitule: "Salle Fraunces",
  lieuAdresse: "1 rue X",
  lieuCodePostal: "69001",
  lieuVille: "Lyon",
  lieuSalle: null,
  lieuVisioUrl: null,
};

describe("changementsModaliteLieu", () => {
  it("rien ne change : aucune ligne", () => {
    expect(
      changementsModaliteLieu(
        { modalite: "presentiel", ...LIEU },
        { modalite: "presentiel", ...LIEU },
      ),
    ).toEqual([]);
  });
  it("modalité seule : une ligne « modalite »", () => {
    const c = changementsModaliteLieu(
      { modalite: "presentiel", ...LIEU },
      { modalite: "distanciel", ...LIEU },
    );
    expect(c).toEqual([
      { nature: "modalite", avant: { modalite: "presentiel" }, apres: { modalite: "distanciel" } },
    ]);
  });
  it("lieu seul : une ligne « lieu » avec les champs changés", () => {
    const c = changementsModaliteLieu(
      { modalite: "presentiel", ...LIEU },
      { modalite: "presentiel", ...LIEU, lieuVille: "Paris", lieuCodePostal: "75001" },
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      nature: "lieu",
      avant: { lieuVille: "Lyon", lieuCodePostal: "69001" },
      apres: { lieuVille: "Paris", lieuCodePostal: "75001" },
    });
  });
  it("les deux : deux lignes ; null et chaîne vide sont la même absence", () => {
    const c = changementsModaliteLieu(
      { modalite: "presentiel", ...LIEU },
      { modalite: "distanciel", ...LIEU, lieuSalle: "", lieuVisioUrl: "https://zoom.us/j/1" },
    );
    expect(c.map((x) => x.nature)).toEqual(["modalite", "lieu"]);
    expect(Object.keys(c[1]!.apres)).toEqual(["lieuVisioUrl"]);
  });
});

describe("controlerLienDistanciel", () => {
  it("présentiel : pas de lien exigé", () => {
    expect(controlerLienDistanciel("presentiel", null)).toBe("ok");
  });
  it("distanciel sans lien : manquant", () => {
    expect(controlerLienDistanciel("distanciel", null)).toBe("manquant");
    expect(controlerLienDistanciel("distanciel", "  ")).toBe("manquant");
  });
  it("distanciel avec un autre outil : pas Zoom", () => {
    expect(controlerLienDistanciel("distanciel", "https://meet.google.com/a-b-c")).toBe("pas_zoom");
  });
  it("distanciel avec Zoom : ok", () => {
    expect(controlerLienDistanciel("distanciel", "https://us02web.zoom.us/j/123456789")).toBe("ok");
  });
});

describe("enregistrerChangements", () => {
  const auteur = { id: null, nom: "Admin" };
  it("écrit une ligne par changement, avec motif et auteur", async () => {
    const create = vi.fn().mockResolvedValue({});
    await enregistrerChangements(
      { sessionChangementModaliteLieu: { create } },
      "s1",
      [{ nature: "lieu", avant: { lieuVille: "Lyon" }, apres: { lieuVille: "Paris" } }],
      "Client déménagé de site",
      auteur,
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        sessionId: "s1",
        nature: "lieu",
        avant: { lieuVille: "Lyon" },
        apres: { lieuVille: "Paris" },
        motif: "Client déménagé de site",
        auteurId: null,
        auteurNom: "Admin",
      },
    });
  });
});
