// Challenges d'apporteurs : règles pures, filtre de formules, textes. Données FICTIVES.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  encartVisible,
  empreinteChallenge,
  etatDansLaListe,
  eurosVersCentimes,
  jourValide,
  periodeEnLettres,
  periodesSeChevauchent,
  phrasesDeLEncart,
  reglementVisible,
  validerSaisie,
  verifierEmpreinteChallenge,
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
    expect(formulesInterdites("Aucun objectif individuel n'est fixé.")).toEqual([]);
    expect(formulesInterdites("Il n'y a aucun classement, ni publié ni affiché.")).toEqual([]);
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
    "Votre objectif : dix Journées.",
    "Vos objectifs sont fixés.",
    "Un objectif de dix Journées",
    "Objectif à atteindre : dix",
    "Vous devez atteindre ce seuil.",
    "Vous êtes tenu de signer.",
    "Participation obligatoire",
    "Classement publié chaque semaine.",
    "Classement hebdomadaire",
    "Classement mensuel",
    "Le premier du classement gagne",
    "Le top du classement",
    "Il ne vous reste que trois jours.",
    "Plus qu’une semaine",
    "Plus qu'un jour",
    "Plus qu'3 jours",
    "Plus qu\u2019une semaine",
    "Plus qu'\u00a0une semaine",
    "Super prime ！",
    "Super prime\u202f!",
    "Il\u00a0vous\u00a0reste 3 jours",
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
  const REGLE = {
    titre: "T",
    debutLe: "2026-12-01",
    finLe: "2026-12-31",
    paiementJusquAu: null,
    produit: "journee-ia" as const,
    critere: "facturees_dans_la_periode" as const,
    seuil: 10,
    primeHtCents: 200_000,
    reglement: "R",
  };
  it("l'empreinte couvre la règle complète, en forme canonique", () => {
    const canonique =
      '{"titre":"T","debutLe":"2026-12-01","finLe":"2026-12-31","paiementJusquAu":null,"produit":"journee-ia","critere":"facturees_dans_la_periode","seuil":10,"primeHtCents":200000,"reglement":"R"}';
    expect(empreinteChallenge(REGLE)).toBe(createHash("sha256").update(canonique).digest("hex"));
  });
  it.each([
    ["titre", { titre: "U" }],
    ["debutLe", { debutLe: "2026-12-02" }],
    ["finLe", { finLe: "2026-12-30" }],
    ["paiementJusquAu", { paiementJusquAu: "2027-01-31" }],
    ["seuil", { seuil: 11 }],
    ["primeHtCents", { primeHtCents: 200_001 }],
    ["reglement", { reglement: "S" }],
  ])("l'empreinte change quand %s change", (_n, modif) => {
    expect(empreinteChallenge({ ...REGLE, ...modif })).not.toBe(empreinteChallenge(REGLE));
  });
  it("verifierEmpreinteChallenge : vrai si intacte, faux si altérée ou absente", () => {
    const sha = empreinteChallenge(REGLE);
    expect(verifierEmpreinteChallenge({ ...REGLE, reglementSha256: sha })).toBe(true);
    expect(verifierEmpreinteChallenge({ ...REGLE, seuil: 1, reglementSha256: sha })).toBe(false);
    expect(verifierEmpreinteChallenge({ ...REGLE, reglementSha256: null })).toBe(false);
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
    expect(reglementVisible({ ...c, statut: "archive" }, "2027-02-01")).toBe(true);
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
      "Une prime de 2 000 € HT est versée à tout apporteur pour qui au moins dix Journées IA ont été facturées entre le 1er et le 31 décembre 2026 et payées en entier, à des entreprises qui lui sont attribuées selon son contrat. Cette prime ne se cumule pas avec une autre prime de challenge sur la même période.",
    );
    expect(p.rassurance).toContain("Rien n'est attendu de vous");
    expect(formulesInterdites(`${p.principale} ${p.rassurance}`)).toEqual([]);
  });
  it("date limite de paiement renseignée", () => {
    expect(
      phrasesDeLEncart({
        produit: "journee-ia",
        seuil: 10,
        primeHtCents: 200_000,
        debutLe: "2026-12-01",
        finLe: "2026-12-31",
        paiementJusquAu: "2027-01-15",
      }).principale,
    ).toContain("payées en entier, paiement reçu au plus tard le 15 janvier 2027,");
  });
  it("période à cheval sur deux mois, seuil 1", () => {
    expect(periodeEnLettres("2026-12-15", "2027-01-15")).toBe(
      "entre le 15 décembre 2026 et le 15 janvier 2027",
    );
    const seuilUn = phrasesDeLEncart({
      produit: "journee-ia",
      seuil: 1,
      primeHtCents: 50_000,
      debutLe: "2026-12-01",
      finLe: "2026-12-31",
    }).principale;
    expect(seuilUn).toContain("au moins une Journée IA a été facturée");
    expect(seuilUn).toContain("et payée en entier");
    expect(seuilUn).not.toContain("payées");
  });
});
