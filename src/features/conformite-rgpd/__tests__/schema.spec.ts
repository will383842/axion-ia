import { describe, expect, it } from "vitest";

import { lireRegistreJson, validerRegistre } from "../schema";
import { registreFictif } from "./fixtures";

describe("format du registre", () => {
  it("accepte un registre fictif, ignore l'inconnu et laisse vide ce qui manque", () => {
    const r = validerRegistre(registreFictif);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.registre).not.toHaveProperty("champInconnu");
    const [a, b] = r.registre.traitements;
    expect(a?.donnees).toEqual(["Donnée A"]);
    expect(a?.finalite).toBeNull();
    expect(b?.destinataires).toEqual([]);
    expect(a?.ecarts[0]?.statut).toBe("ouvert");
  });

  it("refuse une gravité inconnue en nommant le champ", () => {
    const r = validerRegistre({
      traitements: [{ id: "x", nom: "X", ecarts: [{ gravite: "urgent" }] }],
    });
    expect(r).toEqual({
      ok: false,
      erreur:
        "Champ « traitements › n° 1 › ecarts › n° 1 › gravite » : valeur attendue : critique, eleve, moyen ou faible.",
    });
  });

  it("refuse une activité sans nom", () => {
    const r = validerRegistre({ traitements: [{ id: "x" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("traitements › n° 1 › nom");
  });

  it("refuse un identifiant en double", () => {
    const r = validerRegistre({
      traitements: [
        { id: "x", nom: "X" },
        { id: "x", nom: "Y" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("n° 2 › id");
  });

  it("refuse un fichier qui n'est pas du JSON, ou sans liste « traitements »", () => {
    expect(lireRegistreJson("pas du json")).toEqual({
      ok: false,
      erreur: "Ce fichier n'est pas un JSON lisible.",
    });
    const r = lireRegistreJson("{}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("traitements");
  });

  it("aucune valeur du fichier n'entre dans le message d'erreur", () => {
    const r = validerRegistre({
      traitements: [{ id: "x", nom: "Nom secret", ecarts: [{ gravite: "valeur-secrete" }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).not.toContain("secret");
    }
  });
});
