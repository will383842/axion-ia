/**
 * ⛔ LES PISTES SONT ENTRELACÉES PAR L'HORODATAGE (plan §3.12).
 *
 * Les deux pistes sont transcrites séparément, tranche par tranche (tout le
 * client, puis tout Williams). Le dialogue envoyé à P1 les remet dans l'ordre
 * du TEMPS : sans cela, les réponses du client précéderaient les questions
 * et G3 (confirmation dans les 90 s) n'aurait aucun sens. Les identifiants
 * `S0001…` suivent cet ordre ; `AXION` pour Williams, `CLIENT_n` par voix.
 * Et la transcription d'une tranche est décalée de son début de capture.
 *
 * Mutation qui rougit : trier par `ordre` (l'ordre d'écriture) au lieu de
 * `debutMs` dans `entrelacer` → le client répond avant la question.
 * Contre-témoin : à égalité d'horodatage, Williams passe d'abord. Angle mort :
 * l'horloge de capture des deux pistes est la même machine ; un décalage du
 * micro de quelques centaines de ms n'est pas corrigé.
 */

import { describe, expect, it } from "vitest";

import { entrelacer, horodatage } from "../dialogue";
import { seg } from "./outils-pipeline";

describe("les pistes sont entrelacées par l'horodatage", () => {
  // Écrits dans l'ordre des tranches : toute la piste client, puis toute la piste axion.
  const ecrits = [
    seg({ piste: "client", debutMs: 6_000, ordre: 1, texte: "Nous serions douze." }),
    seg({
      piste: "client",
      debutMs: 200_000,
      ordre: 2,
      locuteurBrut: "B",
      texte: "Et moi je décide.",
    }),
    seg({ piste: "axion", debutMs: 2_000, ordre: 10_000_001, texte: "Combien êtes-vous ?" }),
    seg({ piste: "axion", debutMs: 200_000, ordre: 10_000_002, texte: "Qui décide ?" }),
  ];

  it("l'ordre du temps, des identifiants S0001… dans cet ordre, les étiquettes de voix", () => {
    const d = entrelacer(ecrits);
    expect(d.segments.map((s) => [s.id, s.etiquette, s.texte])).toEqual([
      ["S0001", "AXION", "Combien êtes-vous ?"],
      ["S0002", "CLIENT_1", "Nous serions douze."],
      ["S0003", "AXION", "Qui décide ?"],
      ["S0004", "CLIENT_2", "Et moi je décide."],
    ]);
    expect(d.texte.split("\n")[1]).toBe("[S0002 00:00:06 CLIENT_1] Nous serions douze.");
    expect(d.voixClient).toEqual(["A", "B"]);
  });

  it("contre-témoin : à égalité, Williams d'abord ; l'horodatage s'écrit hh:mm:ss", () => {
    expect(entrelacer(ecrits).segments[2]!.piste).toBe("axion");
    expect(horodatage(3_725_000)).toBe("01:02:05");
  });
});
