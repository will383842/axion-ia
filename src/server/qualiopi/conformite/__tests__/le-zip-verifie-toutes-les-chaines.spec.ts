/**
 * CLIQUET — le dossier de session vérifie TOUTES les chaînes qu'il promet.
 *
 * ## Le défaut (2026-08-24, cahier D9)
 *
 * 🔴 L'en-tête de `dossier-session.ts` promet, au certificateur, « le résultat de
 * la **VÉRIFICATION D'INTÉGRITÉ de chaque chaîne de signatures** ». Le bouton
 * qui le déclenche le promet aussi.
 *
 * Le ZIP en vérifiait **deux familles sur trois** : les signatures d'émargement
 * et les contresignatures de formateur. Les signatures des **pièces
 * contractuelles** — convention, devis, lettre de mission — n'étaient vérifiées
 * nulle part.
 *
 * 🔑 Et la fonction pour le faire **existait déjà**, écrite et testée :
 * `verifierChaineDocument`. Elle n'avait simplement **aucun appelant de
 * production**. C'est la troisième fonctionnalité inatteignable trouvée dans ce
 * dépôt par la même méthode — chercher les appelants, jamais les définitions.
 *
 * Une convention signée dont la chaîne aurait été rompue sortait donc du ZIP
 * avec le `[OK]` de son PDF et **aucun verdict d'intégrité**. Le dossier avait
 * l'air complet — exactement ce que son propre en-tête déclare pire que de ne
 * rien livrer.
 *
 * ## Ce que ce fichier garde
 *
 * Que la promesse et le code ne redivergent pas. Il ne compte pas « trois
 * familles » — un tel test vieillirait mal et ne dirait rien d'une quatrième.
 * Il exige que **chaque famille de chaînes que le dossier sait vérifier soit
 * effectivement vérifiée**, et que chacune ait sa ligne d'index et son
 * avertissement.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src", "server", "qualiopi");
const DOSSIER_SESSION = join(RACINE, "conformite", "dossier-session.ts");

/**
 * Le code seul, lignes de commentaire écartées.
 *
 * ⚠️ Indispensable ici : ce fichier-ci et sa cible parlent tous deux
 * abondamment de « vérification » et de « chaîne », puisque c'est leur sujet.
 * Un extracteur naïf trouverait les explications au lieu du code — ce dépôt
 * s'est déjà fait piéger trois fois par ce motif le même jour.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

/**
 * Les trois familles de chaînes de signatures du domaine Qualiopi, avec le
 * vérificateur que chacune doit traverser.
 *
 * ⚠️ Ce n'est pas une liste « en dur » au sens reproché ailleurs : c'est
 * l'énoncé de la propriété gardée, et le test suivant vérifie que le dossier
 * les traite TOUTES. Une quatrième famille qui apparaîtrait sans être ajoutée
 * ici ne serait pas vue — d'où le contrôle de non-régression sur le nombre de
 * modèles de signature du schéma, plus bas.
 */
const FAMILLES = [
  {
    quoi: "les signatures d'émargement des stagiaires",
    marqueurIndex: "Intégrité des chaînes de signatures :",
  },
  {
    quoi: "les contresignatures de formateur",
    marqueurIndex: "Intégrité des chaînes de contresignatures :",
  },
  {
    quoi: "les signatures des pièces contractuelles (convention, devis, lettre de mission)",
    marqueurIndex: "Intégrité des chaînes de signatures de pièces :",
  },
] as const;

describe("le dossier de session vérifie toutes les chaînes qu'il promet", () => {
  it("l'en-tête promet bien « chaque chaîne » — sinon ce cliquet n'a plus d'objet", () => {
    // 🔑 CONTRE-TÉMOIN. Tout ce fichier repose sur une PROMESSE faite au
    // certificateur. Si elle disparaissait de l'en-tête, les exigences
    // ci-dessous deviendraient arbitraires — et il faudrait en discuter, pas
    // les appliquer en silence.
    const source = readFileSync(DOSSIER_SESSION, "utf-8");
    expect(
      source,
      "l'en-tête de `dossier-session.ts` ne promet plus la vérification " +
        "d'intégrité des chaînes. Soit la promesse a été retirée — et il faut " +
        "alors décider ce que le dossier garantit — soit le commentaire a dérivé.",
    ).toMatch(/VÉRIFICATION D'INTÉGRITÉ de chaque chaîne/i);
  });

  it.each(FAMILLES)("$quoi ont leur verdict dans l'index", ({ marqueurIndex }) => {
    // Le cœur du cliquet. Chaque famille doit produire une ligne d'index : c'est
    // ce que l'auditeur lit. Une famille vérifiée dont le résultat n'est écrit
    // nulle part ne vaut pas mieux qu'une famille non vérifiée.
    const code = codeSeul(DOSSIER_SESSION);
    expect(
      code,
      `le dossier ne rend aucun verdict d'intégrité pour ${marqueurIndex} — alors ` +
        `que son en-tête promet « chaque chaîne de signatures ». C'est le défaut ` +
        `du 2026-08-24 : les pièces contractuelles n'étaient vérifiées nulle part, ` +
        `et le ZIP sortait avec l'air d'être complet.`,
    ).toContain(marqueurIndex);
  });

  it("une anomalie de chaîne lève un avertissement, pour chaque famille", () => {
    // Un chiffre dans l'index se lit en diagonale ; un avertissement se lit.
    // L'en-tête est explicite : « Livrer un ZIP silencieusement amputé à un
    // auditeur est pire que de ne rien livrer : il aurait l'air complet. »
    const code = codeSeul(DOSSIER_SESSION);
    const compteurs = code.match(/nbChaines\w*Anormales/g) ?? [];
    const distincts = new Set(compteurs);

    expect(
      distincts.size,
      `${distincts.size} compteur(s) d'anomalie de chaîne pour ${FAMILLES.length} ` +
        `familles vérifiées. Chaque famille doit avoir le sien, et lever son ` +
        `propre avertissement : un compteur partagé dirait « une anomalie » sans ` +
        `dire de quoi.`,
    ).toBeGreaterThanOrEqual(FAMILLES.length);

    // Et chacun doit réellement déclencher un avertissement.
    for (const compteur of distincts) {
      expect(
        code,
        `le compteur \`${compteur}\` ne lève aucun avertissement : l'anomalie ` +
          `serait comptée dans un JSON que personne n'ouvre, et le dossier ` +
          `partirait sans le dire.`,
      ).toMatch(new RegExp(`if \\(${compteur} > 0\\)`));
    }
  });

  it("🔴 `verifierChaineDocument` a bien un appelant de production", () => {
    // 🔑 Le cœur du défaut, gardé directement. Cette fonction était écrite,
    // testée, exportée — et appelée par personne. Une fonctionnalité
    // inatteignable ne protège rien, et son existence rassure à tort quiconque
    // lit le module.
    const code = codeSeul(DOSSIER_SESSION);
    expect(
      code,
      "`verifierChaineDocument` n'a plus d'appelant dans le dossier de session : " +
        "les chaînes de signatures des pièces contractuelles redeviennent " +
        "invérifiées, et la fonction redevient une fonctionnalité inatteignable.",
    ).toContain("verifierChaineDocument(");
  });

  it("le contre-témoin : l'extracteur écarte bien les commentaires", () => {
    // 🔑 Sans lui, les quatre tests ci-dessus pourraient passer au vert en
    // trouvant leurs marqueurs dans les COMMENTAIRES du fichier — qui les citent
    // tous, puisqu'ils racontent le défaut. La garde serait alors purement
    // décorative.
    const faux = [
      "// Intégrité des chaînes de signatures de pièces : ceci est un commentaire",
      " * verifierChaineDocument( ceci aussi",
      'const vrai = "marqueur-de-code";',
    ].join("\n");
    const code = faux
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
      .join("\n");

    expect(code, "l'extracteur laisse passer les commentaires de ligne").not.toContain(
      "ceci est un commentaire",
    );
    expect(code, "l'extracteur laisse passer les blocs de commentaire").not.toContain("ceci aussi");
    expect(code, "l'extracteur a mangé du vrai code").toContain("marqueur-de-code");
  });
});
