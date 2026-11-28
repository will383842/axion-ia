import { describe, expect, it, vi } from "vitest";

import { creerFaux, D, ligne, presentation } from "./file-attente-faux";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../occupation", () => ({ perimetreOccupe: vi.fn(async () => false) }));
vi.mock("../envois", () => ({ envoyer: vi.fn() }));

import { consommerSiRedeclaration, fenetreOuverteParUnAutre } from "../file-attente";

const informee = (o: Record<string, unknown> = {}) =>
  ligne({
    id: "a",
    statut: "informee",
    informeeAt: D("2026-12-01T09:00:00Z"),
    fenetreFinAt: D("2026-12-15T22:59:59.999Z"),
    ...o,
  });

describe("file-attente-redeclaration", () => {
  it("la nouvelle déclaration du premier rang le passe à redeclaree et garde le lien", async () => {
    const { etat, db } = creerFaux({ file: [informee()], presentations: [presentation("P-a")] });
    const recueAt = D("2026-12-05T10:00:00Z");
    const ok = await consommerSiRedeclaration(
      { id: "NEUVE", apporteurId: "APP-a", siren: "123456782", siret: "12345678200017", recueAt },
      db,
    );
    expect(ok).toBe(true);
    expect(etat.file[0]).toMatchObject({
      statut: "redeclaree",
      redeclareePresentationId: "NEUVE",
      clotureeAt: recueAt,
    });
  });

  it("un autre apporteur, ou un autre établissement, ne consomme rien", async () => {
    const { etat, db } = creerFaux({ file: [informee()], presentations: [] });
    const base = { id: "N", siren: "123456782", recueAt: D("2026-12-05T10:00:00Z") };
    expect(
      await consommerSiRedeclaration(
        { ...base, apporteurId: "AUTRE", siret: "12345678200017" },
        db,
      ),
    ).toBe(false);
    expect(
      await consommerSiRedeclaration(
        { ...base, apporteurId: "APP-a", siret: "12345678200025" },
        db,
      ),
    ).toBe(false);
    expect(etat.file[0]!.statut).toBe("informee");
  });

  it("une ligne seulement en_attente n'est pas consommée", async () => {
    const { etat, db } = creerFaux({ file: [ligne({ id: "a" })] });
    expect(
      await consommerSiRedeclaration(
        {
          id: "N",
          apporteurId: "APP-a",
          siren: "123456782",
          siret: "12345678200017",
          recueAt: D("2026-12-05T10:00:00Z"),
        },
        db,
      ),
    ).toBe(false);
    expect(etat.file[0]!.statut).toBe("en_attente");
  });

  it("table absente : ne lève pas (la déclaration est déjà écrite)", async () => {
    const db = {
      declarationEnAttente: {
        findFirst: async () => {
          throw Object.assign(new Error("x"), { code: "P2021" });
        },
      },
    } as never;
    expect(
      await consommerSiRedeclaration(
        {
          id: "N",
          apporteurId: "A",
          siren: "123456782",
          siret: "12345678200017",
          recueAt: new Date(),
        },
        db,
      ),
    ).toBe(false);
  });
});

describe("file-attente-fenetre-bloque-les-autres (lecture)", () => {
  const etab = { siret: "12345678200017", entreprise: false, exclus: [] };
  it("pendant la fenêtre, un tiers est bloqué ; le premier rang ne l'est pas", async () => {
    const { db } = creerFaux({ file: [informee()] });
    const pendant = D("2026-12-10T09:00:00Z");
    expect(
      await fenetreOuverteParUnAutre(
        { siren: "123456782", apporteurId: "TIERS" },
        etab,
        pendant,
        db,
      ),
    ).toBe(true);
    expect(
      await fenetreOuverteParUnAutre(
        { siren: "123456782", apporteurId: "APP-a" },
        etab,
        pendant,
        db,
      ),
    ).toBe(false);
  });

  it("après la fenêtre, ou pour un autre établissement, plus de blocage", async () => {
    const { db } = creerFaux({ file: [informee()] });
    expect(
      await fenetreOuverteParUnAutre(
        { siren: "123456782", apporteurId: "TIERS" },
        etab,
        D("2026-12-16T09:00:00Z"),
        db,
      ),
    ).toBe(false);
    expect(
      await fenetreOuverteParUnAutre(
        { siren: "123456782", apporteurId: "TIERS" },
        { siret: "12345678200025", entreprise: false, exclus: [] },
        D("2026-12-10T09:00:00Z"),
        db,
      ),
    ).toBe(false);
  });

  it("table absente : pas de blocage", async () => {
    const db = {
      declarationEnAttente: {
        findMany: async () => {
          throw Object.assign(new Error("x"), { code: "P2021" });
        },
      },
    } as never;
    expect(
      await fenetreOuverteParUnAutre({ siren: "1", apporteurId: "A" }, etab, new Date(), db),
    ).toBe(false);
  });
});
