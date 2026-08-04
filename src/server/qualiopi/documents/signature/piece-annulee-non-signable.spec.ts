/**
 * Garde — une pièce ANNULÉE n'est jamais proposée à la signature.
 *
 * ## Le défaut que cette garde ferme
 *
 * Constaté en production le 04/08/2026. Après annulation de la convention
 * `AXI-DOC-2026-003`, le panneau de signature de la page session continuait
 * d'afficher « Envoyer au client », « Copier le lien » et « Signer pour
 * l'organisme ». On pouvait donc faire signer à la cliente une pièce que
 * l'organisme venait de déclarer sans valeur — et rien à l'écran ne disait
 * qu'elle était annulée.
 *
 * Cause : la sélection filtrait sur le SEUL type signable
 * (`circuitPour(d.type) !== null`), sans regarder le sort de la pièce. Le
 * filtre `annuleeAt: null` avait été posé sur la file « à signer », sur les
 * preuves d'indicateurs, sur le ZIP d'audit et sur l'espace formateur — pas
 * sur cette surface-là.
 *
 * ## Pourquoi la garde porte sur la SOURCE
 *
 * La sélection vit dans un composant serveur de page (`sessions/[id]/page.tsx`)
 * qui charge une douzaine de requêtes Prisma : l'instancier dans un test
 * demanderait de simuler tout son contexte, pour vérifier une seule condition.
 * L'invariant, lui, est textuel et déterministe.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.join(
  process.cwd(),
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
);

describe("🔴 panneau de signature — une pièce annulée ne se signe plus", () => {
  const source = fs.readFileSync(PAGE, "utf8");

  it("la page est bien lue (sinon la garde ne garde rien)", () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain("piecesSignables");
  });

  it("`piecesSignables` exclut les pièces annulées", () => {
    // ⚠️ On cherche la CONDITION, pas le commentaire qui l'explique : un test
    // qui trouve sa propre documentation reste vert quand le code disparaît.
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    const bloc = sansCommentaires.match(/const piecesSignables = [\s\S]{0,300}?;/);
    expect(bloc, "déclaration de `piecesSignables` introuvable").not.toBeNull();
    expect(bloc![0]).toMatch(/annuleeAt\s*===\s*null|annuleeAt:\s*null/);
  });
});
