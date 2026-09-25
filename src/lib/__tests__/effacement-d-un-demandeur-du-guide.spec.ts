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

import { readFileSync } from "node:fs";
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

import {
  eraseCrmOutboxForEmail,
  eraseEmailTracesForEmail,
  eraseNewsletterForEmail,
} from "@/lib/rgpd-erase";
// Importé EN TÊTE (relecture L6) : un `await import()` dans le corps du test
// compilait tout l'arbre des gabarits PENDANT le test, qui dépassait son délai.
import { renderEmailTemplate } from "@/lib/email/templates";

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
    // L6 — la file vers le CRM : charge déchiffrée, adresse EN CLAIR.
    crmSyncOutbox: table([
      // Retrouvée par l'empreinte (casse différente dans la charge).
      {
        id: "x1",
        status: "sent",
        payload: { person: { person_key: cle, email: "Demandeur.Guide@Example.Invalid" } },
      },
      // `pending` : la garder la ferait REPARTIR vers le CRM après l'effacement.
      { id: "x2", status: "pending", payload: { person: { person_key: cle, email: DEMANDEUR } } },
      // Sans clé (filet) : retrouvée par l'adresse, forme normalisée.
      { id: "x3", status: "gave_up", payload: { person: { email: DEMANDEUR } } },
      // Témoin : une autre personne.
      { id: "x4", status: "sent", payload: { person: { person_key: cleAutre, email: AUTRE } } },
    ]),
  };
  base.tables = tables;
});

describe("effacement d'un demandeur du guide", () => {
  it("🔴 aucune ligne ne porte plus son adresse, dans aucune table", async () => {
    const nl = await eraseNewsletterForEmail(DEMANDEUR);
    const traces = await eraseEmailTracesForEmail(DEMANDEUR);
    const crm = await eraseCrmOutboxForEmail(DEMANDEUR);

    // Discriminant positif : l'effacement a bien TROUVÉ ses lignes.
    expect(nl).toEqual({ deleted: 1, guideDeleted: 2 });
    expect(traces).toEqual({ logsPseudonymises: 1, outboxSupprimes: 1 });
    expect(crm).toEqual({ supprimees: 3 });

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

  it("L6 — la file vers le CRM : toutes les lignes de la personne, quel que soit leur statut", async () => {
    const r = await eraseCrmOutboxForEmail(DEMANDEUR);
    expect(r.supprimees).toBe(3);
    expect(tables["crmSyncOutbox"]!.lignes.map((l) => l["id"])).toEqual(["x4"]);
  });

  it("les lignes d'une AUTRE personne restent intactes", async () => {
    await eraseNewsletterForEmail(DEMANDEUR);
    await eraseEmailTracesForEmail(DEMANDEUR);
    await eraseCrmOutboxForEmail(DEMANDEUR);
    expect(tables["crmSyncOutbox"]!.lignes.map((l) => l["id"])).toEqual(["x4"]);
    expect(tables["newsletterSubscriber"]!.lignes.map((l) => l["id"])).toEqual(["a2"]);
    expect(tables["guideRequest"]!.lignes.map((l) => l["id"])).toEqual(["g3"]);
    expect(tables["emailLog"]!.lignes.find((l) => l["id"] === "l2")?.["recipient"]).toBe(AUTRE);
    expect(tables["emailOutbox"]!.lignes.map((l) => l["id"])).toEqual(["o2"]);
    expect(tables["consentEvent"]!.lignes).toHaveLength(2);
  });
});

describe("la confirmation d'effacement énumère les demandes du guide", () => {
  it("🔴 le courriel nomme les demandes du guide supprimées, et la route lui passe le compte", async () => {
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

    const route = readFileSync("src/app/api/gdpr-erase/route.ts", "utf8");
    expect(route).toContain("demandesGuide: newsletterResult.guideDeleted");
  });

  it("une tâche mise en file par l'ancienne route (sans le compte) OMET le segment, sans « 0 » ni « undefined »", async () => {
    const r = await renderEmailTemplate("rgpd-effacement-confirme", "fr", {
      effectueLe: "01/01/2030",
      demandes: 0,
      newsletter: 0,
      conversations: 0,
      candidatures: 0,
      appels: 0,
    });
    // Discriminant positif : l'énumération est bien rendue…
    expect(r.text).toContain("0 inscription(s) à la lettre d'information supprimée(s)");
    // …sans le segment du guide, que l'ancienne route ne comptait pas.
    expect(r.text).not.toContain("guide IA");
    expect(r.text).not.toContain("undefined");
  });

  it("L6 — aucune affirmation fausse : le texte validé est rendu mot pour mot (FR et EN)", async () => {
    const payload = {
      effectueLe: "01/01/2030",
      demandes: 0,
      newsletter: 0,
      demandesGuide: 0,
      conversations: 0,
      candidatures: 0,
      appels: 0,
    };
    const fr = (await renderEmailTemplate("rgpd-effacement-confirme", "fr", payload)).text;
    expect(fr.replace(/\s+/g, " ")).toContain(
      "Certaines traces sont conservées sans votre adresse : les pièces comptables que la loi nous impose de garder, le journal de nos envois, et la preuve de ce que vous aviez accepté ou refusé (texte présenté, date). Votre adresse y est remplacée par une empreinte, qui ne permet pas de la retrouver ; elle sert seulement à ne plus vous écrire si votre adresse nous parvenait de nouveau.",
    );
    // (« demande(s) de contact anonymisée(s) » reste : ces lignes-là SONT anonymisées.)
    for (const faux of [
      "sous forme anonymisée",
      "registre des traitements",
      "ne figure plus dans nos fichiers",
    ]) {
      expect(fr, faux).not.toContain(faux);
    }
    const en = (await renderEmailTemplate("rgpd-effacement-confirme", "en", payload)).text;
    expect(en.replace(/\s+/g, " ")).toContain(
      "Some records are kept without your address: accounting documents that the law requires us to retain, the log of the messages we sent, and the proof of what you had accepted or refused (text shown, date). In them, your address is replaced by a fingerprint from which it cannot be recovered; its only use is to stop us writing to you should your address reach us again.",
    );
    for (const faux of ["anonymised form", "processing register", "no longer in our files"]) {
      expect(en, faux).not.toContain(faux);
    }
  });
});

describe("L6 — l'export art. 15 rend ou DÉCLARE tout ce qui touche la lettre et le guide", () => {
  const route = readFileSync("src/app/api/gdpr-export/route.ts", "utf8");

  it("empreintes de la preuve, oppositions et file CRM exportées", () => {
    const preuve = route.slice(route.indexOf("prisma.consentEvent.findMany"));
    const select = preuve.slice(0, preuve.indexOf("})"));
    expect(select).toContain("ipHash: true");
    expect(select).toContain("userAgent: true");
    expect(route).toContain("prisma.emailOpposition.findMany");
    expect(route).toContain("prisma.crmSyncOutbox.findMany");
    expect(route).toMatch(/\n\s+oppositions,\n/);
    expect(route).toMatch(/\n\s+fileCrm,\n/);
  });

  it("jetons d'accès et charge CRM déclarés dans les exclusions", () => {
    const exclusions = route.slice(route.indexOf("excludedTables"));
    for (const nom of [
      "crm_sync_outbox.payload",
      "newsletter_subscribers.confirm_token",
      "newsletter_subscribers.unsubscribe_token",
      "guide_requests.download_token",
    ]) {
      expect(exclusions, nom).toContain(nom);
    }
  });

  it("une lecture en échec est DITE dans l'export, plus avalée en liste vide", () => {
    // Le seul `.catch(() => [])` restant est celui que cite le commentaire.
    const code = route
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toContain(".catch(() => [])");
    expect(code).toContain("avertissements.push(");
    expect(code).toMatch(/avertissements\.length > 0 \? \{ avertissements \}/);
  });
});
