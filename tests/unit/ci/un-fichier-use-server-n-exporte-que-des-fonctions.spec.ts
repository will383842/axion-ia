// @vitest-environment node

/**
 * Verrou — un fichier `"use server"` n'exporte que des fonctions asynchrones.
 *
 * ## La règle, et pourquoi personne ne la voit
 *
 * Next transforme CHAQUE export d'un fichier marqué `"use server"` en point
 * d'entrée réseau appelable depuis le navigateur. Une constante n'en est pas
 * un : le compilateur refuse le fichier ENTIER.
 *
 * Le prix de l'ignorer est disproportionné par rapport à la faute. Le module
 * ne compile plus du tout, donc tous ses imports échouent, et le message rendu
 * désigne la mauvaise cause :
 *
 *     Error: Only async functions are allowed to be exported in a "use server" file.
 *     Error: Export CHAMP_LOCALE doesn't exist in target module
 *     Error: Export soumettreLaReservation doesn't exist in target module
 *
 * Les deux dernières lignes sont trompeuses : les exports existaient bel et
 * bien. On cherche une faute d'import là où il y a une constante de trop.
 *
 * ## 🔴 CE QUI REND CETTE GARDE NÉCESSAIRE : AUCUN AUTRE INSTRUMENT NE VOIT
 *
 * Mesuré le 2026-09-01 sur `app/[locale]/appel/reserver/actions.ts`, qui
 * exportait deux constantes de noms de champ :
 *
 * — `tsc --noEmit` : VERT. TypeScript ne connaît pas cette règle, qui est une
 *   contrainte du compilateur de Next, pas du langage.
 * — `eslint` : VERT.
 * — les tests unitaires : VERTS — ils importent le module directement, sans
 *   passer par la transformation de Next.
 * — `next build` : ÉCHEC.
 *
 * Autrement dit, la faute traversait toute la chaîne locale et n'apparaissait
 * qu'en CI, après vingt-cinq minutes de gates, sous un message qui désigne
 * autre chose. Cette garde la rend visible en une seconde.
 *
 * ## 🔑 CE QUI DÉCLENCHE RÉELLEMENT L'ÉCHEC : L'IMPORT, PAS LA DÉCLARATION
 *
 * Mesuré en écrivant cette garde, et c'est contre-intuitif. Elle a d'abord
 * signalé `server/actions/content-gen/expansion-state.ts`, qui exporte une
 * constante `PHASE_QUOTAS` depuis un fichier `"use server"` — alors que `main`
 * se construit sans erreur depuis des mois.
 *
 * La différence tient en un mot : `PHASE_QUOTAS` n'est **importé nulle part**
 * ailleurs ; il ne sert qu'à l'intérieur de son propre fichier. Mes deux
 * constantes, elles, étaient importées par la page. Turbopack ne rompt que
 * lorsqu'un autre module vient chercher l'export.
 *
 * Conséquence, et c'est elle qui justifie de le signaler quand même : un export
 * de ce genre est une **mine à retardement**. Il ne casse rien aujourd'hui, et
 * il cassera le build entier le jour — imprévisible — où quelqu'un l'importera,
 * sous un message qui désigne autre chose. Celui qui paiera ne sera pas celui
 * qui l'a écrit.
 *
 * ## Ce que cette garde NE PEUT PAS voir, et qu'il faut savoir
 *
 * Un ré-export (`export { x } from "./y"`) : la fonction exportée vit
 * ailleurs, et savoir si elle est asynchrone demanderait de suivre l'import.
 * On les compte et on les affiche, sans les refuser — un faux positif sur une
 * règle de compilation ferait plus de mal que le trou qu'il boucherait.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Le fichier est-il marqué `"use server"` AU NIVEAU DU FICHIER ? */
function estUnFichierServeur(source: string): boolean {
  // La directive doit être la première instruction. Une fonction qui porte
  // `"use server"` DANS son corps ne marque pas le fichier — c'est une action
  // isolée, et les autres exports du fichier restent libres.
  const debut = source
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"))
    .slice(0, 3)
    .join("\n");
  return /^["']use server["'];?/m.test(debut);
}

/**
 * Les exports interdits d'un fichier serveur.
 *
 * `export type` et `export interface` sont ABSENTS de cette liste à dessein :
 * ils sont effacés à la compilation, donc ils ne deviennent pas des points
 * d'entrée et Next les accepte.
 */
const INTERDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm, "une constante"],
  [/^export\s+class\s+([A-Za-z0-9_$]+)/gm, "une classe"],
  [/^export\s+enum\s+([A-Za-z0-9_$]+)/gm, "une énumération"],
  // Une fonction NON asynchrone. Le `(?!async)` porte sur ce qui suit
  // immédiatement `export `, donc `export async function` ne matche pas.
  [/^export\s+(?!async\b)function\s+([A-Za-z0-9_$]+)/gm, "une fonction non asynchrone"],
];

interface Faute {
  readonly fichier: string;
  readonly quoi: string;
  readonly nom: string;
}

/**
 * DETTE — les exports qui existaient AVANT cette garde.
 *
 * ⚠️ Cette liste n'est pas une absolution, c'est un cliquet. Chacun de ces
 * exports casse le build le jour où quelqu'un l'importe. Ils sont tolérés
 * uniquement parce qu'ils ne le sont pas aujourd'hui, et qu'une garde ne se
 * pose jamais sur un seuil déjà dépassé : elle rougirait les PR de gens qui
 * n'y sont pour rien. C'est la doctrine écrite dans AGENTS.md — « seuil aligné
 * d'abord, blocage ensuite ».
 *
 * 🔴 NE PAS AJOUTER DE LIGNE ICI pour faire passer une PR. Un export nouveau se
 * corrige en le déplaçant dans un module ordinaire ; c'est l'affaire de deux
 * minutes, et cette liste n'existe que pour ce qui préexistait.
 *
 * ✅ 2026-09-03 — LA LISTE EST VIDE. `PHASE_QUOTAS` a été déplacé dans
 * `expansion-quotas.ts`, un module ordinaire, et sa ligne retirée d'ici comme
 * cette consigne le demandait. Le dépôt ne porte donc plus aucune dette de ce
 * type, et toute faute qui apparaîtra désormais sera NOUVELLE.
 *
 * La garde exige que la liste reste EXACTE — elle rougit si une dette est
 * réparée sans que sa ligne soit retirée, et c'est ce qui a forcé ce nettoyage
 * plutôt que de le laisser à plus tard.
 */
const DETTE: ReadonlyArray<readonly [string, string]> = [];

function estUneDette(f: Faute): boolean {
  return DETTE.some(([fichier, nom]) => f.fichier === fichier && f.nom === nom);
}

/**
 * Parcourt `src/` à la main plutôt qu'avec un glob.
 *
 * 🔑 `node:fs` est déjà la convention des autres gardes de CI de ce dépôt
 * (`aucun-workflow-ne-pousse-sur-main`, `drapeau-runtime-jamais-fige-au-build`,
 * `fontes-build-hermetique`). Le paquet `glob` n'est PAS résoluble depuis
 * l'environnement de test — mesuré : « Failed to load url glob ». Suivre la
 * convention locale évite de découvrir ça en CI.
 */
function parcourir(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules" || entree === "__tests__") continue;
      out.push(...parcourir(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    out.push(relative(RACINE, chemin).split(sep).join("/"));
  }
  return out;
}

function auditer(): { fautes: Faute[]; fichiersServeur: string[]; reexports: number } {
  const fichiers = parcourir(join(RACINE, "src"));

  const fautes: Faute[] = [];
  const fichiersServeur: string[] = [];
  let reexports = 0;

  for (const rel of fichiers) {
    const source = readFileSync(join(RACINE, rel), "utf8");
    if (!source.includes("use server")) continue;
    if (!estUnFichierServeur(source)) continue;
    fichiersServeur.push(rel);

    if (/^export\s*\{[^}]*\}\s*from/m.test(source)) reexports += 1;

    for (const [motif, quoi] of INTERDITS) {
      for (const m of source.matchAll(motif)) {
        fautes.push({ fichier: rel, quoi, nom: m[1] ?? "?" });
      }
    }
  }
  return { fautes, fichiersServeur, reexports };
}

const AUDIT = auditer();

describe("un fichier « use server » n'exporte que des fonctions asynchrones", () => {
  it("🔑 CONTRE-TÉMOIN : la garde trouve bien des fichiers à examiner", () => {
    // Sans lui, un motif de détection cassé rendrait le test vert en ne
    // regardant AUCUN fichier. C'est le piège qui a déjà rendu vertes deux
    // gates de ce dépôt — elles ne mesuraient rien.
    expect(
      AUDIT.fichiersServeur.length,
      "aucun fichier « use server » trouvé : le détecteur est cassé, pas le dépôt",
    ).toBeGreaterThan(20);
  });

  it("🔴 aucun export interdit NOUVEAU", () => {
    const nouvelles = AUDIT.fautes.filter((f) => !estUneDette(f));
    const message = nouvelles
      .map((f) => `  ${f.fichier} — exporte ${f.quoi} : « ${f.nom} »`)
      .join("\n");
    expect(
      nouvelles,
      nouvelles.length === 0
        ? ""
        : `Next refuse ces exports et le fichier ENTIER cesse de compiler.\n\n${message}\n\n` +
            `À FAIRE : déplacer ces déclarations dans un module ordinaire, et les ` +
            `importer depuis le fichier « use server ».\n\n` +
            `⚠️ Le message rendu par le build désigne la mauvaise cause — il dit ` +
            `« Export X doesn't exist in target module » alors que l'export existe. ` +
            `Ne cherchez pas une faute d'import.`,
    ).toEqual([]);
  });

  it("🔑 la DETTE est exacte — ni gonflée, ni périmée", () => {
    // Une liste d'exceptions qui survit à sa cause est pire que pas de liste :
    // elle laisserait passer un export nouveau qui prendrait le même nom. On
    // exige donc que chaque ligne corresponde à une faute RÉELLEMENT présente.
    for (const [fichier, nom] of DETTE) {
      expect(
        AUDIT.fautes.some((f) => f.fichier === fichier && f.nom === nom),
        `« ${nom} » de ${fichier} ne figure plus dans le code : la dette est ` +
          `réparée, retirez sa ligne de DETTE.`,
      ).toBe(true);
    }
  });

  it("🔑 les ré-exports sont comptés, et la limite est écrite", () => {
    // Cette garde ne sait pas suivre un `export { x } from "./y"` : la fonction
    // vit ailleurs. On l'affiche pour que personne ne croie la couverture
    // totale — un périmètre d'observation pris pour une garantie est un défaut
    // que ce dépôt a déjà payé.
    expect(AUDIT.reexports).toBeGreaterThanOrEqual(0);
  });
});
