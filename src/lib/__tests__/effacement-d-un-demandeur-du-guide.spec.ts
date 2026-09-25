// @vitest-environment node
/**
 * Lot L6 — l'effacement d'un DEMANDEUR DU GUIDE ne laisse aucune ligne qui
 * porte son adresse ; seule survit l'EMPREINTE du registre de preuve.
 *
 * Prouvé par l'effet, sur une base en mémoire : les lignes existent, les
 * mêmes fonctions que `/api/gdpr-erase` et que l'effacement console
 * (`eraseNewsletterForEmail`, `eraseEmailTracesForEmail`) s'exécutent, puis
 * l'on cherche l'adresse dans TOUTES les valeurs de TOUTES les tables.
 *
 * Deux témoins positifs empêchent un vert par la mauvaise cause :
 *   · la ligne `consent_events` de la personne SURVIT, sous son empreinte
 *     (sinon « 0 ligne » serait satisfait par une table vidée) ;
 *   · les lignes d'une AUTRE personne restent intactes (sinon un `deleteMany`
 *     sans filtre passerait).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import { eraseEmailTracesForEmail, eraseNewsletterForEmail } from "@/lib/rgpd-erase";

const DEMANDEUR = "demandeur.guide@example.invalid";
const AUTRE = "autre.personne@example.invalid";
const T = new Date("2026-09-20T10:00:00.000Z");

let tables: Record<string, Table>;

function toutesLesValeurs(): string[] {
  const out: string[] = [];
  for (const t of Object.values(tables)) {
    for (const l of t.lignes) out.push(JSON.stringify(l).toLowerCase());
  }
  return out;
}

beforeEach(() => {
  const cle = hashEmailForLookup(DEMANDEUR);
  const cleAutre = hashEmailForLookup(AUTRE);
  tables = {
    newsletterSubscriber: table([
      // Adresse professionnelle inscrite en même temps que sa demande du guide
      // (casse différente : la colonne est en citext).
      { id: "a1", email: "Demandeur.Guide@Example.Invalid", status: "confirmed", createdAt: T },
      { id: "a2", email: AUTRE, status: "confirmed", createdAt: T },
    ]),
    guideRequest: table([
      { id: "g1", email: DEMANDEUR, emailKey: cle, aimant: "guide-ia", createdAt: T },
      // Même personne, second aimant, retrouvée par l'EMPREINTE seule.
      { id: "g2", email: "DEMANDEUR.GUIDE@example.invalid", emailKey: cle, aimant: "autre" },
      { id: "g3", email: AUTRE, emailKey: cleAutre, aimant: "guide-ia", createdAt: T },
    ]),
    emailLog: table([
      { id: "l1", recipient: DEMANDEUR, template: "guide-ia-envoi", bounceReason: DEMANDEUR },
      { id: "l2", recipient: AUTRE, template: "guide-ia-envoi", bounceReason: null },
    ]),
    emailOutbox: table([
      { id: "o1", recipient: DEMANDEUR, payload: { email: DEMANDEUR } },
      { id: "o2", recipient: AUTRE, payload: { email: AUTRE } },
    ]),
    consentEvent: table([
      { id: "c1", personKey: cle, formRef: "guide-ia", action: "information", occurredAt: T },
      { id: "c2", personKey: cleAutre, formRef: "guide-ia", action: "optin", occurredAt: T },
    ]),
  };
  base.tables = tables;
});

describe("effacement d'un demandeur du guide", () => {
  it("🔴 aucune ligne ne porte plus son adresse, dans aucune table", async () => {
    const nl = await eraseNewsletterForEmail(DEMANDEUR);
    const traces = await eraseEmailTracesForEmail(DEMANDEUR);

    // Discriminant positif : l'effacement a bien TROUVÉ ses lignes.
    expect(nl).toEqual({ deleted: 1, guideDeleted: 2 });
    expect(traces).toEqual({ logsPseudonymises: 1, outboxSupprimes: 1 });

    const fuites = toutesLesValeurs().filter((v) => v.includes(DEMANDEUR));
    expect(fuites).toEqual([]);
  });

  it("…hors l'EMPREINTE du registre de preuve, qui survit (art. 7.1 : démontrer l'information ou l'accord)", async () => {
    await eraseNewsletterForEmail(DEMANDEUR);
    await eraseEmailTracesForEmail(DEMANDEUR);
    const survivantes = tables["consentEvent"]!.lignes.filter(
      (l) => l["personKey"] === hashEmailForLookup(DEMANDEUR),
    );
    expect(survivantes).toHaveLength(1);
    // Et la seule donnée qui la relie à la personne est l'empreinte.
    expect(JSON.stringify(survivantes[0])).not.toMatch(/@/);
  });

  it("le journal d'envoi est pseudonymisé, pas supprimé (preuve d'envoi gardée)", async () => {
    await eraseEmailTracesForEmail(DEMANDEUR);
    const l1 = tables["emailLog"]!.lignes.find((l) => l["id"] === "l1");
    expect(l1?.["recipient"]).toMatch(/^erased:[0-9a-f]{16}@erased\.local$/);
    expect(l1?.["bounceReason"]).toBeNull();
  });

  it("les lignes d'une AUTRE personne restent intactes", async () => {
    await eraseNewsletterForEmail(DEMANDEUR);
    await eraseEmailTracesForEmail(DEMANDEUR);
    expect(tables["newsletterSubscriber"]!.lignes.map((l) => l["id"])).toEqual(["a2"]);
    expect(tables["guideRequest"]!.lignes.map((l) => l["id"])).toEqual(["g3"]);
    expect(tables["emailLog"]!.lignes.find((l) => l["id"] === "l2")?.["recipient"]).toBe(AUTRE);
    expect(tables["emailOutbox"]!.lignes.map((l) => l["id"])).toEqual(["o2"]);
    expect(tables["consentEvent"]!.lignes).toHaveLength(2);
  });
});

describe("la confirmation d'effacement énumère les demandes du guide", () => {
  it("🔴 le courriel nomme les demandes du guide supprimées, et la route lui passe le compte", async () => {
    const { renderEmailTemplate } = await import("@/lib/email/templates");
    const payload = {
      effectueLe: "01/01/2030",
      demandes: 0,
      newsletter: 1,
      demandesGuide: 3,
      conversations: 0,
      candidatures: 0,
      appels: 0,
    };
    const fr = await renderEmailTemplate("rgpd-effacement-confirme", "fr", payload);
    expect(fr.text).toContain("3 demande(s) du guide IA supprimée(s)");
    const en = await renderEmailTemplate("rgpd-effacement-confirme", "en", payload);
    expect(en.text).toContain("3 AI guide request(s) deleted");

    const { readFileSync } = await import("node:fs");
    const route = readFileSync("src/app/api/gdpr-erase/route.ts", "utf8");
    expect(route).toContain("demandesGuide: newsletterResult.guideDeleted");
  });

  it("une tâche mise en file par l'ancienne route (sans le compte) se lit 0, sans « undefined »", async () => {
    const { renderEmailTemplate } = await import("@/lib/email/templates");
    const r = await renderEmailTemplate("rgpd-effacement-confirme", "fr", {
      effectueLe: "01/01/2030",
      demandes: 0,
      newsletter: 0,
      conversations: 0,
      candidatures: 0,
      appels: 0,
    });
    expect(r.text).toContain("0 demande(s) du guide IA supprimée(s)");
    expect(r.text).not.toContain("undefined");
  });
});
