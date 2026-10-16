// @formateurs V2-A6 — NUMÉRO D'AUTOFACTURE sous course : deux émissions simultanées.
//
// Trois processus distincts (trois connexions à la base, comme le bouton, la validation et
// le rattrapage horaire) émettent EN MÊME TEMPS : deux relevés de deux formateurs, et le
// premier relevé une seconde fois. La série AXI-AUTOF est une série légale : jamais deux
// pièces sous le même numéro, jamais deux numéros pour la même pièce, pas de trou.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouerUne } from "../fixtures/formateurs/argent-execution";
import { factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

interface Emission {
  valide: boolean;
  emission: { data?: { numero: string }; error?: string; code?: string };
}

/** Le rang d'un numéro dans sa série (« AXI-AUTOF-2026-012 » → 12). */
const rang = (numero: string) => Number(numero.split("-").at(-1));

test.describe("@formateurs V2-A6 — numéro d'autofacture sous course", () => {
  test.setTimeout(900_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("deux émissions simultanées : deux numéros distincts et consécutifs ; un relevé, un numéro", async () => {
    await avecVerrouArgent(async () => {
      const un = await factureDeMissionEmise({
        prenom: "Numa",
        jours: ["2041-02-05", "2041-02-06"],
        emettre: false,
      });
      const deux = await factureDeMissionEmise({
        prenom: "Nadege",
        jours: ["2041-02-12", "2041-02-13"],
        emettre: false,
      });
      const [a, b, bis] = await Promise.all([
        jouerUne<Emission>({ etape: "valider-et-emettre", statementId: un.statementId }),
        jouerUne<Emission>({ etape: "valider-et-emettre", statementId: deux.statementId }),
        jouerUne<Emission>({ etape: "valider-et-emettre", statementId: un.statementId }),
      ]);
      // Le relevé émis deux fois : une seule pièce ; l'autre émetteur le constate.
      const emisUn = [a, bis].filter((e) => e.emission.data !== undefined);
      expect(emisUn).toHaveLength(1);
      expect([a, bis].filter((e) => e.valide)).toHaveLength(1);
      expect(b.emission.data?.numero).toMatch(/\S/);

      const pieces = await prisma.trainerStatement.findMany({
        where: { id: { in: [un.statementId, deux.statementId] } },
        select: { id: true, statut: true, numeroFacture: true },
      });
      const numeros = pieces.map((p) => p.numeroFacture!);
      expect(numeros.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
      expect(new Set(numeros).size).toBe(2);
      expect(Math.abs(rang(numeros[0]!) - rang(numeros[1]!))).toBe(1);
      expect(pieces.every((p) => p.statut === "facture_recue")).toBe(true);
      // Aucun autre relevé de la base ne porte l'un de ces numéros.
      for (const n of numeros) {
        expect(await prisma.trainerStatement.count({ where: { numeroFacture: n } })).toBe(1);
      }
    });
  });
});
