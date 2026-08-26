/**
 * Verrou — le PDF d'un communiqué en BROUILLON se récupère depuis la console,
 * et UNIQUEMENT depuis la console (2026-08-26).
 *
 * ## Le défaut d'origine
 *
 * L'import groupé range chaque PDF en brouillon, mais la seule route qui sert
 * les PDF (`/api/presse/communique/[id]`) filtrait `status: "published"` :
 * un brouillon avait donc son fichier stocké sur le volume console-docs sans
 * qu'AUCUNE interface ne permette de le relire. La fiche admin affichait le
 * nom du fichier — sans lien.
 *
 * ## Le contrat verrouillé (trois faces)
 *
 * 1. la route sert les non-publiés à un admin connecté — et à lui seul :
 *    le chemin anonyme garde son filtre `published` ;
 * 2. un non-publié part en `no-store` : aucun cache (Cloudflare compris)
 *    ne doit retenir un contenu que la salle de presse publique refuse ;
 * 3. la fiche admin ET la liste pointent réellement vers la route — sinon
 *    l'accès « existe » côté API mais reste introuvable à l'usage.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const ROUTE = sansCommentaires(source("src/app/api/presse/communique/[id]/route.ts"));
const FICHE = sansCommentaires(
  source("src/app/[locale]/(admin)/[adminPrefix]/presse/communiques/[id]/page.tsx"),
);
const LISTE = sansCommentaires(
  source("src/app/[locale]/(admin)/[adminPrefix]/presse/communiques/page.tsx"),
);

describe("route PDF communiqué — brouillon lisible par un admin, par lui seul", () => {
  it("lit la session et reconnaît les deux rôles admin", () => {
    expect(ROUTE).toMatch(/await auth\(\)/);
    expect(ROUTE).toMatch(/"admin"/);
    expect(ROUTE).toMatch(/"super_admin"/);
  });

  it("ne lève le filtre published QUE pour l'admin (l'anonyme le garde)", () => {
    // Le filtre doit être conditionnel à isAdmin — pas retiré purement et
    // simplement, ce qui exposerait les brouillons au public.
    expect(ROUTE).toMatch(/isAdmin\s*\?\s*\{\}\s*:\s*\{\s*status:\s*"published"\s*\}/);
  });

  it("sert un non-publié en no-store (jamais en cache public)", () => {
    expect(ROUTE).toMatch(/"published"\s*\?\s*"public, max-age=3600"\s*:\s*"private, no-store"/);
  });
});

describe("console — le PDF est atteignable là où on le cherche", () => {
  it("la fiche du communiqué porte un lien vers la route PDF", () => {
    expect(FICHE).toMatch(/\/api\/presse\/communique\/\$\{id\}/);
  });

  it("la liste des communiqués porte un lien PDF par ligne", () => {
    expect(LISTE).toMatch(/\/api\/presse\/communique\/\$\{row\.id\}/);
  });
});
