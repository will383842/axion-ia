/**
 * 🔴 `D3-3-05` — une Server Action que personne n'appelle est une fonctionnalité
 * qui n'existe pas.
 *
 * ## Le motif, rencontré sept fois dans cet audit
 *
 * *L'outil est écrit, le raccordement manque.* Colonnes `revokedAt` jamais
 * écrites · acte `valider_evaluation` jamais appelé · `AdminUndoToast` jamais
 * branché · `verifyQrToken` jamais appelé · en-tête `X-Invoice-R2-Signed-Url`
 * jamais lu · `Invoice.pdfUrl` sans lecteur · bouton d'autorisation de captation
 * absent alors que toute la chaîne existait.
 *
 * 🔴 Et une huitième fois, par moi : `revoquerSignatureEmargementAction` a été
 * écrite le 2026-08-20 — service, habilitation, tests, mutations vérifiées
 * rouges — sans **aucune** surface d'appel. Le seul fichier qui la nommait était
 * le test statique vérifiant qu'elle exige une habilitation. Une signature
 * apposée sur le mauvais nom restait donc définitive, faute d'écran.
 *
 * ⚠️ Ce défaut ne rougit nulle part : le code compile, les tests passent, la
 * couverture est bonne. Il ne se voit qu'en cherchant les APPELANTS — jamais en
 * relisant la définition.
 *
 * ## Ce que ce fichier garde, et comment
 *
 * Un CLIQUET, pas un idéal. Il fige la liste des fichiers d'actions actuellement
 * sans surface : aucun nouveau ne peut s'y ajouter en silence, et ceux qui y
 * sont restent NOMMÉS — une dette qu'on lit vaut mieux qu'une dette qu'on
 * ignore.
 *
 * 🔑 Le grain est le FICHIER, pas la fonction : une action peut légitimement
 * n'être appelée que par une autre action du même module (c'est le cas de
 * `revoquerSignatureEmargementAction`, appelée par sa variante formulaire). Ce
 * qui ne se défend pas, c'est un module d'actions dont AUCUNE n'atteint jamais
 * un écran.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const TEST = [".spec.ts", ".test.ts", ".spec.tsx", ".test.tsx"];

function estTest(nom: string): boolean {
  return TEST.some((s) => nom.endsWith(s));
}

/** Tous les `.ts`/`.tsx` sous un dossier, en relatif depuis `src/`. */
function fichiers(...segments: string[]): string[] {
  const racine = join(SRC, ...segments);
  const sortie: string[] = [];
  const pile = [racine];
  while (pile.length > 0) {
    const dossier = pile.pop();
    if (dossier === undefined) break;
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) pile.push(chemin);
      else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Les fichiers d'actions dont AUCUNE action n'est nommée par un écran.
 *
 * ⚠️ Dette CONSTATÉE le 2026-08-21, pas dette acceptée. Chacune de ces six
 * fonctionnalités est écrite et inatteignable : traduction et publication de
 * traduction d'image, relations entre fiches de connaissance, affectation d'un
 * relecteur, retour à une version antérieure, dépôt d'une pièce jointe.
 *
 * 🔑 Retirer une ligne d'ici quand on la raccorde. En AJOUTER une demande de
 * dire pourquoi une action nouvelle naît déjà sans écran.
 */
const SANS_SURFACE_CONNUS: ReadonlyArray<string> = [
  "server/actions/image-bank/publish.action.ts",
  "server/actions/image-bank/translate.action.ts",
  "server/actions/knowledge/add-relation.ts",
  "server/actions/knowledge/assign-reviewer.ts",
  "server/actions/knowledge/rollback-version.ts",
  "server/actions/knowledge/upload-asset.ts",
];

describe("`D3-3-05` — toute Server Action finit par atteindre un écran", () => {
  /**
   * Les identifiants nommés par une page ou un composant — COMMENTAIRES ÔTÉS.
   *
   * 🔴 Première version : elle tokenisait le fichier entier. La mutation qui
   * retirait l'appel de l'écran est passée **au vert** — l'en-tête de la page
   * CITE le nom de l'action pour expliquer le défaut qu'elle corrige, et cette
   * mention suffisait à la faire compter comme un usage.
   *
   * 🔑 Un test statique trouve ses propres commentaires. Une garde qui compte
   * une explication comme une preuve certifie l'intention, pas le câblage — et
   * c'est précisément ce qu'elle est censée démasquer.
   */
  const jetonsDesEcrans = new Set<string>();
  for (const groupe of [fichiers("app"), fichiers("components")]) {
    for (const f of groupe) {
      if (estTest(f)) continue;
      const code = readFileSync(f, "utf-8")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const m of code.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
        jetonsDesEcrans.add(m[0]);
      }
    }
  }

  /** Fichier d'actions → les `*Action` qu'il exporte. */
  const parFichier = new Map<string, string[]>();
  for (const f of fichiers("server", "actions")) {
    if (estTest(f)) continue;
    const noms = [
      ...readFileSync(f, "utf-8").matchAll(
        /^export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*Action)\b/gm,
      ),
    ].map((m) => m[1] as string);
    if (noms.length > 0) {
      parFichier.set(f.slice(SRC.length + 1).replace(/\\/g, "/"), noms);
    }
  }

  it("l'inventaire n'est pas vide", () => {
    // 🔑 Sans ce témoin, une expression régulière cassée viderait les deux
    // ensembles et tout ce fichier passerait au vert en ne vérifiant rien.
    expect(parFichier.size).toBeGreaterThan(50);
    expect(jetonsDesEcrans.size).toBeGreaterThan(1000);
    expect(jetonsDesEcrans.has("revoquerSignatureEmargementFormAction")).toBe(true);
  });

  it("🔴 aucun NOUVEAU module d'actions ne naît sans écran", () => {
    const sansSurface = [...parFichier.entries()]
      .filter(([, noms]) => !noms.some((n) => jetonsDesEcrans.has(n)))
      .map(([f]) => f)
      .sort();

    const nouveaux = sansSurface.filter((f) => !SANS_SURFACE_CONNUS.includes(f));
    expect(
      nouveaux,
      "ces modules d'actions n'atteignent aucun écran : la fonctionnalité est écrite et inatteignable",
    ).toEqual([]);
  });

  it("🔴 la dette constatée ne grandit pas, et les lignes soldées se retirent", () => {
    // ⚠️ Le contrôle marche DANS LES DEUX SENS. Sans le second, raccorder une
    // action laisserait sa ligne ici pour toujours, et la liste cesserait de
    // décrire quoi que ce soit — c'est ainsi qu'une liste d'exceptions devient
    // une liste qu'on ne relit plus.
    const sansSurface = new Set(
      [...parFichier.entries()]
        .filter(([, noms]) => !noms.some((n) => jetonsDesEcrans.has(n)))
        .map(([f]) => f),
    );
    const soldes = SANS_SURFACE_CONNUS.filter((f) => !sansSurface.has(f));
    expect(soldes, "ces modules ont désormais un écran : retirez-les de la liste").toEqual([]);
  });

  it("le témoin : la révocation d'émargement, elle, EST atteignable", () => {
    // 🔑 C'est le cas qui a motivé ce fichier. Avant le 2026-08-21,
    // `emargement-revocation.ts` figurait dans la liste des sans-surface : la
    // garde aurait rougi. Elle n'y est plus, et ce test le dit explicitement —
    // sinon rien ne distinguerait « corrigé » de « ajouté à la liste ».
    expect(SANS_SURFACE_CONNUS).not.toContain("server/actions/qualiopi/emargement-revocation.ts");
    const actions = parFichier.get("server/actions/qualiopi/emargement-revocation.ts");
    expect(actions, "le module d'actions a disparu ou changé de nom").toBeDefined();
    expect(actions?.some((n) => jetonsDesEcrans.has(n))).toBe(true);
  });
});
