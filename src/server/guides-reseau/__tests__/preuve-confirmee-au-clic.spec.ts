// @vitest-environment node
//
// P3 — la preuve de l'accord passe « en attente » → « confirmée » au PREMIER clic sur le bouton du
// lien du guide APRÈS l'accord, indépendamment du CRM. Base en mémoire, données fictives.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clientPrisma,
  enregistreurRegistre,
  nouvelleBase,
  type BasePreuve,
} from "./fixtures/base-preuve-en-memoire";

const bd = vi.hoisted(() => ({ base: null as unknown as BasePreuve, rec: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return clientPrisma(bd.base);
  },
}));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: (...a: unknown[]) => (bd.rec as (...x: unknown[]) => Promise<boolean>)(...a),
}));

import { confirmerPreuvesAuClic } from "../preuve-page-guide";
import { FORM_REF_PAGE_GUIDE, FORM_REF_PAGE_GUIDE_INFOS } from "@/content/guides-reseau";

const ADRESSE = "personne@example.test";
const CASE_LE = new Date("2026-11-08T10:00:00.000Z");
const CLIC_LE = new Date("2026-11-08T12:00:00.000Z");

function contact(o: Record<string, unknown> = {}) {
  return {
    id: `c${bd.base.contacts.length + 1}`,
    emailKey: `h:${ADRESSE}`,
    guideRequestId: "d1",
    versionConsentement: "v1",
    consentEmpreinte: "a".repeat(64),
    consentiLe: CASE_LE,
    preuveStatut: "en_attente",
    preuveConfirmeeLe: null,
    preuveEcarteeLe: null,
    infosStatut: "aucune",
    infosVersion: null,
    infosEmpreinte: null,
    ...o,
  };
}

beforeEach(() => {
  bd.base = nouvelleBase();
  bd.rec = enregistreurRegistre(bd.base);
  bd.base.demandes.push({ id: "d1", email: ADRESSE });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("confirmerPreuvesAuClic", () => {
  it("🔴 clic après la case → confirmee, date = clic, UN consent_confirme", async () => {
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts[0]).toMatchObject({
      preuveStatut: "confirmee",
      preuveConfirmeeLe: CLIC_LE,
    });
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.registre[0]).toMatchObject({
      personKey: `h:${ADRESSE}`,
      formRef: FORM_REF_PAGE_GUIDE,
      action: "consent_confirme",
      occurredAt: CLIC_LE,
    });
  });

  it("🔴 case « informations » cochée → UN consent_confirme de plus pour la ligne infos", async () => {
    bd.base.contacts.push(
      contact({ infosStatut: "non_transmise", infosVersion: "i1", infosEmpreinte: "b".repeat(64) }),
    );
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.registre).toHaveLength(2);
    expect(bd.base.registre.filter((r) => r["formRef"] === FORM_REF_PAGE_GUIDE_INFOS)).toEqual([
      expect.objectContaining({
        personKey: `h:${ADRESSE}`,
        action: "consent_confirme",
        occurredAt: CLIC_LE,
        consentVersion: `i1.${"b".repeat(32)}`,
      }),
    ]);
  });

  it("case « informations » non cochée → aucune ligne infos au registre", async () => {
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.registre.some((r) => r["formRef"] === FORM_REF_PAGE_GUIDE_INFOS)).toBe(false);
  });

  it("🔴 rejeu : un second clic n'écrit aucune nouvelle ligne de registre", async () => {
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    await confirmerPreuvesAuClic("d1", new Date(CLIC_LE.getTime() + 5000));
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.contacts[0]!["preuveConfirmeeLe"]).toEqual(CLIC_LE);
  });

  it("🔴 concurrence : deux clics simultanés → une seule transition, un seul consent_confirme", async () => {
    bd.base.contacts.push(contact());
    await Promise.all([
      confirmerPreuvesAuClic("d1", CLIC_LE),
      confirmerPreuvesAuClic("d1", new Date(CLIC_LE.getTime() + 1)),
    ]);
    expect(bd.base.registre.filter((r) => r["action"] === "consent_confirme")).toHaveLength(1);
  });

  it("🔴 rejeu au MÊME instant : deux POST avec le même clic n'écrivent qu'un consent_confirme", async () => {
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    await confirmerPreuvesAuClic("d1", new Date(CLIC_LE.getTime()));
    expect(bd.base.registre.filter((r) => r["action"] === "consent_confirme")).toHaveLength(1);
  });

  it("🔴 désordre : un clic ANTÉRIEUR à la case ne vérifie pas CET accord", async () => {
    bd.base.contacts.push(contact({ consentiLe: new Date("2026-11-09T09:00:00.000Z") }));
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("en_attente");
    expect(bd.base.registre).toHaveLength(0);
  });

  it("deux contacts liés à la même demande → les deux confirmés, deux lignes de registre", async () => {
    bd.base.contacts.push(contact(), contact({ consentiLe: new Date("2026-11-08T11:00:00.000Z") }));
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts.map((c) => c["preuveStatut"])).toEqual(["confirmee", "confirmee"]);
    expect(bd.base.registre).toHaveLength(2);
  });

  it("un statut NULL (ligne d'avant la migration) se lit « en attente » et se confirme", async () => {
    bd.base.contacts.push(contact({ preuveStatut: null }));
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
  });

  it("D2 — un clic APRÈS la mise à l'écart confirme aussi (le geste de la personne)", async () => {
    bd.base.contacts.push(
      contact({ preuveStatut: "non_verifiee", preuveEcarteeLe: new Date("2026-11-30T00:00:00Z") }),
    );
    await confirmerPreuvesAuClic("d1", new Date("2026-12-05T00:00:00.000Z"));
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
    expect(bd.base.registre).toHaveLength(1);
  });

  it("une MARQUE (sans_objet) et une ligne déjà confirmée ne bougent pas", async () => {
    bd.base.contacts.push(
      contact({ preuveStatut: "sans_objet" }),
      contact({ preuveStatut: "confirmee", preuveConfirmeeLe: CASE_LE }),
    );
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("sans_objet");
    expect(bd.base.contacts[1]!["preuveConfirmeeLe"]).toEqual(CASE_LE);
    expect(bd.base.registre).toHaveLength(0);
  });

  it("D3 — adresse déjà opposée : la confirmation s'écrit quand même (preuve du passé)", async () => {
    // L'opposition n'est pas lue ici : le « stop » bloque envois et CRM ailleurs.
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
  });

  it("🔴 panne de base : ne lève jamais", async () => {
    bd.base.contacts.push(contact());
    bd.base.panneContacts = new Error("base indisponible");
    await expect(confirmerPreuvesAuClic("d1", CLIC_LE)).resolves.toBeUndefined();
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("en_attente");
  });

  it("panne du registre : l'état reste confirmé, aucune levée", async () => {
    bd.base.contacts.push(contact());
    bd.rec = async () => {
      throw new Error("registre indisponible");
    };
    await expect(confirmerPreuvesAuClic("d1", CLIC_LE)).resolves.toBeUndefined();
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
  });

  it("journal agrégé seulement : ni adresse, ni prénom, ni empreinte", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    const sortie = JSON.stringify(warn.mock.calls);
    expect(sortie).toContain("guides_reseau_preuve");
    expect(sortie).toContain('\\"lignes\\":1');
    expect(sortie).not.toContain("@");
    expect(sortie).not.toContain("example.test");
    expect(sortie).not.toContain("a".repeat(16));
  });

  it("aucune suppression, jamais", async () => {
    bd.base.contacts.push(contact());
    await confirmerPreuvesAuClic("d1", CLIC_LE);
    expect(bd.base.suppressions).toEqual([]);
  });
});
