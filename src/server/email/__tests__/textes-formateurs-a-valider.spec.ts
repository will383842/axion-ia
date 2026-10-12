// M1 (lot A) — la liste des textes formateurs que l'écran de validation propose :
// chaque gabarit F1…F60, PLUS chaque variante qui se valide à part. Une variante
// ajoutée côté envoi sans figurer ici ne pourrait jamais être validée.
import { describe, expect, it } from "vitest";

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import { VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

import {
  VARIANTES_VALIDEES_A_PART,
  cleDuTexte,
  estTexteFormateurAValider,
  TEXTES_FORMATEURS_A_VALIDER,
} from "../textes-formateurs-a-valider";
import { cleTexteValide } from "../textes-valides";

describe("textes formateurs à valider", () => {
  it("porte chaque gabarit des formateurs indépendants, sans variante", () => {
    for (const g of Object.keys(TEXTES_FORMATEUR)) {
      expect(TEXTES_FORMATEURS_A_VALIDER).toContainEqual({ gabarit: g });
    }
  });

  it("porte chaque variante validée à part côté envoi, et la variante chiffrée de F23", () => {
    for (const [gabarit, parEtape] of Object.entries(VARIANTES_VALIDEES_A_PART)) {
      for (const variante of Object.values(parEtape ?? {})) {
        expect(TEXTES_FORMATEURS_A_VALIDER).toContainEqual({ gabarit, variante });
      }
    }
    expect(TEXTES_FORMATEURS_A_VALIDER).toContainEqual({
      gabarit: "formateur-mission-proposee",
      variante: "honoraires",
    });
  });

  it("aucun doublon, et chaque clé est celle que lisent les envois", () => {
    const cles = TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte);
    expect(new Set(cles).size).toBe(cles.length);
    expect(
      cleDuTexte({ gabarit: "formateur-mission-retiree", variante: "lettre-non-signee" }),
    ).toBe(cleTexteValide("formateur-mission-retiree", "lettre-non-signee"));
  });

  it("ne propose ni un gabarit d'un autre public, ni le texte de base de F23 (il part sans validation)", () => {
    expect(estTexteFormateurAValider("formateur-dossier-lien")).toBe(true);
    expect(estTexteFormateurAValider("formateur-mission-proposee", "honoraires")).toBe(true);
    expect(estTexteFormateurAValider("formateur-mission-proposee")).toBe(false);
    expect(estTexteFormateurAValider("lead-apporteur-recu")).toBe(false);
    expect(estTexteFormateurAValider("formateur-dossier-lien", "inconnue")).toBe(false);
  });

  it("chaque variante à valider a son aperçu (on ne valide pas un texte qu'on ne peut pas lire)", () => {
    for (const t of TEXTES_FORMATEURS_A_VALIDER) {
      if (t.variante === undefined) continue;
      expect(
        VARIANTES_EXEMPLE[t.gabarit]?.[t.variante],
        `${t.gabarit}#${t.variante}`,
      ).toBeDefined();
    }
  });
});
