// B1 bis (lot L1b) : un dossier résilié ne s'ouvre, en mode restreint, que si de l'argent est en jeu.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ statut: "resilie", argent: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ versionLien: 1, statut: etat.statut })),
    },
  },
}));
vi.mock("../jeton", () => ({
  lienDossierBienForme: () => true,
  jetonDossierValide: () => true,
  urlDossier: () => null,
}));
vi.mock("../retrait", () => ({
  retraitDe: vi.fn(async () => null),
  argentEnJeu: vi.fn(async () => etat.argent),
}));

import * as donnees from "../donnees";

beforeEach(() => {
  etat.statut = "resilie";
  etat.argent = false;
});

describe("lireDossierParLien : dossier résilié", () => {
  it("sans argent en jeu : plus de page neutre, l'archive en lecture (PR K) — voir resilie-paye-lit-ses-pieces.spec.ts", () => {
    expect(typeof donnees.lireDossierParLien).toBe("function");
  });
});
