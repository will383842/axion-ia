// @vitest-environment node
//
// Environnement `node` : lecture d'un fichier du dépôt.

/**
 * Verrou GEO-089 — le seed écrasait à CHAQUE déploiement les textes enrichis
 * (audit GEO/AEO du 2026-08-14, lot 18).
 *
 * ## Le défaut
 *
 * `scripts/seed-images.cjs` fait un `upsert` par slug. Les champs `title`, `alt`
 * et `caption` figuraient **à la fois** dans le bloc `create` et dans le bloc
 * `update`. Conséquence : à chaque exécution, les valeurs enrichies — celles qui
 * décrivent réellement l'image — étaient remplacées par une dérivation
 * mécanique du slug (`slugToTitle`), identique pour tout le monde.
 *
 * 🔑 Le seed se déclenche sur le `workflow_run` du déploiement. **Un seed qui
 * écrase dégrade donc les pages galerie à chaque mise en production**, sans
 * qu'aucune porte ne le voie. C'est pourquoi le plan de l'audit impose de ne PAS
 * relancer l'enrichissement avant ce correctif : le travail serait reperdu au
 * déploiement suivant.
 *
 * `publishedAt` était dans le même cas, avec un effet distinct : le remettre à
 * `new Date()` à chaque passage fait bouger la date de publication de toutes les
 * images à chaque déploiement — donc les `lastmod` des sitemaps images, donc un
 * signal de fraîcheur mensonger envoyé aux moteurs.
 *
 * ## Pourquoi une garde STATIQUE
 *
 * Le script est du CJS pur, exécuté dans un conteneur slim avec un client Prisma
 * généré à part. L'exécuter dans les tests demanderait une base. On lit donc sa
 * source : c'est moins élégant, mais ça rougit au bon moment — et c'est
 * exactement ce que le plan de l'audit demandait d'écrire AVANT le correctif.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "scripts", "seed-images.cjs"), "utf8");

/**
 * Extrait le bloc `update: { … }` d'un `upsert`, en comptant les accolades.
 *
 * Une regex non gloutonne s'arrêterait à la première `}` imbriquée et rendrait
 * un bloc tronqué — donc un test vert pour la mauvaise raison.
 */
function blocsUpdate(source: string): string[] {
  const blocs: string[] = [];
  const marqueur = /\bupdate:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = marqueur.exec(source)) !== null) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    while (i < source.length && profondeur > 0) {
      if (source[i] === "{") profondeur++;
      else if (source[i] === "}") profondeur--;
      i++;
    }
    blocs.push(source.slice(m.index + m[0].length, i - 1));
  }
  return blocs;
}

describe("l'extraction de blocs est fiable", () => {
  it("compte les accolades imbriquées au lieu de s'arrêter à la première", () => {
    const faux = "update: { a: 1, b: { c: 2 }, d: 3 }";
    expect(blocsUpdate(faux)[0]).toContain("d: 3");
  });

  it("trouve bien des blocs `update` dans le script réel", () => {
    // 🔑 Sans cette verification, une refonte du script (passage a `updateMany`,
    // par exemple) rendrait tous les tests suivants verts sur ZERO bloc.
    expect(blocsUpdate(SOURCE).length, "aucun bloc update trouve : la garde ne garde rien").toBe(2);
  });
});

describe("GEO-089 — le seed ne réécrit JAMAIS un texte enrichi", () => {
  const CHAMPS_EDITORIAUX = ["title", "alt", "caption"] as const;

  for (const champ of CHAMPS_EDITORIAUX) {
    it(`🔴 \`${champ}\` est absent de tous les blocs \`update\``, () => {
      for (const bloc of blocsUpdate(SOURCE)) {
        expect(
          new RegExp(`(^|[\\s{,])${champ}\\s*:`).test(bloc),
          `\`${champ}\` dans un bloc update : chaque deploiement ecraserait ` +
            `l'enrichissement par une derivation du slug`,
        ).toBe(false);
      }
    });
  }

  it("🔴 `publishedAt` non plus — sinon les `lastmod` bougent à chaque déploiement", () => {
    for (const bloc of blocsUpdate(SOURCE)) {
      expect(
        /(^|[\s{,])publishedAt\s*:/.test(bloc),
        "remettre publishedAt a chaque passage envoie un signal de fraicheur mensonger",
      ).toBe(false);
    }
  });

  it("ces champs restent bien présents à la CRÉATION", () => {
    // La correction ne doit pas jeter le bebe : une image NOUVELLE doit naitre
    // avec des valeurs, quitte a ce qu'elles soient mecaniques en attendant
    // l'enrichissement.
    for (const champ of [...CHAMPS_EDITORIAUX, "publishedAt"]) {
      expect(
        new RegExp(`(^|[\\s{,])${champ}\\s*:`).test(SOURCE),
        `${champ} doit rester dans le bloc create`,
      ).toBe(true);
    }
  });

  it("le script explique POURQUOI ces champs sont hors du bloc `update`", () => {
    // 🔑 Sans la raison ecrite a cote, quelqu'un les remettra « pour que le seed
    // soit vraiment idempotent » — c'est precisement le raisonnement qui a
    // produit le defaut.
    expect(SOURCE).toMatch(/GEO-089/);
  });
});
