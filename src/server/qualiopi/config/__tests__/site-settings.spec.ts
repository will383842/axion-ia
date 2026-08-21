/**
 * `getQualiopiConfig` ne doit pas jeter une valeur EXISTANTE en silence.
 *
 * 🔴 Constaté le 2026-08-21 en lançant `pnpm e2e:qualiopi`, la vérification de
 * bout en bout de la chaîne documentaire — qui n'avait aucun appelant et n'avait
 * donc pas tourné depuis longtemps. Elle mourait à l'étape facture sur
 * « identité de l'organisme incomplète (champ(s) manquant(s) : SIRET) », alors
 * que le script AVAIT semé un SIRET.
 *
 * L'enchaînement : le script écrivait `qualiopi.siret = "SIRET-TEST-PLACEHOLDER"`.
 * Le 2026-08-17, le registre a durci ce champ — 14 chiffres, clé de Luhn. La
 * valeur est donc stockée sans broncher, puis **écartée à la lecture** par un
 * `safeParse` qui retombe sur le défaut vide **sans un mot**. Trois étapes plus
 * loin, le message d'erreur parle d'un champ « manquant » — c'est-à-dire
 * exactement ce qu'il n'était pas : il était REFUSÉ.
 *
 * 🔑 Une valeur absente et une valeur refusée ne se diagnostiquent pas pareil.
 * Les confondre coûte le temps de chercher une saisie qui a déjà été faite.
 *
 * Le chemin d'écriture de la console valide déjà (`setQualiopiConfig` lève) :
 * ce cas ne peut venir que d'une écriture hors console, ou d'une valeur écrite
 * AVANT que le schéma ne soit durci. Le second cas est silencieux et rétroactif
 * — c'est celui qui justifie cette garde.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findUnique: vi.fn() } },
}));

// `site-settings.ts` importe le journal d'activité pour son chemin d'ÉCRITURE.
// On ne teste que la lecture, mais l'import tire next-auth, qui ne se résout pas
// sous l'environnement node de Vitest. Le mock coupe la chaîne sans rien masquer
// de ce qui est testé ici.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "../site-settings";

const findUnique = prisma.siteSetting.findUnique as unknown as ReturnType<typeof vi.fn>;

describe("getQualiopiConfig — une valeur refusée doit s'entendre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("avertit quand la ligne existe mais ne passe pas son schéma", async () => {
    const avertissements: string[] = [];
    const espion = vi
      .spyOn(console, "warn")
      .mockImplementation((...args: unknown[]) => void avertissements.push(args.join(" ")));

    findUnique.mockResolvedValue({ key: "qualiopi.siret", value: "SIRET-TEST-PLACEHOLDER" });
    const valeur = await getQualiopiConfig("siret");

    espion.mockRestore();

    expect(valeur, "une valeur refusée doit retomber sur le défaut").toBe("");
    expect(
      avertissements.join("\n"),
      "La valeur est en base et elle est jetée sans trace. C'est ce silence qui a fait " +
        "chercher une saisie manquante là où la saisie existait et était refusée.",
    ).toContain("qualiopi.siret");
  });

  it("ne dit rien quand la ligne est absente — l'absence n'est pas une anomalie", async () => {
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});

    findUnique.mockResolvedValue(null);
    const valeur = await getQualiopiConfig("siret");
    const appels = espion.mock.calls.length;
    espion.mockRestore();

    expect(valeur).toBe("");
    expect(appels, "Avertir sur chaque clé non renseignée noierait le seul cas qui compte.").toBe(
      0,
    );
  });

  it("ne dit rien quand la valeur est valide", async () => {
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 14 chiffres, clé de Luhn satisfaite (somme nulle), attribuable à personne.
    findUnique.mockResolvedValue({ key: "qualiopi.siret", value: "00000000000000" });
    const valeur = await getQualiopiConfig("siret");
    const appels = espion.mock.calls.length;
    espion.mockRestore();

    expect(valeur).toBe("00000000000000");
    expect(appels).toBe(0);
  });
});
