/**
 * Référent handicap PUBLIC (indicateur 26) — nommé ET joignable, lu depuis la
 * configuration Qualiopi, avec un repli propre quand elle n'est pas lisible
 * (build `stub.invalid`) ou pas renseignée.
 *
 * Et le rendu des fiches formation : le texte d'accessibilité doit porter ce
 * contact, et ne plus citer l'article L.6352-3 (qui porte sur le règlement
 * intérieur, pas sur le référent handicap).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn() },
  },
}));

// `_guards` importe next-auth (crash sous vitest) — lecture seule ici.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import {
  formationAccessibiliteDefaut,
  getFormationAccessibilite,
} from "@/content/formations/catalog-v2-facts";
import { computeReferentHandicapPublic, REFERENT_HANDICAP_REPLI } from "./referent-handicap-public";

const mockFindUnique = prisma.siteSetting.findUnique as unknown as ReturnType<typeof vi.fn>;

function seedConfig(store: Record<string, string>) {
  mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
    Object.prototype.hasOwnProperty.call(store, where.key) ? { value: store[where.key] } : null,
  );
}

beforeEach(() => {
  mockFindUnique.mockReset();
});

describe("computeReferentHandicapPublic", () => {
  it("rend le nom ET l'e-mail saisis en configuration", async () => {
    seedConfig({
      "qualiopi.referent_handicap_nom": "Camille Exemple",
      "qualiopi.referent_handicap_email": "camille@example.com",
    });
    await expect(computeReferentHandicapPublic()).resolves.toEqual({
      nom: "Camille Exemple",
      email: "camille@example.com",
    });
  });

  it("base vierge : n'affiche PAS le nom par défaut du registre, rend le repli", async () => {
    // Aucune ligne : le nom vaut le défaut du registre, l'e-mail est vide.
    // Le nom seul ne prouve pas la désignation (même prédicat que off.26).
    seedConfig({});
    const r = await computeReferentHandicapPublic();
    expect(r).toEqual(REFERENT_HANDICAP_REPLI);
    expect(r.nom).toBe("");
    expect(r.email).toBe("handicap@axion-ia.com");
  });

  it("base illisible (build stub, DB en panne) : repli, jamais d'exception", async () => {
    mockFindUnique.mockRejectedValue(new Error("stub.invalid"));
    await expect(computeReferentHandicapPublic()).resolves.toEqual(REFERENT_HANDICAP_REPLI);
  });

  it("n'expose aucun numéro de téléphone", async () => {
    seedConfig({
      "qualiopi.referent_handicap_nom": "Camille Exemple",
      "qualiopi.referent_handicap_email": "camille@example.com",
      "qualiopi.referent_handicap_telephone": "+33639981234",
    });
    const r = await computeReferentHandicapPublic();
    expect(JSON.stringify(r)).not.toContain("639981234");
  });
});

describe("fiches formation — texte accessibilité & handicap", () => {
  it("nomme le référent et donne son e-mail quand il est désigné", () => {
    const t = formationAccessibiliteDefaut({
      nom: "Camille Exemple",
      email: "camille@example.com",
    });
    expect(t).toContain("Camille Exemple");
    expect(t).toContain("camille@example.com");
  });

  it("repli : « le référent handicap » + adresse générique, sans nom inventé", () => {
    const t = formationAccessibiliteDefaut(REFERENT_HANDICAP_REPLI);
    expect(t.toLowerCase()).toContain("référent handicap");
    expect(t).toContain("handicap@axion-ia.com");
  });

  it("cite l'indicateur 26 du Référentiel national qualité, plus l'article L.6352-3", () => {
    const t = formationAccessibiliteDefaut(REFERENT_HANDICAP_REPLI);
    expect(t).toContain("indicateur 26 du Référentiel national qualité");
    expect(t).not.toContain("L.6352-3");
  });

  it("chacune des fiches du catalogue porte le contact du référent", () => {
    const ref = { nom: "Camille Exemple", email: "camille@example.com" };
    for (const f of FORMATIONS_V2) {
      expect(getFormationAccessibilite(f, ref), f.id).toContain("camille@example.com");
    }
  });
});
