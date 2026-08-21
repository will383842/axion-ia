/**
 * 🔴 `CONF-01` — « une seule inscription touchée suffit pour douze ».
 *
 * La garde de clôture ne refusait que si **pas une seule** inscription ne
 * portait de trace de présence. Une sur douze suffisait donc à faire passer la
 * session en « réalisée » — et les onze autres pouvaient se voir délivrer une
 * attestation sans qu'aucune preuve n'existe à leur nom, **sans que rien ne le
 * dise**.
 *
 * ## Ce que ce fichier garde
 *
 * 1. la mesure exclut les `abandon` et `exclu` — renoncer n'est pas une absence
 *    de preuve, c'est une sortie du dispositif ;
 * 2. le refus ne tombe que sur l'absence TOTALE de trace — pas de durcissement
 *    déguisé ;
 * 3. le cas PARTIEL est reconnu comme tel, c'est lui qui déclenche l'alerte ;
 * 4. les deux prédicats sont MUTUELLEMENT EXCLUSIFS — sans quoi une session
 *    refusée lèverait aussi une alerte, ou l'inverse.
 *
 * ## Pourquoi le refus n'a PAS été durci
 *
 * Le durcissement « tous les inscrits doivent avoir une trace » a déjà été tenté
 * puis **retiré** dans ce dépôt : `emargementSigneAt` n'est posé que par la
 * grille présentielle, jamais par l'import distanciel ni par la correction
 * manuelle. Une session 100 % distancielle où personne ne se connecte devenait
 * DÉFINITIVEMENT non clôturable, ni automatiquement ni à la main, et alimentait
 * une alerte critique non résorbable.
 *
 * 🔑 *Un verrou sans porte de sortie est pire que le trou qu'il ferme.* Le trou
 * réel n'était pas l'absence de blocage — c'était le silence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { count: (a: unknown) => count(a) } },
}));

import {
  mesurerTraceCloture,
  clotureSansAucuneTrace,
  traceClotureIncomplete,
} from "./trace-cloture";

const SESSION = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
});

/** Premier appel = total actifs, second = ceux qui portent une trace. */
function repond(totalActifs: number, avecTrace: number): void {
  count.mockResolvedValueOnce(totalActifs).mockResolvedValueOnce(avecTrace);
}

describe("mesurerTraceCloture", () => {
  it("🔴 EXCLUT les abandons et les exclus des deux comptages", async () => {
    // Les compter faussait le dénominateur dans les deux sens : une session où
    // trois personnes ont renoncé paraissait incomplète, et le ratio servait à
    // décider d'une clôture.
    repond(0, 0);
    await mesurerTraceCloture(SESSION);

    expect(count).toHaveBeenCalledTimes(2);
    for (const appel of count.mock.calls) {
      const where = (appel[0] as { where: Record<string, unknown> }).where;
      expect(where["statut"]).toEqual({ notIn: ["abandon", "exclu"] });
    }
  });

  it("compte comme « sans trace » la différence entre actifs et tracés", async () => {
    repond(12, 1);
    const trace = await mesurerTraceCloture(SESSION);
    expect(trace).toEqual({ totalActifs: 12, sansTrace: 11 });
  });

  it("reconnaît une trace via le taux de présence, pas seulement l'émargement", async () => {
    // Le distanciel ne pose PAS `emargementSigneAt`. Ne regarder que cette
    // colonne rendrait toute session distancielle non clôturable — c'est
    // exactement le durcissement qui a dû être retiré.
    repond(3, 3);
    await mesurerTraceCloture(SESSION);

    const where = (count.mock.calls[1]?.[0] as { where: Record<string, unknown> }).where;
    expect(JSON.stringify(where["OR"])).toContain("tauxPresencePct");
    expect(JSON.stringify(where["OR"])).toContain("emargementSigneAt");
  });
});

describe("clotureSansAucuneTrace — le REFUS", () => {
  it("refuse quand aucune inscription active ne porte de trace", () => {
    expect(clotureSansAucuneTrace({ totalActifs: 12, sansTrace: 12 })).toBe(true);
  });

  it("🔴 NE refuse PAS sur une absence partielle — pas de durcissement déguisé", () => {
    // Le cœur de l'arbitrage : 1 trace sur 12 laisse passer la clôture. C'est
    // délibéré, et documenté dans `trace-cloture.ts`.
    expect(clotureSansAucuneTrace({ totalActifs: 12, sansTrace: 11 })).toBe(false);
  });

  it("ne refuse pas une session sans aucun inscrit actif", () => {
    // Sinon une session dont tout le monde a renoncé deviendrait non clôturable.
    expect(clotureSansAucuneTrace({ totalActifs: 0, sansTrace: 0 })).toBe(false);
  });
});

describe("traceClotureIncomplete — le SIGNAL", () => {
  it("🔴 signale le cas de `CONF-01` : 1 sur 12", () => {
    expect(traceClotureIncomplete({ totalActifs: 12, sansTrace: 11 })).toBe(true);
  });

  it("ne signale rien quand tout le monde est tracé", () => {
    expect(traceClotureIncomplete({ totalActifs: 12, sansTrace: 0 })).toBe(false);
  });

  it("🔴 les deux prédicats sont MUTUELLEMENT EXCLUSIFS", () => {
    // Sans cela, une session refusée lèverait AUSSI une alerte — donc une
    // alerte sur une clôture qui n'a pas eu lieu. Le témoin vaut pour toute la
    // plage, pas pour un cas choisi.
    for (let total = 0; total <= 12; total++) {
      for (let sans = 0; sans <= total; sans++) {
        const t = { totalActifs: total, sansTrace: sans };
        expect(
          clotureSansAucuneTrace(t) && traceClotureIncomplete(t),
          `chevauchement à ${sans}/${total}`,
        ).toBe(false);
      }
    }
  });
});
