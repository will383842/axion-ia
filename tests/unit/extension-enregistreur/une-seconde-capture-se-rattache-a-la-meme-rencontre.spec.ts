/**
 * Une seconde capture se rattache à la même rencontre (PR 5) : après une
 * coupure de Meet (limite à trois) ou un plantage, Will reclique Démarrer. Si
 * un enregistrement de la rencontre est encore actif, le site répond 409
 * « enregistrement_actif » avec son identifiant : l'extension s'y rattache au
 * lieu d'abandonner. Un refus motivé, lui, reste un refus.
 */

import { describe, expect, it } from "vitest";

import {
  classerReponse,
  interpreterReponseSession,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";

const ID = "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b";

describe("une seconde capture se rattache à la même rencontre", () => {
  it("409 enregistrement_actif → rattachement à l'enregistrement qui vit", () => {
    expect(
      interpreterReponseSession(409, { erreur: "enregistrement_actif", enregistrementId: ID }),
    ).toEqual({
      etat: "ok",
      enregistrementId: ID,
      repris: true,
    });
    expect(classerReponse("session", 409, "enregistrement_actif")).toBe("fait");
  });

  it("200 → nouvel enregistrement ; 409 motivé → refus ; 401 → jeton ; panne → nouvel essai", () => {
    expect(interpreterReponseSession(200, { enregistrementId: ID, repris: false })).toMatchObject({
      etat: "ok",
      repris: false,
    });
    expect(interpreterReponseSession(409, { erreur: "opposition_ia", message: "…" })).toMatchObject(
      {
        etat: "refuse",
        motif: "opposition_ia",
      },
    );
    expect(interpreterReponseSession(401, { message: "Jeton expiré" })).toMatchObject({
      etat: "jeton",
    });
    expect(interpreterReponseSession(503, null)).toEqual({ etat: "reessayer" });
  });
});
