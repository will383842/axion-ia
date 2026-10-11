/**
 * Lot L0c-2 — modèles « formateur indépendant » du composeur de réponse.
 * Livré ÉTEINT (`formateurs.modeles_composeur`) : coupé, le composeur propose
 * exactement les modèles d'aujourd'hui, et le serveur refuse les nouveaux.
 */

import { describe, expect, it } from "vitest";

import {
  MODELES_REPONSE,
  MODELES_REPONSE_FORMATEUR,
  MODELES_REPONSE_FORMATEUR_IDS,
  MODELES_REPONSE_IDS,
  modeleAutorise,
  modelesDuComposeur,
} from "../modeles-reponse";

describe("L0c-2 — modèles du composeur", () => {
  it("coupé : les modèles d'aujourd'hui, et eux seuls", () => {
    expect(modelesDuComposeur({ modelesFormateur: false })).toEqual(MODELES_REPONSE);
    for (const id of MODELES_REPONSE_FORMATEUR_IDS) {
      expect(modeleAutorise(id, { modelesFormateur: false })).toBe(false);
    }
    for (const id of MODELES_REPONSE_IDS) {
      expect(modeleAutorise(id, { modelesFormateur: false })).toBe(true);
    }
  });

  it("allumé, candidature de formateur freelance : trois modèles de plus", () => {
    const ids = modelesDuComposeur({ modelesFormateur: true }).map((m) => m.id);
    expect(ids).toEqual([...MODELES_REPONSE_IDS, ...MODELES_REPONSE_FORMATEUR_IDS]);
    expect(MODELES_REPONSE_FORMATEUR.map((m) => m.libelle)).toEqual([
      "Proposition d'un échange",
      "Non retenu après l'échange",
      "Absent à l'échange",
    ]);
    for (const id of MODELES_REPONSE_FORMATEUR_IDS) {
      expect(id.length).toBeLessThanOrEqual(40);
      expect(modeleAutorise(id, { modelesFormateur: true })).toBe(true);
    }
  });

  it("textes : vouvoiement, lexique, aucune conservation promise", () => {
    for (const m of MODELES_REPONSE_FORMATEUR) {
      const t = `${m.objet}\n${m.corps}`;
      expect(t, m.id).not.toMatch(
        /\bposte\b|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|\btu\b|\bton\b/i,
      );
      expect(t, m.id).not.toMatch(/(gardons|conservons)[^.]{0,40}candidature|vivier/i);
      expect(m.corps.startsWith("Bonjour {prenom},")).toBe(true);
    }
  });
});
