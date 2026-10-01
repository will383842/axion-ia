/**
 * LA VUE « QUESTIONNAIRE » CALCULE `remplacable` ET « QUI RÉPOND » DEPUIS LA
 * BASE (questionnaire en ligne ; vérificateur rouge sur la PR 1258, point 6).
 *
 * `lireQuestionnaireDuProjet` dit à la console si « Écrire mes questions »
 * REMPLACERA la version courante (même règle que le geste,
 * `versionRemplacable`) — et donc s'il faut pré-remplir le champ. Forcer
 * `remplacable` à `true` laissait 371 tests verts : ce fichier le lit pour de
 * vrai, sur des lignes telles que Prisma les rend.
 *
 * Il vérifie aussi que la ligne d'ordre 0 (« Qui répond ? ») sort des
 * questions et devient `repondant`.
 *
 * Mutation qui rougit : `remplacable: true` en dur ; ne plus passer les faits
 * ou les réponses à la règle ; laisser la ligne 0 parmi les questions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const lignes: { courante: Record<string, unknown> | null } = { courante: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireCadrage: { findFirst: vi.fn(async () => lignes.courante) },
    traitementVisio: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/chiffrer-parole", () => ({ dechiffrerParole: (v: string) => v }));

import { lireQuestionnaireDuProjet } from "../queries";

function question(ordre: number, p: Record<string, unknown> = {}) {
  return {
    id: `q${ordre}`,
    ordre,
    texte: `Question ${ordre} ?`,
    poseeDeViveVoix: false,
    reponse: null,
    reponseRecueLe: null,
    _count: { faitsProduits: 0 },
    faitsProduits: [],
    ...p,
  };
}

function questionnaire(p: Record<string, unknown> = {}) {
  return {
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    version: 1,
    statut: "brouillon",
    modele: "questions_ecrites_par_williams",
    genereLe: new Date("2026-10-01T08:00:00Z"),
    mode: "a_copier",
    reponseRecueLe: null,
    questions: [question(1), question(2)],
    ...p,
  };
}

beforeEach(() => {
  lignes.courante = null;
});

describe("la vue « Questionnaire » calcule `remplacable` et « qui répond »", () => {
  it("contre-témoin : un brouillon de Will, sans réponse ni fait, est remplaçable", async () => {
    lignes.courante = questionnaire();
    expect((await lireQuestionnaireDuProjet("p"))?.remplacable).toBe(true);
  });

  it("un brouillon dont une question a produit un FAIT n'est pas remplaçable", async () => {
    lignes.courante = questionnaire({
      questions: [question(1), question(2, { _count: { faitsProduits: 1 } })],
    });
    expect((await lireQuestionnaireDuProjet("p"))?.remplacable).toBe(false);
  });

  it("un brouillon avec une RÉPONSE reçue n'est pas remplaçable", async () => {
    lignes.courante = questionnaire({
      questions: [question(1, { reponseRecueLe: new Date() })],
    });
    expect((await lireQuestionnaireDuProjet("p"))?.remplacable).toBe(false);
  });

  it("une version partie chez le client (copie) n'est pas remplaçable", async () => {
    lignes.courante = questionnaire({ statut: "copie", mode: "en_ligne" });
    expect((await lireQuestionnaireDuProjet("p"))?.remplacable).toBe(false);
  });

  it("la ligne d'ordre 0 sort des questions et devient « qui répond »", async () => {
    lignes.courante = questionnaire({
      statut: "reponse_recue",
      mode: "en_ligne",
      reponseRecueLe: new Date(),
      questions: [
        question(0, {
          texte: "Qui répond ? (nom et fonction)",
          poseeDeViveVoix: true,
          reponse: "Camille Exemple, DAF",
        }),
        question(1, { reponse: "Douze." }),
      ],
    });
    const q = await lireQuestionnaireDuProjet("p");
    expect(q?.repondant).toBe("Camille Exemple, DAF");
    expect(q?.questions.map((x) => x.ordre)).toEqual([1]);
  });
});
