/**
 * 🔴 Le retour d'`enqueueEmail` ne se JETTE pas.
 *
 * ## Pourquoi cette garde existe
 *
 * `enqueueEmail` **ne lève sur aucun de ses chemins d'échec**. Elle RETOURNE
 * `{ enqueued: false }` : file de messages absente, adresse sur liste de
 * suppression, message garé en corbeille de validation, corbeille
 * indisponible. Un appelant qui ignore ce retour croit avoir envoyé, et écrit
 * l'état qui va avec.
 *
 * Le 2026-09-05, `notifierAlertesGroupees` faisait exactement cela — et c'est le
 * chemin par lequel les alertes atteignent un humain. Elle posait `notifiedAt`,
 * appelait `enqueueEmail` sans même assigner son retour, puis incrémentait ses
 * compteurs. Un `catch` était censé relâcher le claim, mais il ne s'arme que sur
 * une exception LEVÉE. File coupée ⇒ alerte marquée notifiée, aucun e-mail, et
 * **jamais retentée** puisque la sélection exige `notifiedAt: null`.
 *
 * ## Ce que la garde vise, et ce qu'elle ne vise pas
 *
 * 🔑 Le défaut n'est pas une inattention isolée : **`enqueueEmail` a une
 * signature qui se laisse ignorer**, et le dépôt contient les deux
 * comportements côte à côte. `envoyer-reponse.ts` lie son retour
 * (`misEnFile = r.enqueued`) et marque la ligne en échec ; l'appelant des
 * alertes ne le lisait pas. Une garde qui viserait le CAS corrigé ne servirait à
 * rien — c'est la FORME qu'il faut refuser.
 *
 * ⚠️ Elle DISCRIMINE, et c'est le minimum qu'on demande à une garde : elle
 * rougissait sur l'appelant fautif et passait sur les appelants sains. Une garde
 * qui condamnerait tous les appels serait désarmée au premier faux positif.
 *
 * ## Ce qui compte comme « lu »
 *
 * - `const x = await enqueueEmail(...)` — lié à une variable ;
 * - `if (!(await enqueueEmail(...)))` — testé directement ;
 * - `return enqueueEmail(...)` / `.enqueued` — la décision remonte à l'appelant.
 *
 * Ce qui ne compte PAS : `await enqueueEmail(...);` en instruction nue. C'est
 * précisément la forme qui a coûté.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();

/** Les fichiers du domaine Qualiopi qui appellent `enqueueEmail`. */
function fichiersAppelants(): ReadonlyArray<{ chemin: string; source: string }> {
  const racines = [
    "src/server/qualiopi",
    "src/server/actions/qualiopi",
    "src/server/queue/workers",
  ];
  const trouves: Array<{ chemin: string; source: string }> = [];
  const parcourir = (dossier: string): void => {
    const abs = path.join(RACINE, dossier);
    if (!fs.existsSync(abs)) return;
    for (const entree of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dossier}/${entree.name}`;
      if (entree.isDirectory()) {
        parcourir(rel);
        continue;
      }
      if (!/\.tsx?$/.test(entree.name)) continue;
      // Les fichiers de test CITENT `enqueueEmail` pour le moquer : les lire
      // produirait des faux positifs sur du code qui n'envoie rien.
      if (/\.(spec|test)\.tsx?$/.test(entree.name)) continue;
      const source = fs.readFileSync(path.join(RACINE, rel), "utf-8");
      if (source.includes("enqueueEmail(")) trouves.push({ chemin: rel, source });
    }
  };
  for (const r of racines) parcourir(r);
  return trouves;
}

/** Retire les commentaires : la prose qui documente le défaut le cite. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/.*$/, ""))
    .join("\n");
}

/**
 * Les appels dont le retour part à la poubelle : `await enqueueEmail(` en tête
 * d'instruction, sans rien devant pour le recevoir ni le tester.
 */
function appelsDontLeRetourEstJete(source: string): number {
  const propre = sansCommentaires(source);
  const lignes = propre.split(/\r?\n/);
  let compte = 0;
  for (const ligne of lignes) {
    const t = ligne.trim();
    if (!t.startsWith("await enqueueEmail(") && !t.startsWith("enqueueEmail(")) continue;
    compte++;
  }
  return compte;
}

describe("🔴 le retour d'`enqueueEmail` ne se jette pas", () => {
  it("le recensement TROUVE des appelants — sinon la garde ne garde rien", () => {
    // Témoin positif obligatoire. Un parcours cassé rend une liste vide, et une
    // liste vide passe toutes les assertions ci-dessous sans rien mesurer :
    // « aucun appelant fautif » et « je ne sais pas lire l'arborescence »
    // seraient indiscernables.
    const appelants = fichiersAppelants();
    expect(appelants.length).toBeGreaterThanOrEqual(3);
    expect(appelants.map((a) => a.chemin)).toContain(
      "src/server/qualiopi/notifications/notifications-service.ts",
    );
  });

  it("aucun appel Qualiopi ne jette le retour d'`enqueueEmail`", () => {
    const fautifs = fichiersAppelants()
      .map((a) => ({ chemin: a.chemin, n: appelsDontLeRetourEstJete(a.source) }))
      .filter((a) => a.n > 0);
    expect(fautifs).toEqual([]);
  });

  it("le détecteur RECONNAÎT la forme fautive — sur un échantillon fabriqué", () => {
    // 🔑 Contre-épreuve du DÉTECTEUR lui-même, pas du code. Sans elle, un
    // prédicat qui rendrait toujours `0` ferait passer le témoin précédent pour
    // l'éternité — c'est le cas « dix zéros » : « rien à signaler » et « la
    // sonde ne mesure rien » ont la même sortie.
    const fautif = `
      async function envoyer() {
        await enqueueEmail("qualiopi-alerte-interne", "a@b.c", "fr", {});
      }
    `;
    const sain = `
      async function envoyer() {
        const envoi = await enqueueEmail("qualiopi-alerte-interne", "a@b.c", "fr", {});
        if (!envoi.enqueued) return false;
        return true;
      }
    `;
    const saintTeste = `
      async function envoyer() {
        if (!(await enqueueEmail("qualiopi-alerte-interne", "a@b.c", "fr", {})).enqueued) {
          return false;
        }
        return true;
      }
    `;
    expect(appelsDontLeRetourEstJete(fautif)).toBe(1);
    expect(appelsDontLeRetourEstJete(sain)).toBe(0);
    expect(appelsDontLeRetourEstJete(saintTeste)).toBe(0);
  });

  it("le détecteur ne se déclenche pas sur un COMMENTAIRE qui cite l'appel", () => {
    // Deux gardes de cette session ont rougi sur la prose qui EXPLIQUE le
    // défaut. Chercher une faute dans le texte qui la documente est le faux
    // positif le plus prévisible d'une garde qui lit la source.
    const commente = `
      // await enqueueEmail("x", "a@b.c", "fr", {});
      /* await enqueueEmail("y", "a@b.c", "fr", {}); */
      const envoi = await enqueueEmail("z", "a@b.c", "fr", {});
      if (!envoi.enqueued) return false;
    `;
    expect(appelsDontLeRetourEstJete(commente)).toBe(0);
  });
});
