// @vitest-environment node

/**
 * ⛔ LE REJEU REPREND LES RÈGLES DE L'EFFACEMENT, IL NE LES RETAPE PAS
 * (chantier visio, PR 8 ; ADR 0056 ; runbook R33).
 *
 * `rejouerEffacements` refait, après une restauration, ce que l'art. 17
 * (`effacerCibleParAdresses`) et le pilote (`purgerPilote`) ont fait. S'il
 * recopie leurs données à la main, le jour où l'art. 17 vide un champ de plus
 * le rejeu ne le suit pas — et aucun test de comportement ne le voit, puisque
 * chacun ne regarde que les champs qu'il connaît.
 *
 * Cette garde lit la source : chaque donnée d'effacement et chaque règle ne
 * s'écrit qu'UNE fois dans `rgpd-erase.ts` (la constante ou la fonction
 * partagée), et le rejeu appelle les fonctions de l'effacement.
 *
 * Mutations qui font rougir : réécrire dans le rejeu
 * `{ nomAffiche: PERSONNE_EFFACEE, … }`, `{ texte: "", reponse: null }`,
 * `{ statut: "a_regenerer", contenu: "", … }`, un second `cote.every(…)`, ou
 * un `tx.fait.deleteMany` du pilote hors de `supprimerDonneesPilote`.
 * Contre-témoin : chaque motif est trouvé exactement une fois (0 voudrait dire
 * que la garde cherche un texte qui n'existe plus).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "..", "rgpd-erase.ts"), "utf8");

/** Corps d'une fonction exportée, de sa signature à la suivante. */
function corps(nom: string): string {
  const debut = source.indexOf(`export async function ${nom}(`);
  expect(debut, `fonction ${nom} introuvable`).toBeGreaterThan(-1);
  const suite = source.indexOf("\nexport ", debut + 1);
  return source.slice(debut, suite === -1 ? undefined : suite);
}

const compte = (texte: string, motif: RegExp): number =>
  (texte.match(new RegExp(motif.source, "g")) ?? []).length;

const UNE_SEULE_FOIS: ReadonlyArray<readonly [string, RegExp]> = [
  ["participation pseudonymisée", /nomAffiche:\s*PERSONNE_EFFACEE/],
  ["fiche pseudonymisée", /\bnom:\s*PERSONNE_EFFACEE/],
  ["compte rendu à régénérer", /contenu:\s*""/],
  ["case pré-remplie vidée", /valeurProposee:\s*""/],
  ["question vidée", /texte:\s*"",\s*reponse:\s*null/],
  ["règle « seule voix côté client »", /\.every\(/],
  ["suppression des faits du pilote", /\.fait\.deleteMany\(/],
  ["suppression des questionnaires du pilote", /\.questionnaireCadrage\.deleteMany\(/],
];

describe("le rejeu reprend les règles de l'effacement", () => {
  for (const [quoi, motif] of UNE_SEULE_FOIS) {
    it(`🔴 ${quoi} : écrit une seule fois dans rgpd-erase.ts`, () => {
      expect(compte(source, motif)).toBe(1);
    });
  }

  it("🔴 le rejeu appelle les fonctions de l'effacement art. 17 et du pilote", () => {
    const rejeu = corps("rejouerEffacements");
    for (const f of [
      "rencontresOuSeuleVoixClient(",
      "effacerCeQuiSuitLesPersonnes(",
      "pseudonymiserPersonnes(",
      "supprimerDonneesPilote(",
    ]) {
      expect(rejeu, f).toContain(f);
    }
  });

  it("🔴 l'effacement art. 17 et la purge du pilote appellent les mêmes fonctions", () => {
    const art17 = corps("effacerCibleParAdresses");
    expect(art17).toContain("rencontresOuSeuleVoixClient(");
    expect(art17).toContain("effacerCeQuiSuitLesPersonnes(");
    expect(art17).toContain("pseudonymiserPersonnes(");
    expect(corps("purgerPilote")).toContain("supprimerDonneesPilote(");
  });
});
