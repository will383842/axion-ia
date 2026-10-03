/**
 * Lot OPCO A5 — état des fonds : résolution pure, schéma de saisie, bandeau,
 * données de départ.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  bandeauEtatFonds,
  etatFondsPour,
  normaliserIdcc,
  relevesEnVigueur,
  releveEtatFondsSchema,
  type ReleveEtatFonds,
} from "./etat-fonds-opco";

const AKTO_SRC =
  "https://www.akto.fr/breve/entreprises-moins-50-salaries-suspension-financement-formations-pdc/";

function releve(p: Partial<ReleveEtatFonds>): ReleveEtatFonds {
  return {
    id: p.id ?? "r",
    opco: p.opco ?? "akto",
    idcc: p.idcc ?? null,
    statut: p.statut ?? "ouvert",
    perimetre: p.perimetre ?? null,
    dateLimiteDepot: p.dateLimiteDepot ?? null,
    sourceUrl: p.sourceUrl ?? AKTO_SRC,
    releveLe: p.releveLe ?? new Date("2026-10-04T00:00:00Z"),
    note: p.note ?? null,
    createdAt: p.createdAt ?? new Date("2026-10-04T08:00:00Z"),
  };
}

const LE_4_OCTOBRE = new Date("2026-10-04T10:00:00Z");

const suspensionDechets = releve({
  id: "branche",
  idcc: "2149",
  statut: "suspendu",
  perimetre: "Activités du déchet — entreprises de moins de 50 salariés",
});

describe("etatFondsPour — résolution", () => {
  it("rien quand aucun relevé ne concerne l'OPCO", () => {
    expect(
      etatFondsPour({
        opco: "atlas",
        idcc: "1486",
        effectif: 5,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      }),
    ).toBeNull();
    expect(
      etatFondsPour({
        opco: null,
        idcc: null,
        effectif: null,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      }),
    ).toBeNull();
  });

  it("le relevé de la BRANCHE l'emporte sur celui de l'OPCO entier", () => {
    const opcoEntier = releve({
      id: "opco",
      statut: "ouvert",
      dateLimiteDepot: new Date("2026-12-31T00:00:00Z"),
    });
    const r = etatFondsPour({
      opco: "akto",
      idcc: "2149",
      effectif: 12,
      aLaDate: LE_4_OCTOBRE,
      releves: [opcoEntier, suspensionDechets],
    });
    expect(r?.statut).toBe("suspendu");
    expect(r?.source).toBe(AKTO_SRC);
    // Une autre branche du même OPCO retombe sur la ligne OPCO.
    const autre = etatFondsPour({
      opco: "akto",
      idcc: "1979",
      effectif: 12,
      aLaDate: LE_4_OCTOBRE,
      releves: [opcoEntier, suspensionDechets],
    });
    expect(autre?.statut).toBe("ouvert");
  });

  it("l'IDCC saisi librement est normalisé (« 573 », « IDCC 0573 »)", () => {
    expect(normaliserIdcc("573")).toBe("0573");
    expect(normaliserIdcc("IDCC 0573")).toBe("0573");
    expect(normaliserIdcc("")).toBeNull();
    expect(normaliserIdcc("12345")).toBeNull();
    const r = etatFondsPour({
      opco: "akto",
      idcc: " 2149 ",
      effectif: 3,
      aLaDate: LE_4_OCTOBRE,
      releves: [suspensionDechets],
    });
    expect(r?.statut).toBe("suspendu");
  });

  it("le DERNIER relevé fait foi (releveLe, puis createdAt) — jamais l'ordre de lecture", () => {
    const reouvert = releve({
      id: "reouvert",
      idcc: "2149",
      statut: "ouvert",
      releveLe: new Date("2026-11-02T00:00:00Z"),
    });
    const memeJourPlusTard = releve({
      id: "tard",
      idcc: "2149",
      statut: "reduit",
      releveLe: new Date("2026-11-02T00:00:00Z"),
      createdAt: new Date("2026-11-02T15:00:00Z"),
    });
    const a = new Date("2026-11-03T10:00:00Z");
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 5,
        aLaDate: a,
        releves: [reouvert, suspensionDechets],
      })?.statut,
    ).toBe("ouvert");
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 5,
        aLaDate: a,
        releves: [suspensionDechets, reouvert],
      })?.statut,
    ).toBe("ouvert");
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 5,
        aLaDate: a,
        releves: [memeJourPlusTard, reouvert, suspensionDechets],
      })?.statut,
    ).toBe("reduit");
    // Un relevé daté APRÈS la date demandée n'est pas encore connu.
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 5,
        aLaDate: LE_4_OCTOBRE,
        releves: [reouvert, suspensionDechets],
      })?.statut,
    ).toBe("suspendu");
  });

  it("effectif 50 : la suspension « moins de 50 salariés » est IGNORÉE", () => {
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 50,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      }),
    ).toBeNull();
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 49,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      })?.statut,
    ).toBe("suspendu");
    // Effectif inconnu : prudence, la suspension s'affiche.
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: null,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      })?.statut,
    ).toBe("suspendu");
    // Une suspension SANS seuil vaut pour tous.
    const sansSeuil = releve({ idcc: "2149", statut: "suspendu", perimetre: "Toutes tailles" });
    expect(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 300,
        aLaDate: LE_4_OCTOBRE,
        releves: [sansSeuil],
      })?.statut,
    ).toBe("suspendu");
  });

  it("date limite : dépassée le lendemain, pas le jour même (jour civil de Paris)", () => {
    const atlas = releve({
      opco: "atlas",
      dateLimiteDepot: new Date("2026-12-30T00:00:00Z"),
      sourceUrl: "https://www.opco-atlas.fr/conditions-generales.html",
    });
    const leJour = etatFondsPour({
      opco: "atlas",
      idcc: null,
      effectif: 8,
      aLaDate: new Date("2026-12-30T22:30:00Z"),
      releves: [atlas],
    });
    // 22 h 30 UTC le 30 = 23 h 30 à Paris : encore le 30.
    expect(leJour?.depasse).toBe(false);
    const lendemain = etatFondsPour({
      opco: "atlas",
      idcc: null,
      effectif: 8,
      aLaDate: new Date("2026-12-30T23:30:00Z"),
      releves: [atlas],
    });
    expect(lendemain?.depasse).toBe(true);
    expect(lendemain?.dateLimiteDepot?.toISOString().slice(0, 10)).toBe("2026-12-30");
  });
});

describe("bandeauEtatFonds", () => {
  it("rouge pour une suspension, avec source et date du relevé", () => {
    const b = bandeauEtatFonds(
      etatFondsPour({
        opco: "akto",
        idcc: "2149",
        effectif: 5,
        aLaDate: LE_4_OCTOBRE,
        releves: [suspensionDechets],
      }),
    );
    expect(b?.ton).toBe("rouge");
    expect(b?.texte).toContain("Financement suspendu pour cette branche");
    expect(b?.texte).toContain("04/10/2026");
    expect(b?.source).toBe(AKTO_SRC);
  });

  it("orange avant la date limite, orange « dépassée » après", () => {
    const r = releve({ opco: "opcommerce", dateLimiteDepot: new Date("2026-11-30T00:00:00Z") });
    const avant = bandeauEtatFonds(
      etatFondsPour({
        opco: "opcommerce",
        idcc: null,
        effectif: 5,
        aLaDate: LE_4_OCTOBRE,
        releves: [r],
      }),
    );
    expect(avant).toMatchObject({ ton: "orange", texte: "Dépôt avant le 30/11/2026" });
    const apres = bandeauEtatFonds(
      etatFondsPour({
        opco: "opcommerce",
        idcc: null,
        effectif: 5,
        aLaDate: new Date("2026-12-02T10:00:00Z"),
        releves: [r],
      }),
    );
    expect(apres?.ton).toBe("orange");
    expect(apres?.texte).toContain("Date limite dépassée");
  });

  it("absent sans relevé, ou pour un OPCO ouvert sans date limite", () => {
    expect(bandeauEtatFonds(null)).toBeNull();
    const ouvert = releve({ opco: "afdas" });
    expect(
      bandeauEtatFonds(
        etatFondsPour({
          opco: "afdas",
          idcc: null,
          effectif: 5,
          aLaDate: LE_4_OCTOBRE,
          releves: [ouvert],
        }),
      ),
    ).toBeNull();
  });
});

describe("relevesEnVigueur", () => {
  it("garde un relevé par couple (opco, idcc) : le plus récent", () => {
    const vieux = releve({ id: "vieux", idcc: "2149", releveLe: new Date("2026-09-01T00:00:00Z") });
    const opco = releve({ id: "opco" });
    const ids = relevesEnVigueur([vieux, suspensionDechets, opco])
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual(["branche", "opco"]);
  });
});

describe("releveEtatFondsSchema — saisie console", () => {
  const base = {
    opco: "akto",
    idcc: "2149",
    statut: "suspendu",
    sourceUrl: AKTO_SRC,
    releveLe: "2026-10-04",
  };
  it("accepte un relevé sourcé en https", () => {
    expect(releveEtatFondsSchema.safeParse(base).success).toBe(true);
    expect(releveEtatFondsSchema.safeParse({ ...base, idcc: "" }).success).toBe(true);
  });
  it("refuse une source non https, absente, ou un IDCC mal formé", () => {
    expect(
      releveEtatFondsSchema.safeParse({ ...base, sourceUrl: "http://www.akto.fr/x" }).success,
    ).toBe(false);
    expect(
      releveEtatFondsSchema.safeParse({ ...base, sourceUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(releveEtatFondsSchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(false);
    expect(releveEtatFondsSchema.safeParse({ ...base, idcc: "214" }).success).toBe(false);
    expect(releveEtatFondsSchema.safeParse({ ...base, statut: "ferme" }).success).toBe(false);
    expect(releveEtatFondsSchema.safeParse({ ...base, opco: "inconnu" }).success).toBe(false);
  });
});

describe("migration 20261004110000_etat_fonds_opco — données de départ", () => {
  const sql = readFileSync(
    join(process.cwd(), "prisma/migrations/20261004110000_etat_fonds_opco/migration.sql"),
    "utf8",
  )
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("idempotente : autant de WHERE NOT EXISTS que d'INSERT, ni UPDATE ni DELETE", () => {
    const inserts = sql.match(/\bINSERT\s+INTO\b/gi) ?? [];
    const gardes = sql.match(/\bWHERE\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    expect(gardes.length).toBe(inserts.length);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
  });

  it("porte les dix IDCC AKTO vérifiés, zéros de tête compris", () => {
    for (const idcc of [
      "2149",
      "2583",
      "0573",
      "3243",
      "3218",
      "7520",
      "2002",
      "1516",
      "2147",
      "0158",
    ]) {
      expect(sql).toContain(`('${idcc}',`);
    }
    expect(sql).not.toMatch(/forestières/i);
  });
});
