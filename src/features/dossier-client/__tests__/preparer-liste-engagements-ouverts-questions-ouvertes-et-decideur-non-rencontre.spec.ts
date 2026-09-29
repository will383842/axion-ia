/**
 * ⛔ « Préparer » (plan §3.13, MQ-M5) — scénario 1 enchaîné sur un 2ᵉ
 * rendez-vous, avec un 2ᵉ projet du MÊME client qui porte ses propres
 * engagements.
 *
 * `preparer()` doit rendre EXACTEMENT, pour le projet visé :
 *   · les engagements de Williams et du client, les questions et les objections
 *     dont le suivi est OUVERT (ni les tenus, ni les répondus) ;
 *   · le décideur cité jamais rencontré ;
 *   · les valeurs à trancher ;
 *   · les douze blocs, dans l'ordre ;
 * et AUCUN fait de l'autre projet (seulement son titre et son statut).
 *
 * Mutation qui fait rougir : dans `preparer.ts`, lire toutes les portées
 * projet (`Object.values(conso.projets)`) au lieu de la seule portée visée —
 * les engagements du projet B apparaissent.
 * Contre-témoin : sans projet choisi, seule la portée entreprise est lue.
 * Angle mort : les questions de questionnaire viennent de `queries.ts` ; si la
 * lecture renvoyait celles d'un autre projet, seul le filtre `projetId` de
 * `preparer()` les écarte (testé ici).
 */

import { describe, expect, it } from "vitest";
import { preparer, type EntreePreparer } from "../preparer";
import { MAINTENANT, fait, faitProjet, ilYA } from "./_faits";

const A = "p-formation-rh";
const B = "p-audit";

const DECIDEUR = "c-dirigeante";

function entree(projetId: string | null): EntreePreparer {
  return {
    client: { id: "cl-1", numero: "AXI-CLI-900", raisonSociale: "Atelier Fictif SARL" },
    projetId,
    projets: [
      {
        id: A,
        numero: "AXI-PRJ-2026-001",
        titre: "Formation RH",
        statut: "ouvert",
        derniereReouvertureLe: null,
      },
      {
        id: B,
        numero: "AXI-PRJ-2026-002",
        titre: "Audit",
        statut: "ouvert",
        derniereReouvertureLe: null,
      },
    ],
    faits: [
      // Projet A — premier rendez-vous
      faitProjet(A, {
        type: "engagement_axion",
        cle: "programme",
        enonce: "Envoyer le programme",
        suivi: "ouvert",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "engagement_axion",
        cle: "devis",
        enonce: "Envoyer le devis",
        suivi: "tenu",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "engagement_client",
        cle: "liste",
        enonce: "Envoyer la liste des participants",
        suivi: "ouvert",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "question_ouverte",
        cle: "sites",
        enonce: "Combien de sites ?",
        suivi: "ouvert",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "question_ouverte",
        cle: "opco",
        enonce: "Quel OPCO ?",
        suivi: "repondu",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "objection",
        cle: "prix",
        enonce: "C'est cher",
        suivi: "ouvert",
        constateLe: ilYA(20),
      }),
      faitProjet(A, {
        type: "decideur",
        texteCourt: "La dirigeante",
        contactSujetId: DECIDEUR,
        constateLe: ilYA(20),
      }),
      faitProjet(A, { type: "budget", montantMaxCents: 500_000, constateLe: ilYA(20) }),
      faitProjet(A, { type: "budget", montantMaxCents: 700_000, constateLe: ilYA(5) }),
      // Projet B — ses propres engagements : ne doivent JAMAIS apparaître pour A
      faitProjet(B, {
        type: "engagement_axion",
        cle: "audit",
        enonce: "Planifier l'audit",
        suivi: "ouvert",
      }),
      faitProjet(B, {
        type: "question_ouverte",
        cle: "perimetre",
        enonce: "Quel périmètre ?",
        suivi: "ouvert",
      }),
      faitProjet(B, { type: "objection", cle: "temps", enonce: "Pas le temps", suivi: "ouvert" }),
      // Entreprise
      fait({ type: "mise_en_relation", texteCourt: "un ancien client" }),
    ],
    dernierSuivi: { suite: "relance", suiteLe: ilYA(2), rencontreTitre: "Premier échange" },
    questionsSansReponse: [
      { id: "q-a", texte: "Dates possibles ?", projetId: A },
      { id: "q-b", texte: "Accès aux locaux ?", projetId: B },
    ],
    personnes: [
      { id: DECIDEUR, nom: "Dirigeante fictive", fonction: "Gérante", rencontree: false },
      { id: "c-daf", nom: "DAF fictif", fonction: "DAF", rencontree: true },
    ],
    comptesRendusNonValides: [],
    enregistrementsRefusesLe: [],
    maintenant: MAINTENANT,
  };
}

const enonces = (faits: ReadonlyArray<{ enonce: string }>) => faits.map((f) => f.enonce).sort();

describe("⛔ préparer liste les engagements ouverts, les questions ouvertes et le décideur non rencontré", () => {
  const p = preparer(entree(A));

  it("engagements ouverts du projet visé, et d'eux seuls", () => {
    expect(enonces(p.engagementsAxion)).toEqual(["Envoyer le programme"]);
    expect(enonces(p.engagementsClient)).toEqual(["Envoyer la liste des participants"]);
  });

  it("questions ouvertes (hors répondues) et questionnaire du projet visé seulement", () => {
    expect(enonces(p.questionsOuvertes.faits)).toEqual(["Combien de sites ?"]);
    expect(p.questionsOuvertes.questionnaire.map((q) => q.id)).toEqual(["q-a"]);
  });

  it("objections non levées du projet visé", () => {
    expect(enonces(p.objections)).toEqual(["C'est cher"]);
  });

  it("le décideur cité jamais rencontré", () => {
    expect(p.decideursJamaisRencontres.map((d) => d.id)).toEqual([DECIDEUR]);
  });

  it("le budget contradictoire est à trancher", () => {
    expect(p.aTrancherOuReconfirmer.map((v) => [v.type, v.etat])).toContainEqual([
      "budget",
      "a_trancher",
    ]);
  });

  it("rien du projet B : ni engagement, ni question, ni objection — seulement son titre", () => {
    const tout = JSON.stringify(p);
    for (const texte of [
      "Planifier l'audit",
      "Quel périmètre ?",
      "Pas le temps",
      "Accès aux locaux ?",
    ]) {
      expect(tout, `« ${texte} » vient du projet B`).not.toContain(texte);
    }
    expect(p.entete.autresProjets).toEqual([
      { id: B, numero: "AXI-PRJ-2026-002", titre: "Audit", statut: "ouvert" },
    ]);
  });

  it("la suite convenue dépassée est signalée", () => {
    expect(p.entete.suiteDepassee).toBe(true);
  });

  it("la mise en relation de l'entreprise est rappelée", () => {
    expect(p.misesEnRelation.map((f) => f.texteCourt)).toEqual(["un ancien client"]);
  });

  it("les douze blocs existent, dans l'ordre", () => {
    expect(Object.keys(p)).toEqual([
      "entete",
      "engagementsAxion",
      "engagementsClient",
      "questionsOuvertes",
      "objections",
      "aTrancherOuReconfirmer",
      "decideursJamaisRencontres",
      "rubriquesJamaisAbordees",
      "echeanceProcheAvecOpco",
      "comptesRendusNonValides",
      "enregistrementsRefusesLe",
      "misesEnRelation",
    ]);
  });

  it("contre-témoin : sans projet choisi, aucun fait de projet n'est lu", () => {
    const sans = preparer(entree(null));
    expect(sans.entete.projet).toBeNull();
    expect(sans.engagementsAxion).toEqual([]);
    expect(sans.questionsOuvertes.questionnaire).toEqual([]);
    expect(sans.misesEnRelation.length).toBe(1);
  });
});
