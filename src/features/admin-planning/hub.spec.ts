// Tests — hub.ts (agrégation des signaux de pilotage).
//
// Le hub décide de ce qui réveille un pilote la nuit. Ce qu'on teste : la
// FRONTIÈRE entre critique et attention, le fait qu'un conflit ne soit annoncé
// qu'une fois (et pas deux, vu des deux côtés), que le passé n'alarme plus, et
// qu'un formateur non conforme mais NON affecté ne déclenche rien.

import { describe, it, expect } from "vitest";
import { aDesSignauxCritiques, construireHub, JOURS_AVANT_CRITIQUE, type HubEntrees } from "./hub";
import type { ChargeFormateur } from "./charge";
import type { PlanningEvent } from "./types";

const MAINTENANT = new Date("2026-06-10T12:00:00Z");
const PREFIX = "adm";

function jours(n: number): Date {
  return new Date(MAINTENANT.getTime() + n * 86_400_000);
}

function ev(over: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    key: "formation:1",
    type: "formation",
    id: "1",
    titre: "Formation IA",
    debut: jours(10),
    fin: jours(10 + 0.2),
    statut: "planifiee",
    formateurNom: "Ana Roux",
    formateurId: "t1",
    clientNom: "ACME",
    lieu: null,
    ...over,
  };
}

function charge(over: Partial<ChargeFormateur> = {}): ChargeFormateur {
  return {
    trainerId: "t1",
    nom: "Ana Roux",
    joursMobilises: 10,
    capaciteJours: 20,
    tauxPct: 50,
    ...over,
  };
}

function entrees(over: Partial<HubEntrees> = {}): HubEntrees {
  return {
    events: [],
    charges: [],
    conformites: [],
    relevesEnAttente: [],
    anomalies: [],
    indispos: new Map(),
    ...over,
  };
}

/** Jours d'indisponibilité d'un formateur, façon `joursIndisponibles`. */
function indispos(trainerId: string, jours: string[]): Map<string, Set<string>> {
  return new Map([[trainerId, new Set(jours)]]);
}

const hub = (e: Partial<HubEntrees>) => construireHub(entrees(e), MAINTENANT, PREFIX);
const codes = (e: Partial<HubEntrees>) => hub(e).map((s) => s.code);

/* ────────────────────────────────────────────────────────────────────────────── */

describe("construireHub — le silence est le bon résultat", () => {
  it("aucune donnée → aucun signal", () => {
    expect(hub({})).toEqual([]);
    expect(aDesSignauxCritiques([])).toBe(false);
  });

  it("tout va bien → aucun signal", () => {
    expect(
      codes({
        events: [ev()],
        charges: [charge({ tauxPct: 50 })],
        conformites: [{ trainerId: "t1", nom: "Ana Roux", conforme: true, nbBloquants: 0 }],
      }),
    ).toEqual([]);
  });
});

describe("sessions non staffées", () => {
  it("critique quand une session démarre dans la fenêtre de 7 jours", () => {
    const s = hub({
      events: [ev({ formateurId: null, formateurNom: null, debut: jours(3), fin: jours(3.2) })],
    });
    expect(s[0]?.code).toBe("session_non_staffee");
    expect(s[0]?.niveau).toBe("critique");
  });

  it("attention seulement quand elle est lointaine", () => {
    const s = hub({
      events: [ev({ formateurId: null, formateurNom: null, debut: jours(30), fin: jours(30.2) })],
    });
    expect(s[0]?.niveau).toBe("attention");
  });

  it(`la frontière est à ${JOURS_AVANT_CRITIQUE} jours inclus`, () => {
    const pile = hub({
      events: [ev({ formateurId: null, formateurNom: null, debut: jours(7), fin: jours(7.2) })],
    });
    const juste = hub({
      events: [ev({ formateurId: null, formateurNom: null, debut: jours(7.01), fin: jours(7.2) })],
    });
    expect(pile[0]?.niveau).toBe("critique");
    expect(juste[0]?.niveau).toBe("attention");
  });

  it("une session PASSÉE sans formateur n'alarme plus", () => {
    expect(
      codes({
        events: [ev({ formateurId: null, formateurNom: null, debut: jours(-5), fin: jours(-4.8) })],
      }),
    ).toEqual([]);
  });

  it("une session annulée sans formateur n'alarme pas", () => {
    expect(
      codes({ events: [ev({ formateurId: null, formateurNom: null, statut: "annulee" })] }),
    ).toEqual([]);
  });

  it("le lien pointe vers la fiche 360°", () => {
    const s = hub({ events: [ev({ formateurId: null, formateurNom: null, id: "abc" })] });
    expect(s[0]?.items[0]?.href).toBe("/fr/adm/planning/formation/abc");
  });
});

describe("conflits de formateur", () => {
  const a = ev({ key: "f:a", id: "a", titre: "A", debut: jours(2), fin: jours(2.5) });
  const b = ev({ key: "f:b", id: "b", titre: "B", debut: jours(2.2), fin: jours(2.8) });

  it("un chevauchement est toujours critique", () => {
    const s = hub({ events: [a, b] });
    expect(s[0]?.code).toBe("conflit_formateur");
    expect(s[0]?.niveau).toBe("critique");
  });

  it("INVARIANT : une paire n'est annoncée QU'UNE fois, pas deux", () => {
    const s = hub({ events: [a, b] });
    expect(s[0]?.items).toHaveLength(1);
  });

  it("deux formateurs différents ne se conflictent pas entre eux", () => {
    expect(codes({ events: [a, { ...b, formateurId: "t2", formateurNom: "Bo Li" }] })).toEqual([]);
  });

  it("des créneaux jointifs ne sont pas un conflit", () => {
    const c = ev({ key: "f:c", debut: jours(2), fin: jours(2.5) });
    const d = ev({ key: "f:d", debut: jours(2.5), fin: jours(3) });
    expect(codes({ events: [c, d] })).toEqual([]);
  });

  it("un conflit dans le PASSÉ n'alarme plus", () => {
    const p1 = ev({ key: "f:p1", debut: jours(-5), fin: jours(-4.5) });
    const p2 = ev({ key: "f:p2", debut: jours(-4.8), fin: jours(-4.2) });
    expect(codes({ events: [p1, p2] })).toEqual([]);
  });

  it("une prestation annulée ne conflicte pas", () => {
    expect(codes({ events: [a, { ...b, statut: "annulee" }] })).toEqual([]);
  });
});

describe("formateur non conforme", () => {
  const nonConforme = { trainerId: "t1", nom: "Ana Roux", conforme: false, nbBloquants: 2 };

  it("critique quand il est AFFECTÉ à une prestation à venir", () => {
    const s = hub({ events: [ev()], conformites: [nonConforme] });
    expect(s[0]?.code).toBe("formateur_non_conforme");
    expect(s[0]?.niveau).toBe("critique");
  });

  it("INVARIANT : non conforme mais NON affecté → aucun signal", () => {
    // Un formateur non conforme au repos n'est pas une urgence.
    expect(codes({ events: [], conformites: [nonConforme] })).toEqual([]);
  });

  it("affecté uniquement à une prestation passée → aucun signal", () => {
    expect(
      codes({ events: [ev({ debut: jours(-9), fin: jours(-8.8) })], conformites: [nonConforme] }),
    ).toEqual([]);
  });

  it("affecté à une prestation annulée → aucun signal", () => {
    expect(codes({ events: [ev({ statut: "annulee" })], conformites: [nonConforme] })).toEqual([]);
  });

  it("trie par nombre de bloquants décroissant", () => {
    const s = hub({
      events: [
        ev({ formateurId: "t1" }),
        ev({ key: "f:2", formateurId: "t2", formateurNom: "Bo Li" }),
      ],
      conformites: [
        { trainerId: "t1", nom: "Ana Roux", conforme: false, nbBloquants: 1 },
        { trainerId: "t2", nom: "Bo Li", conforme: false, nbBloquants: 3 },
      ],
    });
    expect(s[0]?.items[0]?.label).toContain("Bo Li");
  });
});

describe("surcharge, relevés, anomalies", () => {
  it("surcharge au-delà de 95 % seulement", () => {
    expect(codes({ charges: [charge({ tauxPct: 95 })] })).toEqual([]);
    expect(codes({ charges: [charge({ tauxPct: 96 })] })).toEqual(["surcharge_formateur"]);
  });

  it("les relevés en attente totalisent leur TTC dans l'explication", () => {
    const s = hub({
      relevesEnAttente: [
        { id: "r1", trainerNom: "Ana", totalTtcCents: 108_000 },
        { id: "r2", trainerNom: "Bo", totalTtcCents: 12_000 },
      ],
    });
    expect(s[0]?.explication).toContain("1200.00 €");
    expect(s[0]?.items[0]?.href).toBe("/fr/adm/qualiopi/remuneration/r1");
  });

  it("les anomalies de rémunération remontent", () => {
    const s = hub({ anomalies: [{ id: "l1", trainerNom: "Ana", motif: "heures_absentes" }] });
    expect(s[0]?.code).toBe("anomalie_remuneration");
    expect(s[0]?.niveau).toBe("attention");
  });
});

describe("ordre des signaux", () => {
  it("les critiques passent avant les attentions", () => {
    const s = hub({
      events: [ev({ formateurId: null, formateurNom: null, debut: jours(1), fin: jours(1.2) })],
      charges: [charge({ tauxPct: 120 })],
      anomalies: [{ id: "l1", trainerNom: "Ana", motif: "bareme_absent" }],
    });
    expect(s[0]?.niveau).toBe("critique");
    expect(s.slice(1).every((x) => x.niveau === "attention")).toBe(true);
    expect(aDesSignauxCritiques(s)).toBe(true);
  });

  it("à niveau égal, le signal le plus fourni passe devant", () => {
    const s = hub({
      charges: [charge({ tauxPct: 120 })],
      anomalies: [
        { id: "1", trainerNom: "A", motif: "x" },
        { id: "2", trainerNom: "B", motif: "y" },
      ],
    });
    expect(s[0]?.code).toBe("anomalie_remuneration");
  });

  it("aDesSignauxCritiques est faux quand tout est en attention", () => {
    const s = hub({ charges: [charge({ tauxPct: 120 })] });
    expect(aDesSignauxCritiques(s)).toBe(false);
  });
});

describe("formateur indisponible", () => {
  // MAINTENANT = 2026-06-10T12:00Z. Une prestation le 20 juin, à venir.
  const prestation = ev({
    debut: new Date("2026-06-20T08:00:00Z"),
    fin: new Date("2026-06-20T17:00:00Z"),
  });

  it("CRITIQUE : une formation vendue sur les congés du formateur", () => {
    const s = hub({ events: [prestation], indispos: indispos("t1", ["2026-06-20"]) });
    expect(s[0]?.code).toBe("formateur_indisponible");
    expect(s[0]?.niveau).toBe("critique");
    expect(s[0]?.items[0]?.label).toContain("1 jour(s)");
  });

  it("aucun chevauchement → aucun signal", () => {
    expect(codes({ events: [prestation], indispos: indispos("t1", ["2026-06-25"]) })).toEqual([]);
  });

  it("les congés d'un AUTRE formateur ne déclenchent rien", () => {
    expect(codes({ events: [prestation], indispos: indispos("t2", ["2026-06-20"]) })).toEqual([]);
  });

  it("une prestation PASSÉE sur un congé n'alarme plus (fait acquis)", () => {
    const passee = ev({
      debut: new Date("2026-06-01T08:00:00Z"),
      fin: new Date("2026-06-01T17:00:00Z"),
    });
    expect(codes({ events: [passee], indispos: indispos("t1", ["2026-06-01"]) })).toEqual([]);
  });

  it("une prestation ANNULÉE sur un congé n'alarme pas", () => {
    expect(
      codes({
        events: [{ ...prestation, statut: "annulee" }],
        indispos: indispos("t1", ["2026-06-20"]),
      }),
    ).toEqual([]);
  });

  it("une prestation non staffée n'est pas testée contre des congés", () => {
    const orpheline = { ...prestation, formateurId: null, formateurNom: null };
    const s = hub({ events: [orpheline], indispos: indispos("t1", ["2026-06-20"]) });
    expect(s.map((x) => x.code)).not.toContain("formateur_indisponible");
  });

  it("une formation multi-jours compte tous ses jours en conflit", () => {
    const multi = ev({
      debut: new Date("2026-06-20T08:00:00Z"),
      fin: new Date("2026-06-22T17:00:00Z"),
    });
    const s = hub({
      events: [multi],
      indispos: indispos("t1", ["2026-06-21", "2026-06-22"]),
    });
    expect(s[0]?.items[0]?.label).toContain("2 jour(s)");
  });
});
