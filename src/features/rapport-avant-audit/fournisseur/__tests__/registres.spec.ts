import { describe, expect, it, vi } from "vitest";

import { annoncesBodacc, ErreurRegistre, rechercherEntreprise } from "../registres";

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut });

const ENTREPRISE = {
  results: [
    {
      siren: "123456789",
      nom_complet: "EXEMPLE SAS",
      nature_juridique: "5710",
      activite_principale: "62.01Z",
      tranche_effectif_salarie: "12",
      date_creation: "2015-03-01",
      etat_administratif: "A",
      nombre_etablissements: 2,
      nombre_etablissements_ouverts: 1,
      siege: {
        siret: "12345678900011",
        adresse: "1 RUE DU TEST",
        code_postal: "75001",
        libelle_commune: "PARIS",
        activite_principale: "62.01Z",
        est_siege: true,
        etat_administratif: "A",
      },
      matching_etablissements: [{ siret: "12345678900029", etat_administratif: "F" }],
      dirigeants: [
        {
          nom: "DUPONT",
          prenoms: "Alice",
          qualite: "Président",
          type_dirigeant: "personne physique",
          date_de_naissance: "1980-01",
        },
        {
          denomination: "HOLDING SA",
          qualite: "Commissaire aux comptes",
          type_dirigeant: "personne morale",
        },
      ],
      finances: {
        "2022": { ca: 900000, resultat_net: 50000 },
        "2023": { ca: 1000000, resultat_net: null },
      },
    },
  ],
};

describe("rechercherEntreprise", () => {
  it("parse une réponse d'exemple, sans donnée personnelle hors dirigeants publiés", async () => {
    const f = vi.fn().mockResolvedValue(json(ENTREPRISE));
    const [e] = await rechercherEntreprise("123 456 789", f);
    expect(f.mock.calls[0]![0]).toContain("q=123456789");
    expect(e).toMatchObject({
      siren: "123456789",
      nom: "EXEMPLE SAS",
      naf: "62.01Z",
      trancheEffectif: "12",
      active: true,
      nbEtablissements: 2,
    });
    expect(e!.siege).toMatchObject({ siret: "12345678900011", commune: "PARIS", siege: true });
    expect(e!.etablissements[0]).toMatchObject({ actif: false });
    expect(e!.dirigeants).toEqual([
      { nom: "Alice DUPONT", qualite: "Président", personnePhysique: true },
      { nom: "HOLDING SA", qualite: "Commissaire aux comptes", personnePhysique: false },
    ]);
    expect(JSON.stringify(e)).not.toContain("1980");
    expect(e!.finances.map((x) => x.annee)).toEqual([2023, 2022]);
    expect(e!.finances[0]).toEqual({ annee: 2023, chiffreAffaires: 1000000, resultatNet: null });
  });

  it("cherche par nom, et rejette HTTP en erreur ou forme inattendue", async () => {
    const f = vi.fn().mockResolvedValue(json({ results: [] }));
    expect(await rechercherEntreprise("Exemple & Fils", f)).toEqual([]);
    expect(f.mock.calls[0]![0]).toContain("q=Exemple+%26+Fils");
    await expect(rechercherEntreprise("x", async () => json({}, 500))).rejects.toBeInstanceOf(
      ErreurRegistre,
    );
    await expect(rechercherEntreprise("x", async () => json({ foo: 1 }))).rejects.toThrow(
      /inattendue/,
    );
    await expect(rechercherEntreprise("  ", f)).rejects.toThrow(/vide/);
  });
});

describe("robustesse des registres", () => {
  it("429 : un seul réessai après 1 s (délais simulés), puis ErreurRegistre", async () => {
    vi.useFakeTimers();
    try {
      const f = vi
        .fn()
        .mockResolvedValueOnce(json({}, 429))
        .mockResolvedValueOnce(json({ results: [] }));
      const p = rechercherEntreprise("x", f);
      await vi.advanceTimersByTimeAsync(999);
      expect(f).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(p).resolves.toEqual([]);
      expect(f.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);

      const g = vi.fn().mockResolvedValue(json({}, 429));
      const q = expect(annoncesBodacc("123456789", g)).rejects.toThrow(/429/);
      await vi.advanceTimersByTimeAsync(1_000);
      await q;
      expect(g).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("JSON invalide et erreur réseau deviennent des ErreurRegistre", async () => {
    const mal = async () => new Response("<html>", { status: 200 });
    await expect(rechercherEntreprise("x", mal)).rejects.toThrow(/JSON invalide/);
    await expect(annoncesBodacc("123456789", mal)).rejects.toThrow(/JSON invalide/);
    const coupure = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(rechercherEntreprise("x", coupure)).rejects.toBeInstanceOf(ErreurRegistre);
  });
});

describe("annoncesBodacc", () => {
  it("parse une réponse d'exemple", async () => {
    const f = vi.fn().mockResolvedValue(
      json({
        results: [
          {
            id: "B202600123",
            numeroannonce: 456,
            dateparution: "2026-02-10",
            typeavis_lib: "Annonce",
            familleavis_lib: "Dépôts des comptes",
            commercant: "EXEMPLE SAS",
            ville: "PARIS",
            cp: "75001",
            tribunal: "TC PARIS",
          },
        ],
      }),
    );
    const r = await annoncesBodacc("123 456 789", f);
    expect(decodeURIComponent(f.mock.calls[0]![0]).replace(/\+/g, " ")).toContain(
      'registre like "123456789"',
    );
    expect(r).toEqual([
      {
        id: "B202600123",
        numero: "456",
        date: "2026-02-10",
        type: "Annonce",
        famille: "Dépôts des comptes",
        denomination: "EXEMPLE SAS",
        ville: "PARIS",
        codePostal: "75001",
        tribunal: "TC PARIS",
      },
    ]);
  });

  it("refuse un SIREN invalide sans appel réseau", async () => {
    const f = vi.fn();
    await expect(annoncesBodacc("12", f)).rejects.toBeInstanceOf(ErreurRegistre);
    expect(f).not.toHaveBeenCalled();
  });
});
