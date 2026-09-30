/**
 * ⛔ La dictée éteinte détruit le son sans réessayer (extension, PR 7).
 *
 * Tant que la notice n'annonce pas la dictée, `POST sessions` répond 503
 * `dictee_non_annoncee` (garde serveur :
 * `src/server/visio/__tests__/la-dictee-est-eteinte-tant-qu-elle-n-est-pas-annoncee.spec.ts`).
 * L'extension ne doit pas prendre ce 503 pour une panne : réessayer garderait
 * le micro ouvert et le son en local pour rien. Elle DÉTRUIT la capture.
 *
 * Mutation qui rougit : retirer la branche `dictee_non_annoncee` de
 * `classerReponse` ou de `interpreterReponseSession`.
 * Contre-témoin : un 503 ordinaire (panne du site) se réessaie toujours.
 */

import { describe, expect, it } from "vitest";

import {
  classerReponse,
  interpreterReponseSession,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";

describe("⛔ la dictée éteinte détruit le son sans réessayer", () => {
  it("503 dictee_non_annoncee : détruire, et la session est refusée", () => {
    expect(classerReponse("session", 503, "dictee_non_annoncee")).toBe("detruire");
    expect(
      interpreterReponseSession(503, { erreur: "dictee_non_annoncee", message: "éteinte" }).etat,
    ).toBe("refuse");
  });

  it("contre-témoin : un 503 ordinaire se réessaie", () => {
    expect(classerReponse("session", 503, "indisponible")).toBe("reessayer");
    expect(interpreterReponseSession(503, { erreur: "indisponible", message: "" }).etat).toBe(
      "reessayer",
    );
  });
});
