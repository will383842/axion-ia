/**
 * Garde de `cheminDeRoute` — la conversion dont l'échec est SILENCIEUX.
 *
 * `revalidatePath` raisonne sur l'arborescence des FICHIERS de route, pas sur
 * les URLs servies. Présenté `/fr/audit/par-ville/[ville]`, il ne trouve rien
 * à régénérer — et **il ne le dit pas**. La surcharge d'aperçu enregistrée
 * depuis la console semblerait alors n'avoir aucun effet, sans le moindre
 * message d'erreur.
 *
 * Ce fichier existe parce que la fonction était jusqu'ici exportée d'un module
 * `"use server"` : intestable (aucun test ne peut importer une Server Action
 * comme fonction pure) et, accessoirement, cause d'un échec de build
 * (« Server Actions must be async functions ») visible ni au typage ni aux
 * tests, seulement au `next build`.
 */
import { describe, it, expect } from "vitest";
import { cheminDeRoute } from "../chemin-de-route";

describe("cheminDeRoute — chemin servi → chemin de fichier de route", () => {
  it("remplace le segment de locale par le segment dynamique [locale]", () => {
    expect(cheminDeRoute("/fr/audit")).toBe("/[locale]/audit");
    expect(cheminDeRoute("/en/audit")).toBe("/[locale]/audit");
  });

  it("préserve les segments dynamiques déjà présents — le cas qui a motivé la fonction", () => {
    expect(cheminDeRoute("/fr/audit/par-ville/[ville]")).toBe("/[locale]/audit/par-ville/[ville]");
  });

  it("rend la racine localisée pour un chemin de locale seule", () => {
    expect(cheminDeRoute("/fr")).toBe("/[locale]");
    expect(cheminDeRoute("/fr/")).toBe("/[locale]");
  });

  it("rend la racine pour un chemin vide ou réduit à des séparateurs", () => {
    expect(cheminDeRoute("/")).toBe("/[locale]");
    expect(cheminDeRoute("")).toBe("/[locale]");
    expect(cheminDeRoute("///")).toBe("/[locale]");
  });

  it("ne laisse jamais de barre oblique finale — `revalidatePath` ne l'accepte pas", () => {
    for (const entree of ["/fr/audit/", "/fr/audit/par-ville/", "/fr/"]) {
      expect(cheminDeRoute(entree), entree).not.toMatch(/.\/$/);
    }
  });

  it("traverse plusieurs niveaux sans en perdre", () => {
    expect(cheminDeRoute("/fr/implementation/par-fonction/marketing")).toBe(
      "/[locale]/implementation/par-fonction/marketing",
    );
  });
});
