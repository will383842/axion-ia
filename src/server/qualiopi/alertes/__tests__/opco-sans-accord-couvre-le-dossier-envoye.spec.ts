/**
 * 🛑 GARDE — « sans accord OPCO » couvre AUSSI le dossier parti sans réponse.
 *
 * ## Le défaut que cette garde ferme (M8)
 *
 * L'alerte s'intitule « **Session dans 7 jours sans accord OPCO** ». Elle ne
 * regardait que `opcoStatut: "non_demande"` : un dossier **envoyé et resté sans
 * réponse** (`demande_en_cours`) passait sous le radar — et c'est le cas le plus
 * fréquent, les OPCO répondant rarement en une semaine.
 *
 * 🔴 Conséquence exacte de M8 : le système **refuse** de démarrer sans accord,
 * mais ne **prévenait pas** qu'il allait refuser. La surprise tombait le matin
 * de la formation.
 *
 * ## 🔑 Ce qui aurait dû le faire voir plus tôt
 *
 * La règle **JUMELLE**, dix lignes plus bas dans le même fichier — « formation
 * démarrée sans accord » — couvrait DÉJÀ
 * `["non_demande", "demande_en_cours"]`. Les deux règles parlent du même manque
 * à deux moments, et une seule des deux le reconnaissait.
 *
 * C'est le motif du **jumeau oublié**, et il se détecte en comparant les deux
 * filtres, pas en relisant l'un des deux.
 *
 * ## Ce que cette garde vérifie
 *
 * Que les deux règles restent d'accord sur ce qu'est « sans accord ». Si l'une
 * évolue, l'autre doit suivre — ou la divergence doit être écrite ici.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const EVALUATEUR = "src/server/qualiopi/alertes/evaluateur.ts";

/** Les statuts OPCO que chaque filtre `opcoStatut` de R13 accepte. */
function filtresOpcoDeR13(): string[][] {
  const source = readFileSync(join(process.cwd(), EVALUATEUR), "utf8");
  const debut = source.indexOf("R13 — OPCO sans accord J-7");
  expect(debut, "le bloc R13 a disparu : cette garde ne mesure plus rien").toBeGreaterThan(0);
  // On s'arrête à la règle suivante pour ne pas ramasser des filtres étrangers.
  const suite = source.indexOf("/** R1", debut + 10);
  const bloc = source.slice(debut, suite > 0 ? suite : debut + 6000);

  return [...bloc.matchAll(/opcoStatut:\s*(?:\{\s*in:\s*)?\[?([^\]}\n]+)\]?/g)].map((m) =>
    m[1]!
      .split(",")
      .map((x) => x.trim().replace(/^["']|["'],?$/g, ""))
      .filter((x) => /^[a-z_]+$/.test(x))
      .sort(),
  );
}

describe("🛑 « sans accord OPCO » veut dire la même chose aux deux moments", () => {
  it("🔑 les deux filtres de R13 sont bien LUS", () => {
    const filtres = filtresOpcoDeR13();
    // Deux règles : celle de J-7 et celle de la formation démarrée. Si l'on
    // n'en extrait qu'une, la comparaison ci-dessous compare une chose à
    // elle-même — verte, et vide de sens.
    expect(
      filtres.length,
      `${filtres.length} filtre(s) opcoStatut extrait(s) de R13, 2 attendus`,
    ).toBe(2);
    for (const f of filtres) {
      expect(f.length, "un filtre extrait est vide").toBeGreaterThan(0);
    }
  });

  it("la règle J-7 couvre le dossier ENVOYÉ, comme sa jumelle", () => {
    const [j7, demarree] = filtresOpcoDeR13();
    expect(
      j7,
      "L'alerte J-7 et l'alerte « formation démarrée » ne s'accordent plus sur " +
        "ce qu'est « sans accord ». Un dossier parti sans réponse repasserait " +
        "sous le radar, et la surprise retomberait le matin de la formation.",
    ).toEqual(demarree);
    expect(
      j7,
      "`demande_en_cours` — le dossier envoyé, sans réponse — doit être couvert : " +
        "c'est le cas le plus fréquent, et celui que M8 décrit.",
    ).toContain("demande_en_cours");
  });
});
