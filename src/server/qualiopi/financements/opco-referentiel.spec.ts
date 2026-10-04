/**
 * Tests — opco-referentiel.ts (Lot 5, module PUR).
 *
 * Couvre : liste canonique + garde de type isOpcoId, opcoLabel (fallback),
 * estBaremePerime (seuil mois, relevé absent = périmé, bornes), fiches OPCO
 * sourcées (OPCO_FICHES) et fonctions de date dérivées.
 */

import { describe, it, expect } from "vitest";
import {
  OPCO_FICHES,
  OPCO_IDS,
  OPCO_LABELS,
  dateLimiteDepotPourSession,
  dateLimiteFacturation,
  estBaremePerime,
  faitsAVerifier,
  isOpcoId,
  opcoLabel,
  type Fait,
  opcoDuClient,
  nomOpcoDuClient,
} from "./opco-referentiel";

describe("OPCO_IDS / OPCO_LABELS", () => {
  it("contient les 11 OPCO agréés", () => {
    expect(OPCO_IDS).toHaveLength(11);
  });

  it("préserve les 5 identifiants déjà émis par inferOpcoFromNaf (verbatim)", () => {
    for (const id of ["atlas", "akto", "opco2i", "constructys", "opcommerce"] as const) {
      expect(OPCO_IDS).toContain(id);
    }
  });

  it("a un libellé pour chaque identifiant", () => {
    for (const id of OPCO_IDS) {
      expect(OPCO_LABELS[id]).toBeTruthy();
    }
  });
});

describe("isOpcoId", () => {
  it("vrai pour un identifiant connu", () => {
    expect(isOpcoId("atlas")).toBe(true);
    expect(isOpcoId("opco_sante")).toBe(true);
  });

  it("faux pour inconnu / null / undefined / vide", () => {
    expect(isOpcoId("inconnu")).toBe(false);
    expect(isOpcoId(null)).toBe(false);
    expect(isOpcoId(undefined)).toBe(false);
    expect(isOpcoId("")).toBe(false);
  });
});

describe("opcoLabel", () => {
  it("renvoie le libellé pour un OPCO connu", () => {
    expect(opcoLabel("atlas")).toBe("Atlas");
    expect(opcoLabel("opco2i")).toBe("OPCO 2i");
  });

  it("renvoie la chaîne brute pour un OPCO inconnu", () => {
    expect(opcoLabel("mystere")).toBe("mystere");
  });

  it("renvoie « — » pour null/undefined", () => {
    expect(opcoLabel(null)).toBe("—");
    expect(opcoLabel(undefined)).toBe("—");
  });
});

describe("opcoDuClient / nomOpcoDuClient — une seule règle de résolution", () => {
  it("OPCO typé d'abord, même si le texte libre dit autre chose", () => {
    const c = { opco: "akto", opcoIdentifie: "atlas" };
    expect(opcoDuClient(c)).toBe("akto");
    expect(nomOpcoDuClient(c)).toBe("Akto");
  });
  it("typé absent → texte libre s'il est un identifiant connu", () => {
    expect(opcoDuClient({ opco: null, opcoIdentifie: "atlas" })).toBe("atlas");
  });
  it("texte libre inconnu → pas d'identifiant, mais le nom affiché le reprend", () => {
    const c = { opco: null, opcoIdentifie: "OPCO du coin" };
    expect(opcoDuClient(c)).toBeNull();
    expect(nomOpcoDuClient(c)).toBe("OPCO du coin");
  });
  it("rien → null / « OPCO (à préciser) »", () => {
    expect(opcoDuClient(null)).toBeNull();
    expect(nomOpcoDuClient({ opco: null, opcoIdentifie: "  " })).toBe("OPCO (à préciser)");
  });
});

describe("estBaremePerime", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("relevé absent → périmé", () => {
    expect(estBaremePerime(null, 12, now)).toBe(true);
    expect(estBaremePerime(undefined, 12, now)).toBe(true);
  });

  it("relevé récent (< seuil) → non périmé", () => {
    expect(estBaremePerime(new Date("2026-05-01T00:00:00.000Z"), 12, now)).toBe(false);
  });

  it("relevé plus vieux que le seuil → périmé", () => {
    // 14 mois avant now, seuil 12 mois
    expect(estBaremePerime(new Date("2025-05-01T00:00:00.000Z"), 12, now)).toBe(true);
  });

  it("relevé exactement au seuil → non périmé (strictement <)", () => {
    // now - 12 mois = 2025-07-13
    expect(estBaremePerime(new Date("2025-07-13T12:00:00.000Z"), 12, now)).toBe(false);
  });

  it("respecte un seuil personnalisé (6 mois)", () => {
    expect(estBaremePerime(new Date("2026-01-01T00:00:00.000Z"), 6, now)).toBe(true);
    expect(estBaremePerime(new Date("2026-03-01T00:00:00.000Z"), 6, now)).toBe(false);
  });

  it("gère la fin de mois sans débordement (31 mars − 1 mois = 28 févr, pas 3 mars)", () => {
    const finMars = new Date("2026-03-31T12:00:00.000Z");
    // Seuil = 28 févr 2026 ; un relevé du 10 mars est donc DANS la validité (non périmé).
    expect(estBaremePerime(new Date("2026-03-10T12:00:00.000Z"), 1, finMars)).toBe(false);
    // Un relevé du 20 févr (avant le 28 févr) est périmé.
    expect(estBaremePerime(new Date("2026-02-20T12:00:00.000Z"), 1, finMars)).toBe(true);
  });
});

describe("OPCO_FICHES — chaque fait est sourcé et daté", () => {
  const tousLesFaits = OPCO_IDS.flatMap((id) =>
    Object.entries(OPCO_FICHES[id]).map(([champ, fait]) => ({
      id,
      champ,
      fait: fait as Fait<unknown>,
    })),
  );

  it("a une fiche pour chacun des 11 OPCO, avec les 7 champs", () => {
    expect(Object.keys(OPCO_FICHES).sort()).toEqual([...OPCO_IDS].sort());
    for (const id of OPCO_IDS) {
      expect(Object.keys(OPCO_FICHES[id]).sort()).toEqual(
        [
          "dateLimiteDepot2026",
          "delaiDepotJours",
          "delaiFacturationJours",
          "modeDeDepotConstate",
          "opcoHorsChampTva",
          "portailEntrepriseUrl",
          "portailOfUrl",
        ].sort(),
      );
    }
  });

  it("tout fait porte une date de relevé ISO AAAA-MM-JJ", () => {
    for (const { fait } of tousLesFaits) {
      expect(fait.releveLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(fait.releveLe))).toBe(false);
    }
  });

  it("tout fait non null porte une source http(s)", () => {
    for (const { id, champ, fait } of tousLesFaits) {
      if (fait.valeur === null) continue;
      expect(fait.source, `${id}.${champ}`).toMatch(/^https?:\/\/\S+$/);
    }
  });

  it("tout fait null est marqué « à vérifier » (on n'invente rien)", () => {
    for (const { id, champ, fait } of tousLesFaits) {
      if (fait.valeur !== null) continue;
      expect(fait.aVerifier, `${id}.${champ}`).toBe(true);
    }
  });

  it("les URL de portail, quand elles sont connues, sont en https", () => {
    for (const id of OPCO_IDS) {
      for (const champ of ["portailEntrepriseUrl", "portailOfUrl"] as const) {
        const v = OPCO_FICHES[id][champ].valeur;
        if (v !== null) expect(v).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("OPCO_FICHES — faits témoins", () => {
  it("Atlas : dépôt depuis le compte adhérent de l'entreprise", () => {
    expect(OPCO_FICHES.atlas.modeDeDepotConstate.valeur).toBe("compte_adherent");
  });

  it("faits relus dans les PDF officiels le 2026-10-04 : OPCO EP 30 j de dépôt, OPCO 2i 120 j", () => {
    expect(OPCO_FICHES.opco_ep.delaiDepotJours.valeur).toBe(30);
    expect(OPCO_FICHES.opco2i.delaiFacturationJours.valeur).toBe(120);
    expect(OPCO_FICHES.opco2i.modeDeDepotConstate.valeur).toBe("compte_adherent");
    expect(OPCO_FICHES.atlas.delaiFacturationJours.aVerifier).toBeUndefined();
  });

  it("Atlas : facturation au plus tard 90 jours après la fin", () => {
    expect(OPCO_FICHES.atlas.delaiFacturationJours.valeur).toBe(90);
  });

  it("Opco Santé et Uniformation sont hors champ TVA, les 9 autres non", () => {
    const horsChamp = OPCO_IDS.filter((id) => OPCO_FICHES[id].opcoHorsChampTva.valeur === true);
    const dansLeChamp = OPCO_IDS.filter((id) => OPCO_FICHES[id].opcoHorsChampTva.valeur === false);
    expect(horsChamp.sort()).toEqual(["opco_sante", "uniformation"]);
    expect(dansLeChamp).toHaveLength(9);
  });

  it("ne modifie pas les libellés imprimés sur les conventions", () => {
    expect(OPCO_LABELS.opcommerce).toBe("OPCOMMERCE");
    expect(OPCO_LABELS.opco_sante).toBe("OPCO Santé");
  });
});

describe("dateLimiteDepotPourSession", () => {
  it("début − délai (Constructys, 15 jours calendaires)", () => {
    expect(
      dateLimiteDepotPourSession(
        "constructys",
        new Date("2026-11-20T00:00:00.000Z"),
      )?.toISOString(),
    ).toBe("2026-11-05T00:00:00.000Z");
  });

  it("franchit le changement d'année (Constructys, début le 10 janvier)", () => {
    expect(
      dateLimiteDepotPourSession(
        "constructys",
        new Date("2027-01-10T00:00:00.000Z"),
      )?.toISOString(),
    ).toBe("2026-12-26T00:00:00.000Z");
  });

  it("délai nul : au plus tard le jour du début (Ocapiat)", () => {
    expect(
      dateLimiteDepotPourSession("ocapiat", new Date("2026-12-01T00:00:00.000Z"))?.toISOString(),
    ).toBe("2026-12-01T00:00:00.000Z");
  });

  it("délai inconnu → null, jamais une date inventée", () => {
    for (const id of OPCO_IDS) {
      if (OPCO_FICHES[id].delaiDepotJours.valeur !== null) continue;
      expect(dateLimiteDepotPourSession(id, new Date("2026-12-01T00:00:00.000Z"))).toBeNull();
    }
  });

  it("ne mute pas la date reçue", () => {
    const debut = new Date("2026-11-20T00:00:00.000Z");
    dateLimiteDepotPourSession("constructys", debut);
    expect(debut.toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });
});

describe("dateLimiteFacturation", () => {
  it("fin + délai, au changement d'année (Atlas, 90 jours)", () => {
    expect(
      dateLimiteFacturation("atlas", new Date("2026-11-15T00:00:00.000Z"))?.toISOString(),
    ).toBe("2027-02-13T00:00:00.000Z");
  });

  it("délai inconnu → null", () => {
    for (const id of OPCO_IDS) {
      if (OPCO_FICHES[id].delaiFacturationJours.valeur !== null) continue;
      expect(dateLimiteFacturation(id, new Date("2026-11-15T00:00:00.000Z"))).toBeNull();
    }
  });
});

describe("faitsAVerifier", () => {
  it("liste exactement les champs marqués « à vérifier »", () => {
    const attendus = OPCO_IDS.flatMap((id) =>
      Object.entries(OPCO_FICHES[id])
        .filter(([, f]) => (f as Fait<unknown>).aVerifier === true)
        .map(([champ]) => `${id}.${champ}`),
    );
    const liste = faitsAVerifier();
    expect(liste.map((f) => `${f.opco}.${f.champ}`).sort()).toEqual(attendus.sort());
    expect(liste.length).toBeGreaterThan(0);
  });

  it("porte le libellé de l'OPCO et la valeur courante pour l'écran", () => {
    const f = faitsAVerifier()[0]!;
    expect(f.libelle).toBe(OPCO_LABELS[f.opco]);
    expect(f).toHaveProperty("valeur");
  });
});
