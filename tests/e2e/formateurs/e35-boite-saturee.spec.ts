// @formateurs E35 — Boîte saturée : relances en file, puis une demande de code
// F17 et un lien de connexion. F17 et la connexion passent les premiers ; au
// plus 30 relances par passage.
//
// ÉCARTS de dimension, imposés par le banc (le code de main fait foi) :
//   · le worker d'e-mails est bridé à 40 envois/heure et PARTAGÉ par tous les
//     specs du job : 40 vraies relances l'épuiseraient pour une heure. L'ordre
//     est donc prouvé par la vraie file avec 3 relances ; le plafond de 30, par
//     le vrai passage des campagnes sur 40 fiches dues, dont seul l'envoi final
//     est relevé au lieu d'être enfilé ;
//   · F17 est scellé avec la clé PII : celle du job est fictive et non conforme,
//     le worker ne pourrait pas l'ouvrir. Le scénario reçoit une clé FICTIVE
//     conforme pour son seul processus, constate que F17 attend dans la voie
//     sans priorité (celle du lien de connexion, servie avant toute relance),
//     puis le retire de la file avant de la relâcher.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

/** Clé FICTIVE (64 caractères hexadécimaux), propre au processus du scénario. */
const CLE_PII_FICTIVE = "b".repeat(64);

interface Prise {
  template: string;
  status: string;
  prisA: number | null;
  priorite: number;
}
interface Observations {
  a: {
    adresse: string;
    f17: { ok: boolean };
    connexion: { ok: boolean };
    files: { attente: string[]; prioritaires: string[] };
    prises: Prise[];
  };
  b: {
    bilan: {
      campagnesActives: number;
      envoyes: number;
      plafondAtteint: boolean;
      ecartes: Record<string, number>;
    };
    envois: number;
    priorites: number[];
    gabarits: string[];
    destinatairesDistincts: number;
  };
  prioriteRelance: number;
}

test.describe("@formateurs E35 — boîte saturée", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    o = await executerScenarioSecurite<Observations>(
      "e35-boite-saturee",
      {},
      { PII_ENCRYPTION_KEY: CLE_PII_FICTIVE },
    );
  });

  test.afterAll(async () => {
    if (o) await viderPuitsPour(o.a.adresse);
    await prisma.$disconnect();
  });

  test("F17 et la connexion attendent dans la voie sans priorité ; les relances, derrière", () => {
    expect(o.a.f17).toEqual({ ok: true });
    expect(o.a.connexion.ok).toBe(true);
    expect(o.a.files.attente).toEqual(["formateur-code-signature", "formateur-magic-link"]);
    expect(o.a.files.prioritaires).toEqual([
      "formateur-dossier-relance",
      "formateur-dossier-relance",
      "formateur-dossier-relance",
    ]);
    expect(o.prioriteRelance).toBeGreaterThan(0);
  });

  test("relâchée, la file sert la connexion avant toute relance", () => {
    const connexion = o.a.prises.find((p) => p.template === "formateur-magic-link");
    const relances = o.a.prises.filter((p) => p.template === "formateur-dossier-relance");
    expect(connexion?.status).toBe("sent");
    expect(connexion?.priorite).toBe(0);
    expect(relances).toHaveLength(3);
    for (const r of relances) {
      expect(r.priorite).toBe(o.prioriteRelance);
      expect(r.prisA ?? 0).toBeGreaterThanOrEqual(connexion?.prisA ?? Number.MAX_SAFE_INTEGER);
    }
  });

  test("40 relances dues : 30 au plus par passage, une par personne, en priorité basse", () => {
    expect(o.b.bilan).toMatchObject({ campagnesActives: 1, envoyes: 30, plafondAtteint: true });
    expect(o.b.bilan.ecartes["plafond-du-passage"]).toBe(10);
    expect(o.b.envois).toBe(30);
    expect(o.b.destinatairesDistincts).toBe(30);
    expect(o.b.gabarits).toEqual(["formateur-dossier-relance"]);
    expect(o.b.priorites).toEqual([o.prioriteRelance]);
  });
});
