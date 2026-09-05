/**
 * Le suivi de dossier doit MENER au geste, pas seulement le décrire.
 *
 * ## Le défaut, vécu le 2026-09-04
 *
 * Will, sur son propre outil : « je n'ai pas trouvé le bouton pour
 * contresigner ». Le suivi disait pourtant, mot pour mot :
 *
 *     « Acte HABILITÉ, jamais automatique : bloc Signatures, "Contresigner". »
 *
 * Deux mots, deux erreurs : le bloc s'appelle **« Signature des pièces
 * contractuelles »**, le bouton **« Signer pour l'organisme »**. Ni l'un ni
 * l'autre n'existe sous le nom cité. Une phrase d'aide qui nomme des choses
 * absentes de l'écran est pire qu'une absence d'aide : elle envoie chercher.
 *
 * Et même exacte, elle n'aurait pas suffi — la fiche fait plus de 4 000 px et
 * empile douze blocs.
 *
 * ## Ce que ces témoins protègent
 *
 * 1. Chaque étape actionnable porte une ancre.
 * 2. L'ancre pointe une section qui EXISTE réellement dans la page.
 * 3. Le libellé de l'ancre nomme le bloc tel qu'il s'affiche.
 *
 * Le point 2 est le seul qui rougisse si quelqu'un renomme un `id` de section
 * — c'est-à-dire exactement le glissement qui a produit le défaut d'origine.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = resolve(__dirname, "../../../../..");

const CHEMIN_PARCOURS = "src/server/qualiopi/parcours/session-parcours.ts";
const CHEMIN_PAGE =
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx";

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf8");
}

/** Les `ancre: { id: "…", libelle: "…" }` déclarés dans le parcours. */
function ancresDeclarees(): Array<{ id: string; libelle: string }> {
  const source = lire(CHEMIN_PARCOURS);
  const re = /ancre:\s*\{\s*id:\s*"([^"]+)",\s*libelle:\s*"([^"]+)"\s*\}/g;
  const out: Array<{ id: string; libelle: string }> = [];
  for (const m of source.matchAll(re)) out.push({ id: m[1]!, libelle: m[2]! });
  return out;
}

/** Les `id="…"` des `<section>` de la fiche de session. */
function sectionsDeLaPage(): Set<string> {
  const source = lire(CHEMIN_PAGE);
  const out = new Set<string>();
  for (const m of source.matchAll(/id="([a-z0-9-]+)"/g)) out.add(m[1]!);
  return out;
}

describe("le suivi de dossier mène au geste", () => {
  it("déclare au moins une ancre — sinon le test ne vérifie rien", () => {
    // Témoin positif. Sans lui, supprimer toutes les ancres rendrait la suite
    // verte en ne parcourant aucune itération.
    expect(ancresDeclarees().length).toBeGreaterThanOrEqual(10);
  });

  it("🔴 chaque ancre pointe une section qui EXISTE dans la fiche", () => {
    const sections = sectionsDeLaPage();
    for (const { id, libelle } of ancresDeclarees()) {
      expect(
        sections.has(id),
        `L'étape « ${libelle} » renvoie vers #${id}, qui n'est l'id d'aucune ` +
          `<section> de la fiche de session. Le lien mènera nulle part — c'est ` +
          `la version moderne du « bloc Signatures » qui n'existait pas. ` +
          `Sections réellement présentes : ${[...sections].sort().join(", ")}.`,
      ).toBe(true);
    }
  });

  it("aucun libellé d'ancre ne nomme un bloc au nom fantôme", () => {
    // Les deux noms exacts qui ont produit le défaut. Ils ne doivent plus
    // apparaître seuls : « Signatures » sans « des pièces », « Contresigner »
    // comme nom de bouton.
    for (const { libelle } of ancresDeclarees()) {
      expect(
        /^bloc Signatures$/.test(libelle),
        `« ${libelle} » : ce bloc n'existe pas sous ce nom à l'écran. ` +
          `Il s'appelle « Signature des pièces contractuelles ».`,
      ).toBe(false);
      expect(
        /Contresigner/.test(libelle),
        `« ${libelle} » : le bouton s'appelle « Signer pour l'organisme ».`,
      ).toBe(false);
    }
  });

  it("le rendu n'offre le lien que sur ce qui reste à faire", () => {
    // Un lien sur les quinze lignes noierait les trois qui comptent. La règle
    // vit dans le composant ; on vérifie qu'elle y est écrite.
    const rendu = lire("src/features/admin-qualiopi/session-hub/ChecklistSession.tsx");
    expect(rendu).toContain('e.etat !== "fait"');
    expect(rendu).toContain('e.etat !== "sans_objet"');
  });
});
