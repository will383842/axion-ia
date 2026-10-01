/**
 * LA LECTURE IA NE VOIT NI « QUI RÉPOND » NI « JE NE SAIS PAS »
 * (questionnaire en ligne, 2026-10-01 ; avis de l'architecte C3 et conseil).
 *
 * `lire_reponses` envoie les réponses à OpenAI pour les ranger en faits :
 *   · la ligne d'ordre 0 (« Qui répond ? », un nom et une fonction) n'y part
 *     jamais — le filtre `QUESTIONS_REELLES` est dans la requête elle-même ;
 *   · « Je ne sais pas. » vaut absence de réponse : aucun fait à écarter.
 *
 * Mutation qui rougit : retirer `where: QUESTIONS_REELLES` de `pourLecture` ;
 * retirer `sansJeNeSaisPas`. Contre-témoin : une vraie réponse passe intacte.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";
import { depotDemandesPrisma, sansJeNeSaisPas } from "../../passes/etapes-a-la-demande";
import { ORDRE_QUI_REPOND, REPONSE_JE_NE_SAIS_PAS } from "../constantes";

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("la lecture IA ne voit ni « qui répond » ni « je ne sais pas »", () => {
  it("la requête de `pourLecture` écarte la ligne d'ordre 0, et « Je ne sais pas » devient null", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "q",
      clientId: "cl",
      projetId: "p",
      reponseRecueLe: new Date("2026-10-01T10:00:00Z"),
      questions: [
        {
          id: "a",
          ordre: 1,
          texte: chiffrerParole("Combien de personnes ?"),
          reponse: chiffrerParole("Douze."),
          typeVise: "autre",
          cleVisee: null,
          faitsProduits: [],
        },
        {
          id: "b",
          ordre: 2,
          texte: chiffrerParole("Quel calendrier ?"),
          reponse: chiffrerParole(REPONSE_JE_NE_SAIS_PAS),
          typeVise: "autre",
          cleVisee: null,
          faitsProduits: [],
        },
      ],
    });
    const db = {
      rencontre: { findUnique: vi.fn().mockResolvedValue({ clientId: "cl", projetId: "p" }) },
      questionnaireCadrage: { findFirst },
    };
    const lu = await depotDemandesPrisma(db as never).pourLecture("r");
    expect(findFirst.mock.calls[0]?.[0].select.questions.where).toEqual({
      ordre: { gt: ORDRE_QUI_REPOND },
    });
    expect(lu?.questions.map((x) => x.reponse)).toEqual(["Douze.", null]);
  });

  it("contre-témoin : une vraie réponse passe intacte", () => {
    expect(sansJeNeSaisPas("Je ne sais pas encore, plutôt mars.")).toBe(
      "Je ne sais pas encore, plutôt mars.",
    );
    expect(sansJeNeSaisPas(REPONSE_JE_NE_SAIS_PAS)).toBeNull();
    expect(sansJeNeSaisPas(null)).toBeNull();
  });
});
