// Challenges d'apporteurs : règles pures, filtre de formules, textes. Données FICTIVES.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  encartVisible,
  empreinteReglement,
  etatDansLaListe,
  eurosVersCentimes,
  jourValide,
  periodeEnLettres,
  periodesSeChevauchent,
  phrasesDeLEncart,
  reglementVisible,
  validerSaisie,
} from "../challenge-regles";
import { formulesInterdites } from "../challenge-textes-interdits";

const REGLEMENT_TYPE = readFileSync(`${__dirname}/challenge-reglement-type.txt`, "utf8");
const BONNE = {
  titre: "Prime exceptionnelle de test",
  debutLe: "2026-12-01",
  finLe: "2026-12-31",
  paiementJusquAu: "",
  produit: "journee-ia",
  critere: "facturees_dans_la_periode",
  seuil: "10",
  primeHt: "2 000",
  reglement: REGLEMENT_TYPE,
};

describe("filtre de formules de pression", () => {
  it("laisse passer un règlement qui dit « aucun objectif », « aucun classement »", () => {
    expect(formulesInterdites(REGLEMENT_TYPE)).toEqual([]);
    expect(formulesInterdites("Aucun objectif, aucun classement, aucun rappel.")).toEqual([]);
    expect(formulesInterdites("Le dernier jour de paiement client est le 31 mars 2027.")).toEqual(
      [],
    );
    expect(formulesInterdites("Une Journée ne compte plus que si elle est payée.")).toEqual([]);
  });
  it.each([
    "Il vous reste 3 jours",
    "plus que quelques jours",
    "Encore 4 Journées à faire",
    "Derniers jours !",
    "Dernière chance",
    "J-3 avant la fin",
    "Ne manquez pas la prime",
    "Dépêchez-vous",
    "Vous êtes à 6 Journées",
    "6 sur 10",
    "Super prime!",
    "Aucun gain garanti",
    "sans discussion",
    "5 fois plus",
  ])("refuse : %s", (t) => {
    expect(formulesInterdites(t).length).toBeGreaterThan(0);
  });
});

describe("validerSaisie", () => {
  it("accepte une saisie complète et convertit la prime en centimes", () => {
    const r = validerSaisie(BONNE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur.primeHtCents).toBe(200_000);
      expect(r.valeur.seuil).toBe(10);
      expect(r.valeur.paiementJusquAu).toBeNull();
    }
  });
  it.each([
    ["titre vide", { titre: " " }],
    ["fin avant début", { finLe: "2026-11-30" }],
    ["date impossible", { debutLe: "2026-02-30" }],
    ["paiement avant la fin", { paiementJusquAu: "2026-12-15" }],
    ["produit hors liste", { produit: "autre" }],
    ["critère hors liste", { critere: "autre" }],
    ["seuil 0", { seuil: "0" }],
    ["seuil 1000", { seuil: "1000" }],
    ["seuil décimal", { seuil: "2.5" }],
    ["prime nulle", { primeHt: "0" }],
    ["prime illisible", { primeHt: "beaucoup" }],
    ["règlement vide", { reglement: "  " }],
    ["pression dans le titre", { titre: "Plus que 3 jours" }],
    ["pression dans le règlement", { reglement: "Dépêchez-vous." }],
  ])("refuse : %s", (_c, patch) => {
    expect(validerSaisie({ ...BONNE, ...patch }).ok).toBe(false);
  });
  it("accepte une date limite de paiement après la fin", () => {
    const r = validerSaisie({ ...BONNE, paiementJusquAu: "2027-03-31" });
    expect(r.ok && r.valeur.paiementJusquAu).toBe("2027-03-31");
  });
  it("aucun champ « apporteurs concernés » ni seuil individuel", () => {
    const r = validerSaisie(BONNE);
    expect(r.ok && Object.keys(r.valeur).sort()).toEqual(
      [
        "critere",
        "debutLe",
        "finLe",
        "paiementJusquAu",
        "primeHtCents",
        "produit",
        "reglement",
        "seuil",
        "titre",
      ].sort(),
    );
  });
});

describe("dates et montants", () => {
  it("jourValide", () => {
    expect(jourValide("2026-12-31")).toBe(true);
    expect(jourValide("2026-13-01")).toBe(false);
    expect(jourValide("31/12/2026")).toBe(false);
  });
  it("eurosVersCentimes", () => {
    expect(eurosVersCentimes("2 000")).toBe(200_000);
    expect(eurosVersCentimes("1490,5")).toBe(149_050);
    expect(eurosVersCentimes("-3")).toBeNull();
  });
  it("chevauchement : bornes incluses", () => {
    const a = { debutLe: "2026-12-01", finLe: "2026-12-31" };
    expect(periodesSeChevauchent(a, { debutLe: "2026-12-31", finLe: "2027-01-10" })).toBe(true);
    expect(periodesSeChevauchent(a, { debutLe: "2027-01-01", finLe: "2027-01-10" })).toBe(false);
  });
  it("l'empreinte du règlement est un SHA-256 stable", () => {
    expect(empreinteReglement("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("visibilité (jours civils de Paris, bornes incluses)", () => {
  const c = { statut: "publie" as const, debutLe: "2026-12-01", finLe: "2026-12-31" };
  it("encart : seulement publié et dans la période", () => {
    expect(encartVisible(c, "2026-11-30")).toBe(false);
    expect(encartVisible(c, "2026-12-01")).toBe(true);
    expect(encartVisible(c, "2026-12-31")).toBe(true);
    expect(encartVisible(c, "2027-01-01")).toBe(false);
    expect(encartVisible({ ...c, statut: "brouillon" }, "2026-12-10")).toBe(false);
    expect(encartVisible({ ...c, statut: "archive" }, "2026-12-10")).toBe(false);
  });
  it("règlement : publié, lisible dès le premier jour et après la fin", () => {
    expect(reglementVisible(c, "2026-11-30")).toBe(false);
    expect(reglementVisible(c, "2027-02-01")).toBe(true);
    expect(reglementVisible({ ...c, statut: "brouillon" }, "2026-12-10")).toBe(false);
  });
  it("classement de la liste", () => {
    expect(etatDansLaListe({ ...c, statut: "brouillon" }, "2026-12-10")).toBe("brouillon");
    expect(etatDansLaListe(c, "2026-11-01")).toBe("a_venir");
    expect(etatDansLaListe(c, "2026-12-10")).toBe("en_cours");
    expect(etatDansLaListe(c, "2027-01-02")).toBe("passe");
    expect(etatDansLaListe({ ...c, statut: "archive" }, "2026-12-10")).toBe("archive");
  });
});

describe("texte de l'encart", () => {
  it("dit la règle et que rien n'est attendu ; passe le filtre ; aucun compteur", () => {
    const p = phrasesDeLEncart({
      produit: "journee-ia",
      seuil: 10,
      primeHtCents: 200_000,
      debutLe: "2026-12-01",
      finLe: "2026-12-31",
    });
    expect(p.principale).toBe(
      "Une prime de 2 000 € HT est versée à tout apporteur pour qui dix Journées IA ont été facturées entre le 1er et le 31 décembre 2026, à des entreprises qui lui sont attribuées selon son contrat.",
    );
    expect(p.rassurance).toContain("Rien n'est attendu de vous");
    expect(formulesInterdites(`${p.principale} ${p.rassurance}`)).toEqual([]);
  });
  it("période à cheval sur deux mois, seuil 1", () => {
    expect(periodeEnLettres("2026-12-15", "2027-01-15")).toBe(
      "entre le 15 décembre 2026 et le 15 janvier 2027",
    );
    expect(
      phrasesDeLEncart({
        produit: "journee-ia",
        seuil: 1,
        primeHtCents: 50_000,
        debutLe: "2026-12-01",
        finLe: "2026-12-31",
      }).principale,
    ).toContain("une Journée IA a été facturée");
  });
});
