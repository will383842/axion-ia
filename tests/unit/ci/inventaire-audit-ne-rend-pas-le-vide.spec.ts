/**
 * CLIQUET — l'inventaire de l'audit ne doit pas pouvoir rendre le vide en
 * annonçant le succès.
 *
 * ## Ce que ce fichier garde, et pourquoi il existe
 *
 * 🔴 2026-08-24 — TROUVÉ EN AUDITANT L'AUDIT LUI-MÊME.
 *
 * `scripts/qualiopi/audit-inventory.mjs` se déclare, dans son propre en-tête,
 * « la source de vérité de ce qu'il y a à auditer ». Il dérive huit inventaires
 * et `PROGRESS.csv`, « le registre maître ». Trois mesures faites le 2026-08-24 :
 *
 *   1. il avalait ses propres pannes — un dossier illisible rendait
 *      l'accumulateur en l'état (`catch { return acc }`), un fichier manquant
 *      rendait une chaîne vide (`catch { return "" }`) ;
 *   2. l'écart sur les 32 indicateurs du RNQ n'était qu'un `console.log` ;
 *   3. il n'était appelé par AUCUN script npm et AUCUN workflow, et son dossier
 *      de sortie était un argument positionnel obligatoire — donc rien ne
 *      pouvait le rejouer.
 *
 * Résultat : sur un périmètre effondré, il produisait des inventaires vides et
 * sortait en **code 0**. Vérifié en le lançant depuis un dossier vide : avant
 * correctif, succès silencieux ; après, `exit 1` avec chaque cause nommée.
 *
 * 🔑 UN INVENTAIRE VIDE N'EST PAS « RIEN À AUDITER », C'EST « RIEN N'A ÉTÉ
 * MESURÉ ». Les deux se ressemblent exactement — et c'est la quatrième fois que
 * ce dépôt paie ce motif : 0 test sur 237 lus comme un vert, quatre specs de
 * console qui n'exécutaient aucune assertion, un cliquet de budgets aveugle à
 * deux de ses trois aides, et maintenant ceci.
 *
 * ⚠️ Ce cliquet est STATIQUE et ne lance pas le script : l'exécuter écrirait
 * neuf fichiers à chaque passage de la suite. Il vérifie que les trois éléments
 * qui rendent le script capable de rougir sont toujours en place. C'est étroit,
 * et c'est exact : on ne peut pas les retirer par inadvertance.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "qualiopi", "audit-inventory.mjs");
const PACKAGE = join(process.cwd(), "package.json");

const source = readFileSync(SCRIPT, "utf8");

describe("l'inventaire de l'audit ne rend pas le vide", () => {
  it("le script existe et est bien celui qu'on croit", () => {
    // Contre-témoin : un chemin périmé rendrait tous les tests suivants verts
    // sur un fichier jamais ouvert — la panne exacte qu'un autre cliquet de ce
    // dépôt a vécue en cherchant deux de ses trois aides au mauvais endroit.
    expect(
      source,
      "`audit-inventory.mjs` ne contient plus sa propre déclaration d'intention : " +
        "ce cliquet garde peut-être un autre fichier",
    ).toContain("source de vérité");
  });

  it("il SORT EN ERREUR quand son périmètre est effondré", () => {
    expect(
      source,
      "le bloc de verdict a disparu : le script peut de nouveau produire des " +
        "inventaires vides et se terminer sur un code 0. Un audit lancé sur cette " +
        "base croit avoir traversé un périmètre qu'il n'a pas vu.",
    ).toContain("process.exit(1)");

    for (const registre of ["illisibles", "absents", "invraisemblances"]) {
      expect(
        source,
        `le registre \`${registre}\` a disparu : les incidents de balayage ` +
          "redeviennent invisibles",
      ).toContain(registre);
    }
  });

  it("aucun `catch` ne redevient muet", () => {
    // Un `catch {` sans binding ne peut RIEN journaliser : c'est la forme exacte
    // qui a rendu ce script silencieux. On refuse la forme, pas le cas.
    const muets = source.split(/\r?\n/).filter((l) => /\}\s*catch\s*\{\s*$/.test(l));
    expect(
      muets,
      "`catch {` sans variable d'erreur : ce script ne peut alors ni nommer la " +
        "cause ni la compter, et son inventaire s'ampute en silence. Écrire " +
        "`catch (err)` et pousser l'incident dans `illisibles` ou `absents`.",
    ).toEqual([]);
  });

  it("l'invariant des 32 indicateurs RNQ est une FAUTE, pas un avertissement", () => {
    // Le référentiel national compte 32 indicateurs : ce n'est pas une
    // estimation. Un parseur qui en rend 7 fait compter une couverture d'audit
    // sur un dénominateur faux.
    expect(
      source,
      "l'écart sur les 32 indicateurs est redevenu un simple message : il ne " +
        "fait plus échouer le script, et une couverture d'audit peut se calculer " +
        "sur un dénominateur faux",
    ).toMatch(/invraisemblances\.push\([^)]*indicateurs/s);
  });

  it("il est BRANCHÉ — un script qu'on doit se souvenir de lancer ne tourne pas", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const appelants = Object.entries(scripts).filter(([, v]) =>
      String(v).includes("audit-inventory"),
    );
    expect(
      appelants.map(([k]) => k),
      "aucun script npm n'appelle `audit-inventory.mjs`. Au 2026-08-24 c'était le " +
        "cas, et la pièce maîtresse du dispositif Qualiopi ne tournait que si " +
        "quelqu'un se souvenait de la lancer à la main, avec le bon chemin en " +
        "argument. Un outil qu'il faut se rappeler d'utiliser ne tourne pas.",
    ).not.toEqual([]);
  });

  it("son dossier de sortie a un défaut — sans quoi il n'est pas appelable", () => {
    expect(
      source,
      "le dossier de sortie est redevenu un argument obligatoire : le script " +
        "n'est alors appelable ni par un script npm ni par un workflow, ce qui " +
        "est précisément la raison pour laquelle il ne tournait jamais",
    ).toMatch(/process\.argv\[2\]\s*\?\?/);
  });
});
