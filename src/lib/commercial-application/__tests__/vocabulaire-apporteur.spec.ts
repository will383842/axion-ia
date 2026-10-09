/**
 * 🔴 GARDE LEXICALE (Candidatures unifiées L6) — aucun mot de recrutement dans
 * ce que le composeur apporteur propose : modèles (objet, corps, libellé, aide).
 */
import { describe, expect, it } from "vitest";

import { MODELES_REPONSE_APPORTEUR } from "@/content/apporteurs/modeles-reponse";
import {
  MOTS_INTERDITS_APPORTEUR,
  motsInterditsApporteur,
} from "@/lib/commercial-application/vocabulaire-apporteur";

describe("vocabulaire apporteur", () => {
  it("le témoin : la liste attrape bien les mots d'une sélection d'emploi", () => {
    for (const t of ["Votre candidature", "le poste", "notre entretien", "non retenue", "CV"]) {
      expect(motsInterditsApporteur(t), t).not.toEqual([]);
    }
    expect(MOTS_INTERDITS_APPORTEUR.length).toBeGreaterThan(10);
  });

  it.each(MODELES_REPONSE_APPORTEUR.map((m) => [m.id, m] as const))(
    "modèle « %s » : aucun mot interdit",
    (_id, m) => {
      const tout = [m.libelle, m.quand, m.objet, m.corps].join("\n");
      expect(motsInterditsApporteur(tout)).toEqual([]);
    },
  );

  it("vouvoiement : aucun tutoiement dans les modèles", () => {
    for (const m of MODELES_REPONSE_APPORTEUR) {
      expect(`${m.objet}\n${m.corps}`, m.id).not.toMatch(/\b(tu|te|toi|ton|ta|tes)\b/i);
    }
  });

  it("le premier modèle est le message libre (aucun texte imposé)", () => {
    expect(MODELES_REPONSE_APPORTEUR[0]).toMatchObject({ id: "libre", objet: "", corps: "" });
  });
});
