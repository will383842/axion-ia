/**
 * CLIQUET — une primitive livrée sans appelant est une capacité qui n'existe pas.
 *
 * ## Le défaut mesuré (2026-09-06)
 *
 * Sept primitives de `components/admin/ui/` ont **zéro appelant** dans toute la
 * console. Elles viennent des PR 4 et 12 de l'ADR 0028 (« polish UX »), livrées
 * d'avance et jamais câblées :
 *
 *   AdminAutosaveIndicator · AdminConflictDialog · AdminFilterChip
 *   AdminInlineEdit · AdminKeyboardHint · AdminShortcutListener · AdminUndoToast
 *
 * 🔑 **Le coût n'est pas le code mort, c'est la PROMESSE.** `docs/admin-design-system.md`
 * les annonçait comme livrées ; un auteur qui lit l'inventaire croit la capacité
 * disponible, ne la trouve pas branchée, et réécrit à la main. C'est
 * exactement ce qu'on observe ailleurs dans la console : 51 tableaux écrits à la
 * main pendant que `<AdminTable>` existe, et `window.confirm()` dans 7 fichiers
 * pendant que `<AdminConfirmDialog>` existe.
 *
 * ⚠️ **`AdminConflictDialog` mérite une mention à part.** C'est la mitigation
 * §3.7 du master prompt : « Will ouvre la même fiche dans deux onglets et édite
 * dans les deux ; sans protection, le dernier écrit gagne. » Le composant est
 * écrit, testé, et **branché nulle part** — donc le scénario n'est pas couvert.
 * Ce n'est pas du code mort décoratif, c'est une protection qu'on croit avoir.
 *
 * ## Ce que ce fichier verrouille
 *
 * La liste ci-dessous ne peut que DIMINUER. Une primitive nouvelle livrée sans
 * appelant échoue ; une primitive enfin câblée doit sortir d'ici. Le test ne
 * demande PAS de supprimer les sept — les supprimer ou les brancher est un
 * arbitrage ouvert — il demande seulement que personne n'en ajoute une huitième
 * sans le dire.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const UI = join(RACINE, "src", "components", "admin", "ui");
const ZONES = [
  join(RACINE, "src", "app", "[locale]", "(admin)"),
  join(RACINE, "src", "components", "admin"),
];

/**
 * Les sept primitives sans appelant au 2026-09-06.
 *
 * CETTE LISTE NE DOIT QUE DIMINUER. Retirer une entrée quand la primitive est
 * enfin utilisée — ou quand elle est supprimée du dépôt.
 */
const SANS_APPELANT_CONNUES: readonly string[] = [
  "AdminAutosaveIndicator",
  "AdminConflictDialog",
  "AdminFilterChip",
  "AdminInlineEdit",
  "AdminKeyboardHint",
  "AdminShortcutListener",
  "AdminUndoToast",
];

/** Tous les fichiers `.tsx` de production sous une zone. */
function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    if (entree === "__tests__") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (entree.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(entree)) acc.push(chemin);
  }
  return acc;
}

/** Les composants exportés par le dossier des primitives, un par fichier. */
function primitives(): string[] {
  return readdirSync(UI)
    .filter((f) => /^Admin[A-Za-z]+\.tsx$/.test(f))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
}

/** Nombre de fichiers de la console qui NOMMENT cette primitive, hors sa propre définition. */
function appelants(nom: string, corpus: { chemin: string; src: string }[]): number {
  const motif = new RegExp(`\\b${nom}\\b`);
  return corpus.filter((f) => !f.chemin.endsWith(`${sep}${nom}.tsx`) && motif.test(f.src)).length;
}

describe("aucune primitive n'est livrée sans appelant", () => {
  const corpus = ZONES.flatMap((z) => fichiers(z)).map((chemin) => ({
    chemin,
    src: readFileSync(chemin, "utf8"),
  }));
  const noms = primitives();

  it("🔑 CONTRE-TÉMOIN : le balayage voit réellement des appelants", () => {
    // Sans ceci, un corpus vide rendrait « tout est sans appelant » ou
    // « rien ne l'est » selon le sens du test, et les deux passeraient pour
    // une mesure. On exige qu'une primitive massivement utilisée le soit.
    expect(corpus.length, "le corpus de la console est vide").toBeGreaterThan(300);
    expect(noms.length, "aucune primitive trouvée dans components/admin/ui").toBeGreaterThan(20);
    expect(
      appelants("AdminPageShell", corpus),
      "`AdminPageShell` devrait avoir des centaines d'appelants — si le compte est bas, " +
        "c'est le balayage qui est cassé, pas la console qui a changé",
    ).toBeGreaterThan(100);
  });

  it("aucune primitive NOUVELLE n'arrive sans appelant", () => {
    const orphelines = noms.filter(
      (n) => appelants(n, corpus) === 0 && !SANS_APPELANT_CONNUES.includes(n),
    );
    expect(
      orphelines,
      "🔴 Une primitive est livrée sans qu'aucun écran ne l'utilise.\n" +
        "\n" +
        "   Un composant que rien n'appelle n'est pas une capacité disponible :\n" +
        "   c'est une promesse. L'inventaire du design system l'annonce, un auteur\n" +
        "   la croit là, ne la trouve pas branchée, et réécrit à la main.\n" +
        "\n" +
        "   Remède : la brancher dans la PR qui la livre. Une primitive se justifie\n" +
        "   par l'écran qu'elle sert, pas par l'anticipation d'un écran futur.",
    ).toEqual([]);
  });

  it("le cliquet ne garde aucune entrée périmée", () => {
    const branchees = SANS_APPELANT_CONNUES.filter((n) => appelants(n, corpus) > 0);
    expect(
      branchees,
      "🟢 Ces primitives sont désormais utilisées : retirez-les de SANS_APPELANT_CONNUES.\n" +
        "\n" +
        "   Un cliquet qui garde ses entrées résolues surestime la dette, et la\n" +
        "   prochaine régression se glisse dans une ligne que plus personne ne relit.",
    ).toEqual([]);
  });

  it("les primitives listées existent encore", () => {
    const disparues = SANS_APPELANT_CONNUES.filter((n) => !noms.includes(n));
    expect(
      disparues,
      "Ces primitives ont été supprimées du dépôt : retirez-les aussi de la liste.",
    ).toEqual([]);
  });
});
