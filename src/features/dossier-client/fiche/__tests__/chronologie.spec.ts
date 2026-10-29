import { describe, expect, it } from "vitest";
import {
  assemblerChronologie,
  compterParFiltre,
  etatTache,
  filtrer,
  grouperParJour,
  lireFiltre,
  separerEpinglees,
  type EvenementActivite,
} from "../chronologie";

const ev = (
  cle: string,
  iso: string,
  type: EvenementActivite["type"] = "email",
  plus: Partial<EvenementActivite> = {},
): EvenementActivite => ({
  cle,
  type,
  date: new Date(iso),
  titre: cle,
  etat: "x",
  nuance: "neutre",
  lien: null,
  ...plus,
});

describe("assemblerChronologie", () => {
  it("trie du plus récent au plus ancien, stable à date égale", () => {
    const r = assemblerChronologie([
      [ev("b", "2026-10-01T10:00:00Z"), ev("a", "2026-10-01T10:00:00Z")],
      [ev("c", "2026-10-02T10:00:00Z"), ev("d", "2026-09-01T10:00:00Z")],
    ]);
    expect(r.map((e) => e.cle)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("grouperParJour", () => {
  const ref = new Date("2026-10-29T12:00:00Z");
  it("coupe à minuit de Paris, pas à minuit UTC", () => {
    // 23:30 UTC le 28 = 00:30 Paris le 29 (heure d’hiver). 22:30 UTC = 23:30 Paris le 28.
    const r = grouperParJour(
      [ev("a", "2026-10-28T23:30:00Z"), ev("b", "2026-10-28T22:30:00Z")],
      ref,
    );
    expect(r).toHaveLength(2);
    expect(r[0]?.libelle).toBe("29 oct.");
    expect(r[1]?.libelle).toBe("28 oct.");
  });
  it("regroupe les événements d'un même jour dans l'ordre reçu", () => {
    const r = grouperParJour(
      [
        ev("a", "2026-10-29T15:00:00Z"),
        ev("b", "2026-10-29T08:00:00Z"),
        ev("c", "2026-10-27T08:00:00Z"),
      ],
      ref,
    );
    expect(r.map((j) => j.evenements.map((e) => e.cle))).toEqual([["a", "b"], ["c"]]);
  });
  it("ajoute l'année quand elle diffère", () => {
    const r = grouperParJour([ev("a", "2025-12-31T12:00:00Z")], ref);
    expect(r[0]?.libelle).toContain("2025");
  });
});

describe("filtrer", () => {
  const tous = [
    ev("r", "2026-10-05T10:00:00Z", "rendez_vous"),
    ev("m", "2026-10-04T10:00:00Z", "email"),
    ev("n1", "2026-10-03T10:00:00Z", "note"),
    ev("n2", "2026-10-02T10:00:00Z", "note", { epinglee: true }),
    ev("t", "2026-10-01T10:00:00Z", "tache"),
    ev("a", "2026-09-30T10:00:00Z", "argent"),
  ];
  it("« Tout » garde tout", () => {
    expect(filtrer(tous, "tout")).toHaveLength(6);
  });
  it.each([
    ["rendez-vous", ["r"]],
    ["emails", ["m"]],
    ["taches", ["t"]],
    ["argent", ["a"]],
  ] as const)("filtre %s", (f, attendu) => {
    expect(filtrer(tous, f).map((e) => e.cle)).toEqual(attendu);
  });
  it("garde l'ordre chronologique dans le filtre Notes (les épinglées ne sont pas déplacées)", () => {
    expect(filtrer(tous, "notes").map((e) => e.cle)).toEqual(["n1", "n2"]);
  });
  it("compte par filtre", () => {
    expect(compterParFiltre(tous)).toMatchObject({ tout: 6, notes: 2, argent: 1 });
  });
});

describe("lireFiltre", () => {
  it("retombe sur « tout » pour une valeur inconnue", () => {
    expect(lireFiltre("n'importe quoi")).toBe("tout");
    expect(lireFiltre(undefined)).toBe("tout");
    expect(lireFiltre("notes")).toBe("notes");
  });
});

describe("etatTache", () => {
  const maintenant = new Date("2026-10-29T10:00:00Z");
  it("faite : vert", () => {
    expect(
      etatTache(
        { echeanceLe: new Date("2026-10-01"), faiteLe: new Date("2026-10-02") },
        maintenant,
      ),
    ).toEqual({ etat: "Faite", nuance: "fait" });
  });
  it("ouverte : « À faire · avant le … »", () => {
    const r = etatTache({ echeanceLe: new Date("2026-11-03"), faiteLe: null }, maintenant);
    expect(r.nuance).toBe("a_faire");
    expect(r.etat).toMatch(/^À faire · avant le 3 nov/);
  });
  it("échéance dépassée : « En retard »", () => {
    const r = etatTache({ echeanceLe: new Date("2026-10-20"), faiteLe: null }, maintenant);
    expect(r.nuance).toBe("en_retard");
    expect(r.etat).toMatch(/^En retard/);
  });
  it("échéance aujourd'hui : pas encore en retard", () => {
    expect(
      etatTache({ echeanceLe: new Date("2026-10-29"), faiteLe: null }, maintenant).nuance,
    ).toBe("a_faire");
  });
});

describe("notes épinglées : bloc à part, jours non répétés", () => {
  const ref = new Date("2026-10-29T12:00:00Z");
  const notes = [
    ev("recente", "2026-10-05T10:00:00Z", "note"),
    ev("epinglee", "2026-10-03T14:00:00Z", "note", { epinglee: true }),
    ev("ancienne", "2026-10-03T09:00:00Z", "note"),
  ];
  it("sépare les épinglées, puis groupe les autres : un jour = un groupe, du plus récent au plus ancien", () => {
    const { epinglees, autres } = separerEpinglees(filtrer(notes, "notes"));
    expect(epinglees.map((e) => e.cle)).toEqual(["epinglee"]);
    const jours = grouperParJour(autres, ref);
    expect(jours.map((j) => j.jour)).toEqual(["2026-10-05", "2026-10-03"]);
    expect(new Set(jours.map((j) => j.jour)).size).toBe(jours.length);
    expect(jours[1]?.evenements.map((e) => e.cle)).toEqual(["ancienne"]);
  });
});
