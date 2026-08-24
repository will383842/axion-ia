/**
 * CLIQUET — aucune pièce remise n'affirme un DPO que le site déclare inexistant.
 *
 * ## Le défaut (2026-08-24, cahier D9)
 *
 * Le site énonce une position juridique claire, et il l'explique :
 *
 *     « Aucun délégué à la protection des données (DPO) n'est désigné, sa
 *       désignation n'étant pas obligatoire au regard de l'activité. »
 *
 * Deux gabarits PDF **remis au stagiaire** disaient le contraire :
 *
 *   · le règlement intérieur — « ces droits s'exercent auprès du **délégué à la
 *     protection des données (DPO) de l'organisme** » ;
 *   · le livret d'accueil — un champ intitulé « Exercice de vos droits (DPO) ».
 *
 * Les deux imprimaient en réalité `dpoEmail || email`, c'est-à-dire l'adresse de
 * contact générique. La fonction était juste ; **seule l'étiquette mentait**.
 *
 * ⚠️ Et le mensonge est asymétrique : une personne à qui l'on annonce un DPO
 * peut légitimement lui écrire, exiger de lui l'indépendance et les missions de
 * l'art. 39 RGPD, ou reprocher son absence à la CNIL. Le corriger n'est pas un
 * choix éditorial — c'est le retrait d'une affirmation fausse.
 *
 * ## Ce que ce fichier garde, et comment
 *
 * 🔑 **La règle est DÉRIVÉE, pas recopiée.** On ne fige pas « il n'y a pas de
 * DPO » : on lit la déclaration publique et on exige que les pièces s'y
 * conforment. Le jour où un DPO sera réellement désigné, il suffira de changer
 * `content/legal.ts` — ce cliquet cessera alors d'interdire la mention, au lieu
 * de rougir à tort.
 *
 * Ce dépôt a déjà payé quatre fois qu'une liste ou un prédicat recopié prenne du
 * retard sur la source qu'il prétend refléter.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src", "server", "qualiopi", "documents", "templates");
const LEGAL = readFileSync(join(process.cwd(), "src", "content", "legal.ts"), "utf8");

/** La position publique de l'organisme, lue à la source et jamais recopiée. */
function unDpoEstDesigne(): boolean {
  return !/Aucun délégué à la protection des données/.test(LEGAL);
}

/** Les gabarits de pièces effectivement remises (hors specs). */
function gabarits(): string[] {
  return readdirSync(RACINE)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".spec."))
    .sort();
}

/** Le texte imprimé — commentaires exclus : documenter n'est pas affirmer. */
function texteImprime(fichier: string): string {
  return readFileSync(join(RACINE, fichier), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

describe("aucune pièce remise n'affirme un DPO inexistant", () => {
  it("la déclaration publique est bien lisible — sinon ce cliquet garde du vide", () => {
    // Contre-témoin. Si la phrase disparaissait de `legal.ts` (réécriture,
    // renommage), `unDpoEstDesigne()` rendrait `true` en silence et le test
    // suivant passerait au vert en n'exigeant plus rien.
    expect(
      LEGAL,
      "la position du site sur le DPO n'est plus lisible dans `content/legal.ts` : " +
        "ce cliquet ne peut plus rien dériver. Vérifier la formulation, ou " +
        "l'adapter ici SI ET SEULEMENT SI la position a réellement changé.",
    ).toMatch(/délégué à la protection des données/);
  });

  it("le balayage trouve bien des gabarits", () => {
    // Second contre-témoin : un dossier renommé rendrait la boucle sans objet.
    expect(
      gabarits().length,
      "aucun gabarit trouvé : le chemin des templates a changé, et la garde ne " +
        "regarde plus rien.",
    ).toBeGreaterThanOrEqual(5);
  });

  it("aucun gabarit n'annonce un DPO tant que le site dit qu'il n'y en a pas", () => {
    if (unDpoEstDesigne()) {
      // Un DPO A été désigné entre-temps : la mention redevient exacte, et
      // l'interdire serait le défaut inverse. Le cliquet se retire de lui-même.
      return;
    }

    const menteurs = gabarits().filter((f) => /DPO|délégué à la protection/.test(texteImprime(f)));

    expect(
      menteurs,
      "gabarit(s) remis au stagiaire annonçant un délégué à la protection des " +
        "données, alors que le site déclare qu'aucun n'est désigné. La personne " +
        "à qui on l'annonce peut lui écrire, exiger de lui les missions de " +
        "l'art. 39 RGPD, ou reprocher son absence à la CNIL. Écrire « auprès de " +
        "l'organisme » et garder l'adresse de contact — la fonction est la même, " +
        "l'affirmation disparaît. Si un DPO a VRAIMENT été désigné, corriger " +
        "`content/legal.ts` d'abord : ce test suivra tout seul.",
    ).toEqual([]);
  });
});
