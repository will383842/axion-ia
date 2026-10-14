/**
 * Étape 4 — l'écart « payé ≠ annoncé » se compare au montant de la LETTRE
 * SIGNÉE quand elle existe (sa part du mois, rangée à l'émission), et non à un
 * prévu recalculé sur les journées d'aujourd'hui.
 */

import { describe, expect, it } from "vitest";

import { annonceDuMois, anomaliesFaceALaLettre, type AnomalieMission } from "../anomalies-mission";

const ECART_PREVU: AnomalieMission = {
  code: "ecart_prevu",
  detail: "prévu 35000 c HT, calculé 17500 c HT",
  constateLe: "2026-11-10",
};
const COMPLEMENT: AnomalieMission = {
  code: "complement_signe",
  detail: "3 demi-journée(s) signée(s), 2 payée(s)",
  constateLe: "2026-11-12",
};
const META = { annonceLettre: { totalHtCents: 70_000, parMois: { "2026-11": 52_500 } } };

describe("annonceDuMois — lecture tolérante des métadonnées de la lettre", () => {
  it("rend la part du mois, ou null (v1, mois absent, forme inattendue)", () => {
    expect(annonceDuMois(META, "2026-11")).toBe(52_500);
    expect(annonceDuMois(META, "2026-12")).toBeNull();
    expect(annonceDuMois({ empreinteMission: "x" }, "2026-11")).toBeNull();
    expect(annonceDuMois(null, "2026-11")).toBeNull();
    expect(annonceDuMois({ annonceLettre: { parMois: { "2026-11": 1.5 } } }, "2026-11")).toBeNull();
  });
});

describe("anomaliesFaceALaLettre", () => {
  it("sans lettre signée : les anomalies conservées, inchangées", () => {
    expect(anomaliesFaceALaLettre([ECART_PREVU, COMPLEMENT], null, 17_500, "2026-11-15")).toEqual([
      ECART_PREVU,
      COMPLEMENT,
    ]);
  });

  it("lettre signée, payé = annoncé : l'écart au prévu recalculé s'efface", () => {
    expect(anomaliesFaceALaLettre([ECART_PREVU, COMPLEMENT], 52_500, 52_500, "2026-11-15")).toEqual(
      [COMPLEMENT],
    );
  });

  it("lettre signée, payé ≠ annoncé : l'écart se dit en centimes face à la lettre", () => {
    expect(anomaliesFaceALaLettre([], 52_500, 35_000, "2026-11-15")).toEqual([
      {
        code: "ecart_lettre",
        detail: "annoncé 52500 c HT par la lettre signée, calculé 35000 c HT",
        constateLe: "2026-11-15",
      },
    ]);
  });
});
