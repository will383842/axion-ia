/**
 * 🔒 GARDE DE DÉPÔT — il n'existe qu'UNE porte vers `handicapDetailsChiffre`.
 *
 * ## Pourquoi une garde et pas seulement un correctif
 *
 * La colonne avait QUATRE chemins d'écriture, chacun appelant `encryptPii`
 * directement. Trois d'entre eux ne vérifiaient pas le résultat. Ce n'est pas un
 * oubli isolé : c'est ce qui arrive à une protection recopiée. Corriger les
 * quatre sans garde, c'est accepter que le cinquième reparte de zéro.
 *
 * `encryptPii` n'échoue jamais : elle chiffre, ou elle rend l'entrée INCHANGÉE
 * (chaîne vide, entrée déjà préfixée, clé absente). Un appelant qui ne regarde
 * pas le résultat écrit donc du clair dans une colonne de données de santé.
 *
 * ## Ce que cette garde exige
 *
 * Tout fichier de production qui ÉCRIT la colonne passe par
 * `chiffrerDetailSante`. Aucun n'appelle `encryptPii` sur cette colonne.
 *
 * ⚠️ Cette garde porte un TÉMOIN POSITIF : elle vérifie qu'elle trouve bien les
 * fichiers qu'elle prétend surveiller. Une garde qui n'inspecte rien passe au
 * vert sans rien garder — ce dépôt l'a déjà payé (#1104 : un chemin relatif
 * faux rendait zéro module, et la garde était verte).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const RACINE = resolve(__dirname, "../../../..", "src");
const COLONNE = "handicapDetailsChiffre";

function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules" || entree === "__tests__") continue;
      fichiersSource(chemin, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    acc.push(chemin);
  }
  return acc;
}

/** Les fichiers de production qui ÉCRIVENT la colonne (pas ceux qui la lisent). */
function fichiersQuiEcriventLaColonne(): { chemin: string; contenu: string }[] {
  return fichiersSource(RACINE)
    .map((chemin) => ({ chemin, contenu: readFileSync(chemin, "utf8") }))
    .filter(({ contenu }) => {
      // Une ÉCRITURE ressemble à `handicapDetailsChiffre: <valeur>` dans un
      // `data:`. Une LECTURE est `handicapDetailsChiffre: true` dans un
      // `select:`, ou `{ not: null }` dans un `where:`.
      const occurrences = contenu.match(new RegExp(`${COLONNE}:\\s*([^,\\n]+)`, "g")) ?? [];
      return occurrences.some((o) => !/:\s*(true|false|\{)/.test(o));
    });
}

describe("🔒 une seule porte vers le détail de santé", () => {
  it("🔴 aucun fichier de production n'écrit la colonne via `encryptPii`", () => {
    const fautifs = fichiersSource(RACINE)
      .map((chemin) => ({ chemin, contenu: readFileSync(chemin, "utf8") }))
      .filter(({ contenu }) => new RegExp(`${COLONNE}:\\s*encryptPii\\(`).test(contenu))
      .map(({ chemin }) => chemin.replace(RACINE, "src"));

    expect(
      fautifs,
      "`encryptPii` rend le texte INCHANGÉ si la clé manque ou si l'entrée porte " +
        "déjà le préfixe : cette écriture peut poser une donnée de santé en clair. " +
        "Passer par `chiffrerDetailSante`, qui refuse quand rien n'a été transformé.",
    ).toEqual([]);
  });

  it("🔴 CHAQUE écriture de la colonne vient de la garde partagée", () => {
    // ⚠️ Vérifier que le FICHIER importe la garde ne suffit pas : un second
    // chemin d'écriture ajouté dans un fichier déjà gardé passerait au vert.
    // C'est précisément l'erreur d'origine — une protection présente à côté
    // d'une écriture qui ne s'en sert pas. On inspecte donc chaque occurrence.
    const violations: string[] = [];

    for (const { chemin, contenu } of fichiersQuiEcriventLaColonne()) {
      const court = chemin.replace(RACINE, "src");
      for (const occurrence of contenu.match(new RegExp(`${COLONNE}:\\s*([^,\\n}]+)`, "g")) ?? []) {
        const valeur = occurrence.split(":").slice(1).join(":").trim();

        // Lecture (`select`/`where`) ou effacement art. 17 : rien à chiffrer.
        if (/^(true|false|null|\{)/.test(valeur)) continue;

        // Une expression en ligne — `encryptPii(…)`, `p.texte`, un littéral —
        // n'est jamais acceptable : la valeur doit venir d'une variable que la
        // garde a produite, et dont le type `string | null` force le test.
        if (!/^[A-Za-z_$][\w$]*$/.test(valeur)) {
          violations.push(`${court} — écriture en ligne : \`${valeur}\``);
          continue;
        }

        const produitParLaGarde = new RegExp(
          `(?:const|let|var)\\s+${valeur}\\b[^;]*?(?:chiffrerDetailSante|detailCumule)\\s*\\(`,
          "s",
        );
        if (!produitParLaGarde.test(contenu)) {
          violations.push(`${court} — \`${valeur}\` ne vient pas de la garde`);
        }
      }
    }

    expect(
      violations,
      "une écriture de donnée de santé ne passe pas par `chiffrerDetailSante` : " +
        "elle peut poser du clair en base si la clé manque ou si l'entrée porte déjà le préfixe.",
    ).toEqual([]);
  });

  it("🔑 témoin positif : la garde inspecte réellement des fichiers", () => {
    // Sans ce cas, un chemin de racine faux rendrait zéro fichier — et les deux
    // cas ci-dessus passeraient au vert en ne gardant rien.
    expect(fichiersSource(RACINE).length, "la racine `src` n'a pas été trouvée").toBeGreaterThan(
      1_000,
    );

    const ecrivains = fichiersQuiEcriventLaColonne().map(({ chemin }) =>
      chemin.replace(RACINE, "src"),
    );
    expect(
      ecrivains.length,
      "aucun écrivain de la colonne trouvé : le motif de détection ne reconnaît plus rien",
    ).toBeGreaterThanOrEqual(3);
  });
});
