// @vitest-environment node
//
// S2c — une cible d'ESSAI (`test = true`) n'est connue QUE lorsque l'adresse e-mail est connue ET figure
// dans GUIDES_RESEAU_ESSAI_ADRESSES (empreinte, casse ignorée, comme la livraison). Partout ailleurs
// (page publique, réception sans adresse, autre adresse, interrupteurs éteints) : refusée comme avant.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({ cible: null as Ligne | null, lectures: 0 }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleReseau: {
      findUnique: async () => {
        bd.lectures += 1;
        return bd.cible;
      },
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) =>
    e && e.trim() ? `h:${e.trim().toLowerCase()}` : null,
}));

import { cibleGuideConnue } from "../cible-connue";
import { analyserCorpsAvecCatalogue } from "../contrat";

const CODE = "gde-essai-livraison";
const ESSAI = "essai@example.test";
const ligne = (sur: Ligne = {}): Ligne => ({ type: "guide", actif: true, test: true, ...sur });
const corps = (email: string | undefined) =>
  Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      cleIdempotence: "cle-exemple-0001",
      ...(email === undefined ? {} : { email }),
      mot: "GUIDE",
      reseau: "instagram",
      guide: CODE,
      versionTexteM1: "m1-v1",
    }),
  );

beforeEach(() => {
  bd.cible = ligne();
  bd.lectures = 0;
  vi.stubEnv("GUIDES_RESEAU_CATALOGUE_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_LIVRAISON_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_ESSAI_ADRESSES", ` ${ESSAI} , autre@example.test `);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S2c — cibleGuideConnue et les cibles d'essai", () => {
  it("adresse connue ET dans la liste (casse ignorée) : cible d'essai connue", async () => {
    expect(await cibleGuideConnue(CODE, ESSAI)).toBe(true);
    expect(await cibleGuideConnue(CODE, "ESSAI@Example.TEST")).toBe(true);
  });

  it("sans adresse (page publique, jeton seul) : cible d'essai refusée", async () => {
    expect(await cibleGuideConnue(CODE)).toBe(false);
    expect(await cibleGuideConnue(CODE, undefined)).toBe(false);
    expect(await cibleGuideConnue(CODE, "")).toBe(false);
  });

  it("adresse hors liste, liste vide ou absente : refusée", async () => {
    expect(await cibleGuideConnue(CODE, "inconnue@example.test")).toBe(false);
    vi.stubEnv("GUIDES_RESEAU_ESSAI_ADRESSES", "");
    expect(await cibleGuideConnue(CODE, ESSAI)).toBe(false);
    vi.stubEnv("GUIDES_RESEAU_ESSAI_ADRESSES", " , ,");
    expect(await cibleGuideConnue(CODE, ESSAI)).toBe(false);
  });

  it("l'adresse d'essai n'ouvre RIEN d'autre : cible inactive ou de type adresse refusée", async () => {
    for (const ecart of [{ actif: false }, { type: "adresse" }]) {
      bd.cible = ligne(ecart);
      expect(await cibleGuideConnue(CODE, ESSAI)).toBe(false);
    }
  });

  it("interrupteur de livraison ou de catalogue éteint : refusée, zéro lecture", async () => {
    for (const cle of ["GUIDES_RESEAU_LIVRAISON_ENABLED", "GUIDES_RESEAU_CATALOGUE_ENABLED"]) {
      vi.stubEnv(cle, "false");
      expect(await cibleGuideConnue(CODE, ESSAI)).toBe(false);
      vi.stubEnv(cle, "true");
    }
    expect(bd.lectures).toBe(0);
  });

  it("une cible NON test reste connue sans adresse (inchangé) ; l'adresse d'essai ne change rien", async () => {
    bd.cible = ligne({ test: false });
    expect(await cibleGuideConnue(CODE)).toBe(true);
    expect(await cibleGuideConnue(CODE, "inconnue@example.test")).toBe(true);
  });

  it("code hors format avec adresse d'essai : refusé, zéro lecture", async () => {
    expect(await cibleGuideConnue("gde-abc", ESSAI)).toBe(false);
    expect(bd.lectures).toBe(0);
  });
});

describe("S2c — la réception (analyserCorpsAvecCatalogue) passe l'adresse du corps", () => {
  it("adresse d'essai dans le corps : acceptée ; autre adresse, ou sans adresse : refusée", async () => {
    expect((await analyserCorpsAvecCatalogue(corps(ESSAI))).ok).toBe(true);
    expect((await analyserCorpsAvecCatalogue(corps("inconnue@example.test"))).ok).toBe(false);
    expect((await analyserCorpsAvecCatalogue(corps(undefined))).ok).toBe(false);
    expect((await analyserCorpsAvecCatalogue(corps(12 as unknown as string))).ok).toBe(false);
  });
});
