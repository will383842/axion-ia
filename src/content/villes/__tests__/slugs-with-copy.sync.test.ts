// Garde de synchronisation du découplage villes (2026-08-16).
//
// `src/content/villes/core.ts` remplace le prédicat `!!ville.copy` par une liste
// de slugs générée, pour ne pas avoir à charger les 29 Mo de `copy/`. Ce fichier
// est le seul endroit du dépôt où les deux se rencontrent : il importe le barrel
// COMPLET (donc il est lent, ~40 s — c'est assumé, c'est son rôle) et vérifie que
// la liste générée dit exactement la même chose que la vraie donnée.
//
// S'il échoue, c'est qu'un contenu éditorial a été ajouté ou retiré sans
// régénérer :  pnpm tsx scripts/gen-villes-slugs-with-copy.ts
//
// Ne PAS « réparer » ce test en éditant le fichier généré à la main : il est
// écrasé au prochain passage du script.

import { describe, it, expect } from "vitest";

import { VILLES } from "@/content/villes";
import { VILLE_SLUGS_WITH_COPY } from "@/generated/villes-slugs-with-copy";
import { hasVilleCopy, VILLES_CORE } from "../core";

describe("découplage villes — la liste générée suit le vrai contenu éditorial", () => {
  // Timeout explicite par test : ce fichier charge volontairement le barrel
  // complet (~40 s à froid), c'est la contrepartie assumée de la garde.
  it("VILLE_SLUGS_WITH_COPY == les slugs qui ont réellement un copy", () => {
    const reels = VILLES.filter((v) => !!v.copy)
      .map((v) => v.slug)
      .sort((a, b) => a.localeCompare(b));
    const generes = [...VILLE_SLUGS_WITH_COPY].sort((a, b) => a.localeCompare(b));

    // Messages ciblés : en cas de dérive on veut savoir QUELS slugs, pas juste
    // « 2157 !== 2156 » sur un diff de 2000 lignes illisible.
    const manquants = reels.filter((s) => !generes.includes(s));
    const enTrop = generes.filter((s) => !reels.includes(s));
    expect(manquants, "slugs avec copy absents du fichier généré").toEqual([]);
    expect(enTrop, "slugs du fichier généré qui n'ont plus de copy").toEqual([]);
    expect(generes).toEqual(reels);
  });

  it("hasVilleCopy() répond comme le barrel, ville par ville", () => {
    const desaccords = VILLES.filter((v) => hasVilleCopy(v.slug) !== !!v.copy).map((v) => v.slug);
    expect(desaccords, "villes où core.hasVilleCopy contredit ville.copy").toEqual([]);
  });

  it("core et barrel décrivent le même ensemble de communes", () => {
    expect(VILLES_CORE.length).toBe(VILLES.length);
    expect(VILLES_CORE.map((v) => v.slug).sort()).toEqual(VILLES.map((v) => v.slug).sort());
  });
});
