// @vitest-environment node
//
// P4 — après N jours sans clic, l'accord « en attente » passe « non vérifiée, à l'écart ». Rien
// n'est supprimé : un état change, le registre reçoit UNE ligne. Éteint par défaut. Base en
// mémoire, données fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  confirmerPreuvesAuClic,
  ecarterPreuvesNonVerifiees,
  reparerRegistrePreuves,
} from "../preuve-page-guide";
import { JOURS_AVANT_ECART_PREUVE } from "../config";
import { FORM_REF_PAGE_GUIDE, FORM_REF_PAGE_GUIDE_INFOS } from "@/content/guides-reseau";

const JOUR = 24 * 3_600_000;
const MAINTENANT = new Date("2026-12-01T04:23:00.000Z");
const ADRESSE = "personne@example.test";
const EMPREINTE = "9f".repeat(32);
const AVANT = process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"];

let n = 0;
function contact(o: Record<string, unknown> = {}) {
  n += 1;
  return {
    id: `c${String(n).padStart(4, "0")}`,
    emailKey: `h:${ADRESSE}`,
    guideRequestId: "d1",
    prenom: "enc:Q2FtaWxsZQ==",
    versionConsentement: "v1",
    consentEmpreinte: EMPREINTE,
    consentiLe: new Date(MAINTENANT.getTime() - 20 * JOUR),
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
  n = 0;
  bd.base = nouvelleBase();
  bd.rec = enregistreurRegistre(bd.base);
  bd.base.demandes.push({ id: "d1", email: ADRESSE });
  process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"] = "true";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  if (AVANT === undefined) delete process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"];
  else process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"] = AVANT;
});

describe("case « informations »", () => {
  it("🔴 cochée : l'écart écrit aussi UN consent_ecarte pour la ligne infos ; non cochée : rien", async () => {
    bd.base.contacts.push(
      contact({ infosStatut: "non_transmise", infosVersion: "i1", infosEmpreinte: "b".repeat(64) }),
      contact({ emailKey: "h:autre@example.test", guideRequestId: "d2" }),
    );
    bd.base.demandes.push({ id: "d2", email: "autre@example.test" });
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    const infos = bd.base.registre.filter((r) => r["formRef"] === FORM_REF_PAGE_GUIDE_INFOS);
    expect(infos).toEqual([
      expect.objectContaining({
        personKey: `h:${ADRESSE}`,
        action: "consent_ecarte",
        occurredAt: MAINTENANT,
        consentVersion: `i1.${"b".repeat(32)}`,
      }),
    ]);
    expect(bd.base.registre).toHaveLength(3);
    expect(bd.base.suppressions).toEqual([]);
  });
});

describe("N jours", () => {
  it("N vaut 14 et reste au-delà de l'horizon du rattrapage (7 jours)", () => {
    expect(JOURS_AVANT_ECART_PREUVE).toBe(14);
  });

  it("🔴 J+13 j 23 h → inchangée ; J+14 j 1 h → non_verifiee + date + UN consent_ecarte", async () => {
    bd.base.contacts.push(
      contact({ consentiLe: new Date(MAINTENANT.getTime() - (13 * JOUR + 23 * 3_600_000)) }),
      contact({ consentiLe: new Date(MAINTENANT.getTime() - (14 * JOUR + 3_600_000)) }),
    );
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("en_attente");
    expect(bd.base.contacts[1]).toMatchObject({
      preuveStatut: "non_verifiee",
      preuveEcarteeLe: MAINTENANT,
    });
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.registre[0]).toMatchObject({
      personKey: `h:${ADRESSE}`,
      formRef: FORM_REF_PAGE_GUIDE,
      action: "consent_ecarte",
      occurredAt: MAINTENANT,
    });
  });

  it("un statut NULL (avant la migration) suit la même règle", async () => {
    bd.base.contacts.push(contact({ preuveStatut: null }));
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("non_verifiee");
  });
});

describe("aucune suppression", () => {
  it("🔴 jamais de delete/deleteMany ; prénom chiffré, empreinte du texte, date de l'accord INTACTS", async () => {
    const c = contact();
    const avant = { prenom: c.prenom, e: c.consentEmpreinte, le: c.consentiLe };
    bd.base.contacts.push(c);
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.suppressions).toEqual([]);
    expect(bd.base.contacts).toHaveLength(1);
    expect(bd.base.contacts[0]).toMatchObject({
      prenom: avant.prenom,
      consentEmpreinte: avant.e,
      consentiLe: avant.le,
    });
    expect(bd.base.demandes).toHaveLength(1);
  });

  it("le code source ne contient aucune instruction de suppression", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/server/guides-reseau/preuve-page-guide.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(src).not.toMatch(/\.(delete|deleteMany)\s*\(/);
    expect(src).not.toMatch(/merciStatut/);
  });
});

describe("ce qui n'est jamais touché, idempotence, course", () => {
  it("confirmee et sans_objet ne bougent jamais", async () => {
    bd.base.contacts.push(
      contact({ preuveStatut: "confirmee", preuveConfirmeeLe: new Date("2026-11-12T00:00:00Z") }),
      contact({ preuveStatut: "sans_objet", emailKey: "-", guideRequestId: null }),
    );
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts.map((c) => c["preuveStatut"])).toEqual(["confirmee", "sans_objet"]);
    expect(bd.base.registre).toHaveLength(0);
  });

  it("🔴 rejouer le job n'a aucun effet (idempotent)", async () => {
    bd.base.contacts.push(contact());
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    await ecarterPreuvesNonVerifiees(new Date(MAINTENANT.getTime() + 1000));
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.contacts[0]!["preuveEcarteeLe"]).toEqual(MAINTENANT);
  });

  it("🔴 course : le clic passe entre la lecture et l'écriture → la ligne reste confirmee", async () => {
    bd.base.contacts.push(contact());
    bd.base.apresLecture = () => {
      bd.base.apresLecture = null;
      // Le clic de la personne arrive juste après la lecture du lot de l'écart.
      Object.assign(bd.base.contacts[0]!, {
        preuveStatut: "confirmee",
        preuveConfirmeeLe: MAINTENANT,
      });
    };
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
    expect(bd.base.registre.some((r) => r["action"] === "consent_ecarte")).toBe(false);
  });

  it("D2 — l'écart passe le premier, puis le clic arrive : la ligne redevient confirmee", async () => {
    bd.base.contacts.push(contact());
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("non_verifiee");
    await confirmerPreuvesAuClic("d1", new Date(MAINTENANT.getTime() + JOUR));
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("confirmee");
  });

  it("traite plusieurs lots de 500 sans rien oublier ni rien dupliquer", async () => {
    for (let i = 0; i < 1203; i++) bd.base.contacts.push(contact());
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts.every((c) => c["preuveStatut"] === "non_verifiee")).toBe(true);
    expect(bd.base.registre).toHaveLength(1203);
  });

  it("ligne sans demande liée : l'état suffit, pas de ligne de registre, compté « sans_adresse »", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    bd.base.contacts.push(contact({ guideRequestId: null }));
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("non_verifiee");
    expect(bd.base.registre).toHaveLength(0);
    expect(JSON.stringify(warn.mock.calls)).toContain('\\"sans_adresse\\":1');
  });
});

describe("interrupteur PREUVE_PAGE_GUIDE_ECART_ENABLED", () => {
  it("🔴 éteint (absent, « 1 », « TRUE ») → aucune requête, aucun effet", async () => {
    bd.base.contacts.push(contact());
    for (const v of [undefined, "1", "TRUE", "false", ""]) {
      if (v === undefined) delete process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"];
      else process.env["PREUVE_PAGE_GUIDE_ECART_ENABLED"] = v;
      await ecarterPreuvesNonVerifiees(MAINTENANT);
    }
    expect(bd.base.requetes).toBe(0);
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("en_attente");
    expect(bd.base.registre).toHaveLength(0);
  });
});

describe("pannes", () => {
  it("colonne absente (P2022, fenêtre app↔worker) → journal « colonne_absente », aucun effet, aucune levée", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    bd.base.contacts.push(contact());
    bd.base.panneContacts = Object.assign(new Error("colonne absente"), { code: "P2022" });
    await expect(ecarterPreuvesNonVerifiees(MAINTENANT)).resolves.toBeDefined();
    expect(JSON.stringify(warn.mock.calls)).toContain("colonne_absente");
    expect(bd.base.contacts[0]!["preuveStatut"]).toBe("en_attente");
  });

  it("une autre panne de base remonte (le job échoue et se voit)", async () => {
    bd.base.panneContacts = new Error("base indisponible");
    await expect(ecarterPreuvesNonVerifiees(MAINTENANT)).rejects.toThrow("base indisponible");
  });
});

describe("journaux", () => {
  it("🔴 aucune adresse, aucun prénom, aucune empreinte dans la console", async () => {
    const sorties: string[] = [];
    for (const m of ["log", "warn", "error", "info"] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        sorties.push(a.map(String).join(" "));
      });
    }
    bd.base.contacts.push(contact());
    await ecarterPreuvesNonVerifiees(MAINTENANT);
    const tout = sorties.join("\n");
    expect(tout).toContain("guides_reseau_preuve");
    expect(tout).not.toContain("@");
    expect(tout).not.toContain("example.test");
    expect(tout).not.toContain("Q2FtaWxsZQ");
    expect(tout).not.toContain(EMPREINTE.slice(0, 16));
  });
});

describe("réparation du registre (30 derniers jours)", () => {
  it("🔴 une ligne confirmee sans ligne de registre est ré-écrite, UNE fois", async () => {
    const clic = new Date(MAINTENANT.getTime() - 5 * JOUR);
    bd.base.contacts.push(contact({ preuveStatut: "confirmee", preuveConfirmeeLe: clic }));
    await reparerRegistrePreuves(MAINTENANT);
    await reparerRegistrePreuves(MAINTENANT);
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.registre[0]).toMatchObject({ action: "consent_confirme", occurredAt: clic });
  });

  it("une ligne non_verifiee sans registre → consent_ecarte ; une ligne vieille de plus de 30 jours est ignorée", async () => {
    bd.base.contacts.push(
      contact({
        preuveStatut: "non_verifiee",
        preuveEcarteeLe: new Date(MAINTENANT.getTime() - 3 * JOUR),
      }),
      contact({
        preuveStatut: "non_verifiee",
        preuveEcarteeLe: new Date(MAINTENANT.getTime() - 45 * JOUR),
      }),
    );
    await reparerRegistrePreuves(MAINTENANT);
    expect(bd.base.registre).toHaveLength(1);
    expect(bd.base.registre[0]!["action"]).toBe("consent_ecarte");
  });
});
