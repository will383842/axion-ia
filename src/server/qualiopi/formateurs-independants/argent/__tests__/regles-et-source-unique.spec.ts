// @vitest-environment node

/**
 * L15b — règles annexes (dates, demi-journées prévues, mois payable, « sans écart »)
 * et SOURCE UNIQUE : aucun montant ni délai du paiement par mission n'est écrit
 * hors de `parametres.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  demiJourneesPrevues,
  demiJourneesSansSignature,
  demiJourneesSignees,
  parMoisCivil,
} from "@/server/qualiopi/remuneration/heures-animees";

import { moisPayable, releveSansEcart } from "../calcul-mission";
import {
  couleurVirement,
  dernierJourOuvreAuPlusTard,
  estJourCivil,
  jourDeColonneDate,
  jourParis,
} from "../dates";
import { PARAMETRES_ARGENT_FORMATEURS as P } from "../parametres";

const BORNES = { matinAvant: P.matinAvant, apresMidiApres: P.apresMidiApres };

describe("dates", () => {
  it("jours civils : valide seulement une vraie date", () => {
    expect(estJourCivil("2026-02-28")).toBe(true);
    expect(estJourCivil("2026-02-30")).toBe(false);
    expect(estJourCivil("2026-2-3")).toBe(false);
  });

  it("jour de Paris d'un instant, et d'une colonne @db.Date", () => {
    expect(jourParis(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
    expect(jourDeColonneDate(new Date("2026-11-05T00:00:00Z"))).toBe("2026-11-05");
  });

  it("dernier jour ouvré : lundi de Pâques 2027 (29/03, férié) → vendredi 26/03", () => {
    expect(dernierJourOuvreAuPlusTard("2027-03-29")).toBe("2027-03-26");
    expect(dernierJourOuvreAuPlusTard("2027-01-01")).toBe("2026-12-31");
    expect(dernierJourOuvreAuPlusTard("2026-12-04")).toBe("2026-12-04");
  });

  it("orange à J-5 de la date cible, rouge une fois passée", () => {
    expect(couleurVirement("2026-12-04", "2026-11-28")).toBe("a_venir");
    expect(couleurVirement("2026-12-04", "2026-11-29")).toBe("orange");
    expect(couleurVirement("2026-12-04", "2026-12-04")).toBe("orange");
    expect(couleurVirement("2026-12-04", "2026-12-05")).toBe("rouge");
  });
});

describe("demi-journées prévues et manquantes", () => {
  it("09:00–12:30 = matin ; 13:30–17:00 = après-midi ; 09:00–17:00 = deux", () => {
    const p = demiJourneesPrevues(
      [
        { jour: "2026-11-03", heureDebut: "09:00", heureFin: "12:30" },
        { jour: "2026-11-04", heureDebut: "13:30", heureFin: "17:00" },
        { jour: "2026-11-05", heureDebut: "09:00", heureFin: "17:00" },
      ],
      BORNES,
    );
    expect(p.map((d) => `${d.jour}:${d.creneau}`)).toEqual([
      "2026-11-03:matin",
      "2026-11-04:apres_midi",
      "2026-11-05:matin",
      "2026-11-05:apres_midi",
    ]);
  });

  it("une journée aux horaires incohérents compte une demi-journée, jamais zéro", () => {
    expect(
      demiJourneesPrevues([{ jour: "2026-11-03", heureDebut: "12:15", heureFin: "13:15" }], BORNES),
    ).toHaveLength(1);
  });

  it("manquantes = prévues sans signature ; mois payable seulement quand il n'en reste aucune", () => {
    const prevues = demiJourneesPrevues(
      [{ jour: "2026-11-05", heureDebut: "09:00", heureFin: "17:00" }],
      BORNES,
    );
    const signees = demiJourneesSignees([{ jour: "2026-11-05", demiJournee: "matin" }]);
    const manquantes = demiJourneesSansSignature(prevues, signees);
    expect(manquantes).toEqual([{ jour: "2026-11-05", creneau: "apres_midi" }]);
    expect(
      moisPayable({ prevues: 2, signees: 1, manquantes: 1, conditionFinanceurEnAttente: false }),
    ).toEqual({ payable: false, raison: "feuilles_incompletes", manquantes: 1 });
    expect(
      moisPayable({ prevues: 2, signees: 2, manquantes: 0, conditionFinanceurEnAttente: true })
        .raison,
    ).toBe("condition_financeur_en_attente");
    expect(
      moisPayable({ prevues: 2, signees: 0, manquantes: 2, conditionFinanceurEnAttente: false })
        .raison,
    ).toBe("aucune_signature");
    expect(
      moisPayable({ prevues: 2, signees: 2, manquantes: 0, conditionFinanceurEnAttente: false })
        .payable,
    ).toBe(true);
  });
});

describe("« sans écart » compare la PART DU MOIS, jamais la lettre entière", () => {
  const c = {
    tarifJourneeHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 12_000,
    regimeTva: "franchise_293b" as const,
  };

  it("novembre de S07 : 2 journées prévues, 2 signées → sans écart", () => {
    const [nov] = parMoisCivil(
      demiJourneesSignees([
        { jour: "2026-11-09", demiJournee: "journee" },
        { jour: "2026-11-23", demiJournee: "journee" },
      ]),
    );
    expect(releveSansEcart({ totalHtCents: 70_000 + 24_000 }, nov!, c)).toBe(true);
    expect(releveSansEcart({ totalHtCents: 70_000 }, nov!, c)).toBe(false);
  });
});

describe("source unique des montants", () => {
  it("aucun montant ni taux du contrat n'est écrit hors de parametres.ts", () => {
    const dossier = path.join(process.cwd(), "src/server/qualiopi/formateurs-independants/argent");
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".ts") && f !== "parametres.ts");
    expect(fichiers.length).toBeGreaterThan(1);
    for (const f of fichiers) {
      const code = readFileSync(path.join(dossier, f), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
        .join("\n");
      expect(code, f).not.toMatch(/\b(35_?000|17_?500|15_?000|4_?000|120_?000)\b/);
      expect(code, f).not.toMatch(/\b(72|48)\s*\*\s*3_?600_?000\b/);
    }
  });
});
