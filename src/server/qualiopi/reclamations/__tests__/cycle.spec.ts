/**
 * L09 — l'enchaînement des étapes d'une réclamation.
 */
import { describe, expect, it } from "vitest";
import { etapesPossibles, verifierEtape } from "../cycle";

describe("cycle d'une réclamation", () => {
  it("après la réception : accusé (s'il manque) puis analyse", () => {
    expect(etapesPossibles(["reception"])).toEqual(["accuse", "analyse"]);
    expect(etapesPossibles(["reception", "accuse"])).toEqual(["analyse"]);
  });

  it("une réponse exige une analyse", () => {
    expect(verifierEtape(["reception", "accuse"], "reponse")).toEqual({
      ok: false,
      erreur: "« Réponse écrite » ne peut pas suivre « Réception ».",
    });
    expect(verifierEtape(["reception", "accuse", "analyse"], "reponse")).toEqual({
      ok: true,
      statut: "resolue",
    });
  });

  it("après la réponse : réexamen ou clôture ; un réexamen rouvre l'analyse", () => {
    const repondue = ["reception", "accuse", "analyse", "reponse"] as const;
    expect(etapesPossibles(repondue)).toEqual(["reexamen", "cloture"]);
    expect(verifierEtape(repondue, "reexamen")).toEqual({ ok: true, statut: "en_cours" });
    expect(etapesPossibles([...repondue, "reexamen"])).toEqual(["analyse"]);
  });

  it("une réclamation close peut être réexaminée, rien d'autre", () => {
    const close = ["reception", "accuse", "analyse", "reponse", "cloture"] as const;
    expect(etapesPossibles(close)).toEqual(["reexamen"]);
    expect(verifierEtape(close, "analyse").ok).toBe(false);
  });

  it("la réception ne s'ajoute jamais, et une réclamation sans étape n'accepte rien", () => {
    expect(verifierEtape(["reception"], "reception").ok).toBe(false);
    expect(etapesPossibles([])).toEqual([]);
  });

  it("l'accusé tardif se pose encore pendant le traitement, mais pas après la clôture", () => {
    expect(etapesPossibles(["reception", "analyse"])).toEqual(["accuse", "analyse", "reponse"]);
    expect(etapesPossibles(["reception", "analyse", "reponse", "cloture"])).toEqual(["reexamen"]);
  });
});
