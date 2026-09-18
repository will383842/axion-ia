/**
 * le-materiel-annonce-est-celui-de-la-base.spec.ts
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * Mesuré le 2026-09-18 : la base (`formations.moyens_techniques`, texte de
 * `catalog-import.ts`) dit, pour les 22 formations, que chaque participant
 * utilise « son smartphone ou son poste ». Ce champ est imprimé sur le programme
 * PDF et la convocation. Les fiches publiques de 21 formations disaient au
 * contraire « Ordinateur portable ». Le même stagiaire lisait donc deux règles.
 *
 * Décision de Will du 2026-09-18 : smartphone OU ordinateur. Deux exceptions
 * gardées sur ordinateur, à confirmer par Will : IA pour l'IT (environnement de
 * développement habituel) et IA pour l'automatisation (construction d'un
 * prototype sur poste). Le séminaire n'exige aucun matériel individuel.
 *
 * Cette garde rougit si une fiche hors exceptions réaffirme l'ordinateur seul.
 */
import { describe, expect, it } from "vitest";

import { getFormationMateriel } from "@/content/formations/catalog-v2-facts";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { FAQ_GLOBAL } from "@/content/transversal";

/** Fiches où le smartphone serait une promesse fausse — gardées sur ordinateur. */
const EXCEPTIONS_ORDINATEUR = new Set(["ia-pour-l-it", "ia-pour-l-automatisation"]);

describe("le matériel annoncé sur les fiches est celui que disent la base et le programme PDF", () => {
  const formations = FORMATIONS_V2.filter((f) => !f.seminaire);

  it("porte sur les 21 formations hors séminaire", () => {
    expect(formations.length).toBe(21);
  });

  it.each(
    formations.filter((f) => !EXCEPTIONS_ORDINATEUR.has(f.id)).map((f) => [f.id, f] as const),
  )("%s annonce « smartphone ou ordinateur »", (_id, f) => {
    const materiel = getFormationMateriel(f);
    expect(materiel).toMatch(/smartphone ou (un )?ordinateur/i);
    expect(materiel).not.toMatch(/^ordinateur portable/i);
  });

  it("les exceptions restent sur ordinateur, et elles existent", () => {
    for (const id of EXCEPTIONS_ORDINATEUR) {
      const f = formations.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(getFormationMateriel(f!)).toMatch(/^ordinateur portable/i);
    }
  });

  it("la FAQ publique ne réaffirme pas l'ordinateur portable comme seul matériel", () => {
    const texte = JSON.stringify(FAQ_GLOBAL);
    expect(texte).not.toMatch(/un ordinateur portable et une connexion internet suffisent/i);
  });
});
