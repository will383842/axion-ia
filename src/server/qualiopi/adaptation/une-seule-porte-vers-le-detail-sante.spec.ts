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

/**
 * Chaque mention de la colonne dans un fichier, avec ce qui la précède et ce
 * qui la suit — c'est le contexte qui dit s'il s'agit d'une lecture, d'une
 * écriture, ou d'une forme que cette garde ne sait pas juger.
 *
 * ⚠️ On énumère TOUTES les mentions, pas seulement `COLONNE:`. Une première
 * version ne cherchait que le deux-points, et **quatre formes d'écriture
 * passaient invisibles** : le raccourci d'objet (`{ handicapDetailsChiffre }`,
 * la forme idiomatique dès que la variable porte le nom de la colonne), la clé
 * calculée sous ses deux formes, et le SQL brut. Le fichier n'était même pas
 * compté comme écrivain. Une garde doit échouer FERMÉ sur ce qu'elle ne
 * comprend pas, jamais l'ignorer.
 */
function mentions(contenu: string): { avant: string; apres: string }[] {
  const trouvees: { avant: string; apres: string }[] = [];
  const motif = new RegExp(`${COLONNE}`, "g");
  let m: RegExpExecArray | null;
  while ((m = motif.exec(contenu)) !== null) {
    const debutLigne = contenu.lastIndexOf("\n", m.index) + 1;
    const debut = contenu.slice(debutLigne, m.index);
    // Prose : la colonne est abondamment citée dans les commentaires et les
    // docblocks de ce dépôt. Une ligne de commentaire n'écrit rien.
    if (/\/\//.test(debut) || /^\s*\*/.test(debut)) continue;

    trouvees.push({
      avant: contenu.slice(Math.max(0, m.index - 2), m.index),
      apres: contenu.slice(m.index + COLONNE.length, m.index + COLONNE.length + 80),
    });
  }
  return trouvees;
}

/** Les fichiers de production qui MENTIONNENT la colonne. */
function fichiersQuiMentionnentLaColonne(): { chemin: string; contenu: string }[] {
  return fichiersSource(RACINE)
    .map((chemin) => ({ chemin, contenu: readFileSync(chemin, "utf8") }))
    .filter(({ contenu }) => contenu.includes(COLONNE));
}

/**
 * La variable écrite a-t-elle été produite par la garde — directement, ou par
 * un producteur intermédiaire qui passe LUI AUSSI par la porte ?
 *
 * ⚠️ Faire confiance à un producteur par son NOM ne suffit pas : si ce
 * producteur cessait un jour de passer par la garde, l'écriture resterait verte
 * — précisément la classe de défaut que cette garde existe pour fermer. On va
 * donc lire le corps du producteur.
 */
function produitParLaGarde(contenu: string, variable: string): boolean {
  // ⚠️ TOUTES les déclarations de ce nom, et toutes doivent tenir. Ne regarder
  // que la première laissait passer un homonyme : deux fonctions d'un même
  // fichier nomment volontiers pareil la variable qu'elles écrivent, et la
  // déclaration saine de l'une validait l'écriture douteuse de l'autre.
  const declarations = [
    ...contenu.matchAll(new RegExp(`(?:const|let|var)\\s+${variable}\\b([^;]*);`, "gs")),
  ];
  if (declarations.length === 0) return false;

  return declarations.every((declaration) => {
    const expression = declaration[1] ?? "";
    if (expression.includes("chiffrerDetailSante")) return true;

    // Producteur intermédiaire : il doit LUI AUSSI passer par la porte. Lui
    // faire confiance sur son NOM rouvrirait le trou le jour où il cesserait
    // de la franchir.
    return (expression.match(/\b[A-Za-z_$][\w$]*\s*\(/g) ?? []).some((appel) => {
      const nom = appel.replace(/\s*\($/, "");
      const corps = new RegExp(`function\\s+${nom}\\s*\\([\\s\\S]*?\\n\\}`, "").exec(contenu);
      return corps !== null && corps[0].includes("chiffrerDetailSante(");
    });
  });
}

/**
 * Classe chaque mention de la colonne. Rend les violations ET le nombre
 * d'écritures réellement jugées — c'est ce second chiffre qui empêche le
 * témoin positif d'attester d'une surface qu'il ne garde pas.
 */
function violationsDeLaPorte(): { violations: string[]; ecrituresJugees: number } {
  const violations: string[] = [];
  let ecrituresJugees = 0;

  for (const { chemin, contenu } of fichiersQuiMentionnentLaColonne()) {
    const court = chemin.replace(RACINE, "src");

    for (const { avant, apres } of mentions(contenu)) {
      // Lecture par propriété : `trainee.handicapDetailsChiffre`.
      if (avant.endsWith(".")) continue;
      // Mention en PROSE : le dépôt cite toujours la colonne entre accents
      // graves dans les commentaires et les docblocks. Le code, jamais.
      if (apres.startsWith("`")) continue;

      const valeurBrute = apres.trimStart();
      if (!valeurBrute.startsWith(":")) {
        // Raccourci d'objet, clé calculée, SQL brut… : formes que cette garde
        // ne sait pas juger. Elle échoue FERMÉ plutôt que de les ignorer.
        violations.push(
          `${court} — forme d'écriture non reconnue près de « ${apres.slice(0, 40)} »`,
        );
        continue;
      }

      const valeur = (valeurBrute.slice(1).split(/[,\n}]/)[0] ?? "").trim();

      // Lecture (`select`/`where`) ou effacement art. 17 : rien à chiffrer.
      if (/^(true|false|null|\{)/.test(valeur)) continue;

      ecrituresJugees += 1;

      // Une expression en ligne — un appel, un accès, un littéral — n'est
      // jamais acceptable : la valeur doit venir d'une variable produite par la
      // garde, dont le type `string | null` force l'appelant à trancher.
      if (!/^[A-Za-z_$][\w$]*$/.test(valeur)) {
        violations.push(`${court} — écriture en ligne : \`${valeur}\``);
        continue;
      }

      if (!produitParLaGarde(contenu, valeur)) {
        violations.push(`${court} — \`${valeur}\` ne vient pas de la garde`);
      }
    }
  }

  return { violations, ecrituresJugees };
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

  it("🔴 CHAQUE mention de la colonne est une lecture, ou une écriture issue de la garde", () => {
    // ⚠️ Vérifier que le FICHIER importe la garde ne suffit pas : un second
    // chemin d'écriture ajouté dans un fichier déjà gardé passerait au vert.
    // C'est précisément l'erreur d'origine — une protection présente à côté
    // d'une écriture qui ne s'en sert pas.
    expect(violationsDeLaPorte().violations).toEqual([]);
  });

  it("🔑 témoin positif : la garde inspecte réellement, et JUGE réellement", () => {
    // Sans ce cas, un chemin de racine faux rendrait zéro fichier — et le cas
    // ci-dessus passerait au vert en ne gardant rien (#1104 : une garde qui
    // comptait 4 `..` au lieu de 5 rendait zéro module, et elle était verte).
    expect(fichiersSource(RACINE).length, "la racine `src` n'a pas été trouvée").toBeGreaterThan(
      1_000,
    );

    // ⚠️ Compter des FICHIERS ne suffit pas : l'un d'eux n'écrit que `null`
    // (effacement art. 17) et ne fait franchir aucune décision à la garde. Ce
    // témoin compte les ÉCRITURES réellement jugées.
    const { ecrituresJugees } = violationsDeLaPorte();
    expect(
      ecrituresJugees,
      "aucune écriture jugée : le motif de détection ne reconnaît plus rien",
    ).toBeGreaterThanOrEqual(3);
  });
});
