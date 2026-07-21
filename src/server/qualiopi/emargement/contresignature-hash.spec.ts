/**
 * Tests — contresignature-hash.ts
 *
 * Même exigence que pour la chaîne des stagiaires, et pour la même raison : sans
 * vecteur d'or ni matrice de falsification, quatre mutations changeant la forme
 * canonique passaient 88 tests côté signature. Il n'y a aucune raison que ce
 * miroir soit mieux loti par accident.
 */

import { describe, it, expect } from "vitest";
import { verifierChaine } from "./hash";
import {
  tupleContresignatureCanonique,
  calculerSelfHashContresignature,
  tupleContresignatureDepuisLigne,
  maillonContresignatureDepuisLigne,
  HASH_VERSION_CONTRESIGNATURE,
  type TupleContresignatureV1,
  type LigneContresignature,
} from "./contresignature-hash";

function tuple(over: Partial<TupleContresignatureV1> = {}): TupleContresignatureV1 {
  return {
    contexteType: "collectif",
    sessionId: "33333333-3333-4333-8333-333333333333",
    coachingId: null,
    trainerId: "44444444-4444-4444-8444-444444444444",
    formateurNom: "Williams Jullin",
    date: "2026-06-10",
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formationIntitule: "Bien démarrer avec l'IA",
    modules: ["Module 1 — Fondamentaux"],
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAtIso: "2026-06-10T12:35:00.000Z",
    ipHash: "0123456789abcdef",
    userAgentSha256: "b".repeat(64),
    mentionVersion: "v1",
    prevHash: null,
    ...over,
  };
}

function ligne(over: Partial<LigneContresignature> = {}): LigneContresignature {
  const base: LigneContresignature = {
    id: "cs-1",
    contexteType: "collectif",
    sessionId: "33333333-3333-4333-8333-333333333333",
    coachingId: null,
    trainerId: "44444444-4444-4444-8444-444444444444",
    formateurNom: "Williams Jullin",
    date: new Date("2026-06-10T00:00:00.000Z"),
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formationIntitule: "Bien démarrer avec l'IA",
    modulesSnapshot: ["Module 1 — Fondamentaux"],
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAt: new Date("2026-06-10T12:35:00.000Z"),
    ipHash: "0123456789abcdef",
    userAgentSha256: "b".repeat(64),
    mentionVersion: "v1",
    prevHash: null,
    selfHash: "",
    hashVersion: HASH_VERSION_CONTRESIGNATURE,
    ...over,
  };
  const t = tupleContresignatureDepuisLigne(base);
  return { ...base, selfHash: t === null ? "" : calculerSelfHashContresignature(t) };
}

describe("VECTEUR D'OR — la forme canonique est figée", () => {
  // Ces deux littéraux sont un contrat. S'ils changent, ce n'est jamais un test
  // à mettre à jour : c'est `HASH_VERSION_CONTRESIGNATURE` à incrémenter, avec
  // un chemin de recalcul pour l'historique.
  const CANONIQUE_ATTENDUE = `{"coachingId":null,"contexteType":"collectif","date":"2026-06-10","demiJournee":"matin","formateurNom":"Williams Jullin","formationIntitule":"Bien démarrer avec l'IA","heureDebut":"09:00","heureFin":"12:30","ipHash":"0123456789abcdef","mentionVersion":"v1","methode":"canvas","modules":["Module 1 — Fondamentaux"],"prevHash":null,"sessionId":"33333333-3333-4333-8333-333333333333","signatureSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","signeAt":"2026-06-10T12:35:00.000Z","trainerId":"44444444-4444-4444-8444-444444444444","userAgentSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","v":1}`;
  const HASH_ATTENDU = "c50cb07242a192f33382c246877d4e2c4db712fd55fb2f4dc3fd97451ab7497f";

  it("produit EXACTEMENT cette chaîne canonique", () => {
    expect(tupleContresignatureCanonique(tuple())).toBe(CANONIQUE_ATTENDUE);
  });

  it("produit EXACTEMENT cette empreinte", () => {
    expect(calculerSelfHashContresignature(tuple())).toBe(HASH_ATTENDU);
  });

  it("les clés sont triées par point de code, pas par locale", () => {
    const clefs = [...tupleContresignatureCanonique(tuple()).matchAll(/"([a-zA-Z]+)":/g)].map(
      (m) => m[1],
    );
    expect(clefs).toEqual([...clefs].sort());
  });

  it("l'empreinte diffère de celle d'une signature stagiaire", () => {
    // Les deux tuples ne partagent ni la forme ni les clés : une collision
    // entre les deux registres serait un défaut de conception.
    expect(HASH_ATTENDU).not.toBe(
      "1a0ff9e7d1293de4c563d9218f2e884aa9e37c515081866d75a241eb207dcaf5",
    );
  });
});

describe("chaque champ entre RÉELLEMENT dans l'empreinte", () => {
  const variations: Array<[string, Partial<TupleContresignatureV1>]> = [
    ["prevHash", { prevHash: "9".repeat(64) }],
    ["sessionId", { sessionId: "99999999-9999-4999-8999-999999999999" }],
    ["trainerId", { trainerId: "88888888-8888-4888-8888-888888888888" }],
    ["formateurNom", { formateurNom: "Quelqu'un d'autre" }],
    ["date", { date: "2026-06-11" }],
    ["demiJournee", { demiJournee: "apres_midi" }],
    ["heureDebut", { heureDebut: "08:00" }],
    ["heureFin", { heureFin: "17:00" }],
    ["formationIntitule", { formationIntitule: "Autre intitulé" }],
    ["modules", { modules: ["Module 2"] }],
    ["methode", { methode: "confirmation_accessible" }],
    ["signatureSha256", { signatureSha256: "f".repeat(64) }],
    ["signeAtIso", { signeAtIso: "2026-06-10T12:35:00.001Z" }],
    ["ipHash", { ipHash: "fedcba9876543210" }],
    ["userAgentSha256", { userAgentSha256: "c".repeat(64) }],
    ["mentionVersion", { mentionVersion: "v2" }],
    ["contexteType", { contexteType: "afest_1to1", sessionId: null, coachingId: "coa-1" }],
  ];

  it.each(variations)("modifier %s change l'empreinte", (_, patch) => {
    expect(calculerSelfHashContresignature({ ...tuple(), ...patch })).not.toBe(
      calculerSelfHashContresignature(tuple()),
    );
  });

  it("couvre tous les champs du tuple", () => {
    const champs = Object.keys(tuple());
    const couverts = new Set(variations.map(([n]) => n));
    couverts.add("coachingId"); // couvert par la variation `contexteType`
    expect(champs.filter((c) => !couverts.has(c))).toEqual([]);
  });
});

describe("tupleContresignatureDepuisLigne", () => {
  it("reconstruit tous les champs", () => {
    const t = tupleContresignatureDepuisLigne(ligne());
    expect(t).not.toBeNull();
    expect(t?.date).toBe("2026-06-10");
    expect(t?.heureDebut).toBe("09:00");
    expect(t?.formateurNom).toBe("Williams Jullin");
    expect(t?.modules).toEqual(["Module 1 — Fondamentaux"]);
  });

  it("refuse une date qui n'est pas à minuit UTC", () => {
    expect(
      tupleContresignatureDepuisLigne(ligne({ date: new Date("2026-06-10T01:00:00Z") })),
    ).toBeNull();
  });

  it("refuse une version inconnue", () => {
    expect(tupleContresignatureDepuisLigne(ligne({ hashVersion: 99 }))).toBeNull();
  });

  it("refuse un `modulesSnapshot` mal formé", () => {
    expect(tupleContresignatureDepuisLigne(ligne({ modulesSnapshot: { a: 1 } }))).toBeNull();
  });
});

describe("verifierChaine — réutilisée telle quelle pour les contresignatures", () => {
  /** Chaîne de N contresignatures d'un même formateur sur une session. */
  function chaine(n: number): LigneContresignature[] {
    const lignes: LigneContresignature[] = [];
    let prevHash: string | null = null;
    for (let i = 0; i < n; i++) {
      const l = ligne({
        id: `cs-${i + 1}`,
        demiJournee: i % 2 === 0 ? "matin" : "apres_midi",
        signeAt: new Date(Date.UTC(2026, 5, 10, 12, i, 0, 0)),
        prevHash,
      });
      lignes.push(l);
      prevHash = l.selfHash;
    }
    return lignes;
  }

  it("valide une chaîne intacte", () => {
    const res = verifierChaine(chaine(4).map(maillonContresignatureDepuisLigne));
    expect(res.anomalies).toEqual([]);
    expect(res.valide).toBe(true);
  });

  it("détecte une modification après contresignature", () => {
    const lignes = chaine(3);
    lignes[1] = { ...(lignes[1] as LigneContresignature), heureFin: "17:00" };
    const res = verifierChaine(lignes.map(maillonContresignatureDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte une suppression au milieu", () => {
    const l = chaine(4);
    const res = verifierChaine(
      [l[0], l[2], l[3]].map((x) => maillonContresignatureDepuisLigne(x as LigneContresignature)),
    );
    expect(res.anomalies.map((a) => a.type)).toContain("rupture_chainage");
  });

  it("ne confond pas une version de contresignature avec celle des signatures", () => {
    // `versionAttendue` est propre à chaque chaîne : sans lui, la version 1 des
    // contresignatures serait comparée à celle des signatures stagiaires.
    const res = verifierChaine([maillonContresignatureDepuisLigne(ligne({ hashVersion: 99 }))]);
    expect(res.anomalies.map((a) => a.type)).toContain("version_inconnue");
  });
});
