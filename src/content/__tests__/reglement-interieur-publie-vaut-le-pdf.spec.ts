/**
 * CLIQUET — le règlement intérieur PUBLIÉ ne peut pas être moins protecteur que
 * celui qu'on remet au stagiaire.
 *
 * ## Le défaut (2026-08-24, cahier D9)
 *
 * 🔴 La page publique annonçait l'**exclusion définitive** du stagiaire — la
 * sanction la plus lourde — **sans aucune des garanties que le code du travail
 * impose** : ni échelle des sanctions, ni convocation à un entretien, ni droit
 * de se faire assister, ni délai, ni motivation écrite.
 *
 * Mesuré **sur le site en ligne**, pas seulement dans le code :
 * « exclusion définitive » = 1 occurrence · « sanction » = 0 · « droits de la
 * défense » = 0 · art. R.6352 = 0.
 *
 * 🔑 **Et le texte conforme existait déjà, rédigé**, dans le gabarit PDF remis
 * au stagiaire (`documents/templates/reglement-interieur.tsx`, « Article 3
 * bis »). Le commentaire du gabarit décrivait même le défaut et le déclarait
 * corrigé — **la correction n'avait été appliquée qu'à une des deux versions.**
 *
 * C'est la forme récurrente de ce dépôt : *une règle écrite et justifiée à un
 * endroit, appliquée à un site, oubliée sur son jumeau.*
 *
 * ## Pourquoi c'est la page PUBLIQUE qui compte
 *
 * ⚠️ **Le critère 1 du RNQ porte sur l'information du public.** Le
 * certificateur lira la page, pas le PDF d'un dossier particulier. Un règlement
 * publié non conforme aux art. R.6352-3 à -8 rend la sanction **inopposable au
 * stagiaire** — et se voit au premier coup d'œil.
 *
 * ## Ce que ce fichier garde
 *
 * Que les deux versions ne divergent plus. On ne compare pas les textes mot à
 * mot — ils n'ont pas le même format, l'un est du JSX, l'autre une chaîne. On
 * exige que **les mêmes garanties légales soient nommées des deux côtés** :
 * chaque article du code du travail cité dans le gabarit doit l'être aussi dans
 * la page.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(join(process.cwd(), "src", "content", "legal.ts"), "utf8");
const GABARIT = readFileSync(
  join(
    process.cwd(),
    "src",
    "server",
    "qualiopi",
    "documents",
    "templates",
    "reglement-interieur.tsx",
  ),
  "utf8",
);

/**
 * Les articles du code du travail RÉELLEMENT CITÉS par un texte, dédupliqués.
 *
 * ⚠️ Analyse LIGNE PAR LIGNE, en écartant les commentaires — et c'est un
 * correctif. La première version lisait aussi l'en-tête du gabarit, qui décrit
 * une PLAGE (« R6352-1 à R6352-15 ») : elle en tirait deux citations qui
 * n'existent nulle part dans le texte rendu, et accusait la page publique de
 * les avoir omises. Une garde qui rougit pour la mauvaise raison coûte autant
 * qu'une garde qui ne rougit pas.
 *
 * C'est la troisième fois le 2026-08-24 qu'un extracteur se fait piéger par un
 * commentaire. Le remède est toujours le même : ne jamais retirer les
 * commentaires en bloc (l'appariement se déphase), écarter les LIGNES de
 * commentaire.
 */
function articlesCites(source: string): string[] {
  const utiles = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
  return [
    ...new Set([...utiles.matchAll(/R\.?6352-(\d+)/g)].map((m) => `R6352-${m[1] ?? ""}`)),
  ].sort();
}

describe("le règlement intérieur publié vaut celui qu'on remet", () => {
  it("le gabarit PDF cite bien des articles — sinon ce cliquet compare deux vides", () => {
    // Contre-témoin. Si le motif cassait, ou si le gabarit perdait ses
    // citations, le test suivant passerait au vert en n'exigeant plus rien de
    // la page publique. C'est la panne que ce dépôt a payée cinq fois.
    expect(
      articlesCites(GABARIT).length,
      "le gabarit PDF du règlement intérieur ne cite plus aucun article R.6352 : " +
        "soit il a perdu sa procédure disciplinaire, soit le motif de ce cliquet " +
        "ne reconnaît plus rien. Dans les deux cas, il ne garde plus rien.",
    ).toBeGreaterThanOrEqual(3);
  });

  it("la page publique cite TOUS les articles que le PDF cite", () => {
    // 🔑 Le cœur du cliquet. On n'exige pas une copie mot à mot — on exige que
    // la personne qui lit la page publique connaisse les mêmes garanties que
    // celle qui reçoit le PDF.
    const duPdf = articlesCites(GABARIT);
    const deLaPage = new Set(articlesCites(PAGE));
    const manquants = duPdf.filter((a) => !deLaPage.has(a));

    expect(
      manquants,
      "article(s) du code du travail cité(s) dans le PDF remis au stagiaire mais " +
        "ABSENT(S) de la page publique. C'est le défaut du 2026-08-24 : la page " +
        "annonçait l'exclusion définitive sans les droits de la défense, alors que " +
        "le PDF les contenait déjà. ⚠️ Le critère 1 du RNQ porte sur l'INFORMATION " +
        "DU PUBLIC — c'est cette page que le certificateur lira. Reporter le texte " +
        "du gabarit, verbatim.",
    ).toEqual([]);
  });

  it("la page publique nomme la procédure, pas seulement les articles", () => {
    // Citer « R6352-4 » sans dire ce qu'il protège serait conforme à la lettre
    // et inutile au lecteur. On exige les notions, en clair.
    const notions = [
      { mot: /entretien/i, quoi: "la convocation à un entretien" },
      { mot: /assister/i, quoi: "le droit de se faire assister" },
      { mot: /motiv/i, quoi: "la motivation écrite de la sanction" },
    ];
    const absentes = notions.filter((n) => !n.mot.test(PAGE)).map((n) => n.quoi);

    expect(
      absentes,
      "garantie(s) de procédure absente(s) du texte publié. Les citer par leur " +
        "numéro d'article sans les expliquer serait conforme à la lettre et " +
        "inutile à la personne qui lit.",
    ).toEqual([]);
  });
});
