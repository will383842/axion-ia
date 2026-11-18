// Audit présentiel PR3 : la vue de l'écran Audit, calculée à partir des événements reçus.
import { describe, expect, it } from "vitest";
import { construireVueAudit, type EvenementLu, type SessionLue } from "../vue";

const T = new Date("2026-11-06T08:30:00Z");
const session = (o: Partial<SessionLue> = {}): SessionLue => ({
  id: "s",
  statut: "ouverte",
  jetonExpireLe: new Date("2026-11-08T00:00:00Z"),
  jetonRevoqueLe: null,
  dernierSeq: 0,
  derniereEtapeIndex: 0,
  dernierEnvoiLe: null,
  creeLe: T,
  ...o,
});
const ev = (
  seq: number,
  type: string,
  etapeIndex: number | null,
  donnees: Record<string, unknown> | null,
  recu = T,
): EvenementLu => ({
  seq,
  type,
  etape: etapeIndex ? `e${etapeIndex}` : null,
  etapeIndex,
  heurePc: T,
  recuLe: recu,
  donnees,
});

const PERSONNES = {
  "personnes.liste": ["p1", "p2"],
  "p.p1.poste": "Comptable",
  "p.p1.statut": "valide",
  "p.p1.taches": ["t1", "t2"],
  "p.p1.prenom": "Zoé-SECRET", // ne doit jamais sortir
  "p.p1.t.t1.nom": "Saisie des factures",
  "p.p1.t.t1.fois": 10,
  "p.p1.t.t1.minutes": 30,
  "p.p1.t.t1.outil": "Excel",
  "p.p1.t.t2.nom": "Relances",
  "p.p1.t.t2.fois": 2,
  "p.p1.t.t2.minutes": 60,
  "p.p2.poste": "Accueil",
  "p.p2.statut": "absent",
  "p.p2.taches": ["t3"],
  "p.p2.t.t3.nom": "Appels",
  "p.p2.t.t3.fois": 5,
  "p.p2.t.t3.minutes": 60,
};

describe("construireVueAudit", () => {
  it("session sans aucun événement : état vide propre", () => {
    const v = construireVueAudit(session(), []);
    expect(v).toMatchObject({
      etape: 0,
      nomEtape: "",
      termine: false,
      derniereReception: null,
      nombreEvenements: 0,
      postes: [],
      priorites: [],
      abonnements: [],
      journal: [],
      trous: [],
    });
  });

  it("étape X sur 7, dernière réception, trous de numérotation", () => {
    const dernier = new Date("2026-11-06T09:00:00Z");
    const v = construireVueAudit(session({ dernierSeq: 4 }), [
      ev(1, "session_ouverte", 0, {}),
      ev(2, "etape_validee", 3, {}),
      ev(4, "etape_validee", 4, {}, dernier),
    ]);
    expect(v.etape).toBe(4);
    expect(v.nomEtape).toBe("Les personnes");
    expect(v.derniereReception).toEqual(dernier);
    expect(v.trous).toEqual([3]);
    expect(v.journal[0]!.seq).toBe(4); // du plus récent au plus ancien
  });

  it("entretiens par poste : heures, poste absent, aucun prénom", () => {
    const v = construireVueAudit(session(), [ev(1, "entretien_valide", 4, PERSONNES)]);
    expect(v.entretiensValides).toBe(1);
    const p1 = v.postes.find((p) => p.pid === "p1")!;
    expect(p1.poste).toBe("Comptable");
    expect(p1.heuresSemaine).toBeCloseTo(5 + 2, 5);
    expect(p1.taches.map((t) => t.nom)).toEqual(["Saisie des factures", "Relances"]);
    const p2 = v.postes.find((p) => p.pid === "p2")!;
    expect(p2.statut).toBe("absent");
    expect(p2.heuresSemaine).toBe(0);
    expect(JSON.stringify(v)).not.toContain("SECRET");
  });

  it("une étape revalidée remplace l'ancienne valeur", () => {
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, PERSONNES),
      ev(2, "etape_validee", 4, { "p.p1.poste": "Responsable administratif" }),
    ]);
    expect(v.postes[0]!.poste).toBe("Responsable administratif");
    expect(v.nombreEvenements).toBe(2);
  });

  it("priorités classées, abonnements sans montant ni utilisateur", () => {
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, PERSONNES),
      ev(2, "etape_validee", 6, {
        "a6.part.t1": 80,
        "a6.piste.t1": "saisie-factures",
        "a6.part.t2": 10,
      }),
      ev(3, "etape_validee", 3, {
        "abos.liste": ["a1"],
        "abo.a1.nom": "Outil X",
        "abo.a1.montant": 99,
        "abo.a1.qui": "Zoé-SECRET",
        "abo.a1.renouv": "2027-01-31",
        "abo.a1.preavis": 30,
        "abo.a1.remplace": "oui",
      }),
    ]);
    expect(v.priorites.map((p) => p.libelle)).toEqual([
      "À étudier : Saisie des factures",
      "À étudier : Relances",
    ]);
    expect(v.priorites[0]!.heuresRecuperables).toBeCloseTo(4, 5);
    expect(v.abonnements[0]).toMatchObject({
      nom: "Outil X",
      limiteResiliation: "2027-01-01",
      remplace: "oui",
    });
    const json = JSON.stringify(v);
    expect(json).not.toContain("99");
    expect(json).not.toContain("SECRET");
  });

  it("contenu illisible : compté, jamais affiché, et l'audit terminé est reconnu", () => {
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 2, null),
      ev(2, "audit_termine", 7, { nbEvenementsJournal: 3 }),
    ]);
    expect(v.illisibles).toBe(1);
    expect(v.termine).toBe(true);
    expect(v.etape).toBe(7);
    expect(v.journal.find((l) => l.seq === 1)!.illisible).toBe(true);
  });

  it("priorités : une tâche « même geste » (meme) n'est pas comptée deux fois", () => {
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, {
        "personnes.liste": ["p1"],
        "p.p1.poste": "Comptable",
        "p.p1.statut": "valide",
        "p.p1.taches": ["t1", "t2"],
        "p.p1.t.t1.nom": "Saisie",
        "p.p1.t.t1.fois": 10,
        "p.p1.t.t1.minutes": 60,
        "p.p1.t.t2.nom": "Ressaisie",
        "p.p1.t.t2.fois": 10,
        "p.p1.t.t2.minutes": 60,
        "p.p1.t.t2.meme": "t1",
      }),
      ev(2, "etape_validee", 6, { "a6.part.t1": 50, "a6.part.t2": 50 }),
    ]);
    expect(v.priorites).toHaveLength(1);
    expect(v.priorites[0]!.heuresRecuperables).toBeCloseTo(5, 5); // 10 h × 50 %, pas 10 h
    expect(v.postes[0]!.heuresSemaine).toBeCloseTo(10, 5);
  });

  it("priorités : facilité, risque et libellé par défaut viennent du catalogue des pistes", () => {
    const base = {
      "personnes.liste": ["p1"],
      "p.p1.poste": "Planning",
      "p.p1.statut": "valide",
      "p.p1.taches": ["t1", "t2"],
      "p.p1.t.t1.nom": "Appeler les clients",
      "p.p1.t.t1.fois": 10,
      "p.p1.t.t1.minutes": 60,
      "p.p1.t.t2.nom": "Saisir les bons",
      "p.p1.t.t2.fois": 10,
      "p.p1.t.t2.minutes": 60,
    };
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, base),
      ev(2, "etape_validee", 6, {
        "a6.part.t1": 50,
        "a6.piste.t1": "sms",
        "a6.part.t2": 50,
        "a6.piste.t2": "bons",
      }),
    ]);
    // sms : facilité 3, risque faible → 5 × 3 × 0,8 × 1 = 12 ; bons : facilité 2, risque moyen → 5 × 2 × 0,8 × 0,8 = 6,4
    expect(v.priorites.map((p) => p.libelle)).toEqual([
      "SMS automatiques aux clients : créneau et heure de passage",
      "Bons d'intervention sur tablette, saisis une seule fois",
    ]);
    expect(v.priorites[0]!.risque).toBe("faible");
    // Une piste inconnue retombe sur « À étudier » (facilité 2, risque moyen), comme l'outil.
    const w = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, base),
      ev(2, "etape_validee", 6, { "a6.part.t1": 50, "a6.piste.t1": "inconnue" }),
    ]);
    expect(w.priorites[0]!.libelle).toBe("À étudier : Appeler les clients");
  });

  it("un contenu reçu ne peut pas polluer les prototypes", () => {
    const donnees = JSON.parse(
      '{"__proto__": {"polluee": "oui"}, "constructor": {"prototype": {"polluee": "oui"}}, "personnes.liste": []}',
    ) as Record<string, unknown>;
    construireVueAudit(session(), [ev(1, "etape_validee", 4, donnees)]);
    expect(({} as Record<string, unknown>)["polluee"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluee")).toBe(false);
  });

  it("valeurs de type inattendu : pas d'exception", () => {
    const v = construireVueAudit(session(), [
      ev(1, "etape_validee", 4, {
        "personnes.liste": "oups",
        "abos.liste": [1, null],
        "p.x.poste": { a: 1 },
      }),
    ]);
    expect(v.postes).toEqual([]);
  });
});
