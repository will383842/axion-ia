/** Chantier QNC, L03 — ce que l'écran montre : la dérogation EN ROUGE, jamais autrement. */
import { describe, expect, it } from "vitest";

import { resumer, type VueRecueil } from "../vue";

const base: VueRecueil = {
  sessionId: "s",
  projet: { id: "p", titre: "Formation RH" },
  projetsCandidats: [],
  questionnaire: null,
  decision: { autorise: true, voie: "conforme" },
};

describe("resumer", () => {
  it("pas de dérogation en rouge quand tout est en règle", () => {
    expect(resumer(base).derogationRouge).toBeNull();
  });

  it("la dérogation est en rouge dès qu'elle est ce qui ouvre la convention", () => {
    const accordeeLe = new Date("2026-10-12T08:00:00Z");
    const r = resumer({
      ...base,
      decision: { autorise: true, voie: "derogation", motif: "Urgence de rentrée", accordeeLe },
    });
    expect(r.derogationRouge).toEqual({ motif: "Urgence de rentrée", accordeeLe });
  });

  it("bloqué : propose la dérogation, pas de bannière rouge", () => {
    const r = resumer({
      ...base,
      decision: { autorise: false, manques: ["cadrage_non_valide"], message: "x" },
    });
    expect(r).toMatchObject({ bloque: true, peutDeroger: true, derogationRouge: null });
  });

  it("propose d'envoyer le recueil seulement s'il n'existe pas et qu'un projet est rattaché", () => {
    expect(resumer(base).peutEnvoyer).toBe(true);
    expect(resumer({ ...base, projet: null }).peutEnvoyer).toBe(false);
    expect(
      resumer({
        ...base,
        questionnaire: {
          id: "q",
          version: 1,
          statut: "copie",
          reponseRecueLe: null,
          valideLe: null,
        },
      }).peutEnvoyer,
    ).toBe(false);
  });

  it("propose de valider seulement une analyse répondue et non encore validée", () => {
    const rep = {
      id: "q",
      version: 1,
      statut: "reponse_recue",
      reponseRecueLe: new Date(),
      valideLe: null,
    };
    expect(resumer({ ...base, questionnaire: rep }).peutValider).toBe(true);
    expect(resumer({ ...base, questionnaire: { ...rep, valideLe: new Date() } }).peutValider).toBe(
      false,
    );
    expect(resumer({ ...base, questionnaire: { ...rep, statut: "copie" } }).peutValider).toBe(
      false,
    );
  });

  it("propose le rattachement seulement sans projet et avec des candidats", () => {
    expect(
      resumer({ ...base, projet: null, projetsCandidats: [{ id: "a", titre: "A" }] }).peutRattacher,
    ).toBe(true);
    expect(resumer({ ...base, projet: null }).peutRattacher).toBe(false);
    expect(resumer({ ...base, projetsCandidats: [{ id: "a", titre: "A" }] }).peutRattacher).toBe(
      false,
    );
  });
});
