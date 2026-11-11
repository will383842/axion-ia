// @vitest-environment node
//
// Lot L3b — contrat de la synchro v3 vers le CRM : interrupteur éteint = rien en file, et charge
// émise conforme à la FIXTURE JSON PARTAGÉE (`fixtures/charge-crm-v3.json`, à copier à l'identique
// côté CRM pour son test de lecteur v3). Adresses en `.test`, jetons fictifs.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fixture from "./fixtures/charge-crm-v3.json";

const file = vi.hoisted(() => ({ evenements: [] as unknown[] }));
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: async (e: unknown) => {
    file.evenements.push(e);
    return "ligne-1";
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: () => "0000000000000000000000000000000000000000000000000000000000000000", // 64 hex, comme la vraie empreinte (SITE-429)
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { transmettreOriginesV3 } from "../synchro-v3";
import { construireOrigine } from "../origines";
import { analyserCorps } from "../contrat";

const demande = () => {
  const r = analyserCorps(
    Buffer.from(
      JSON.stringify({
        schemaVersion: 3,
        cleIdempotence: "run_zernio_0001",
        email: "personne@exemple.test",
        mot: "guide",
        reseau: "instagram",
        guide: "guide-ia",
        accord: "non_demande",
        versionTexteM1: "m1-brouillon-v1",
        post_ref: "post_ref_test_01",
        canal: "commentaire",
        famille: "guide_reseau",
        detail: "autre_non_classe",
        compte: "page_principale",
        version_texte: "m1-v1",
        utm_campaign: "guide_reseau",
        commentaire_ref: "comm_ref_test_01",
      }),
    ),
  );
  if (!r.ok || !r.demande) throw new Error("fixture invalide");
  return r.demande;
};
const quand = new Date(Date.UTC(2026, 10, 1, 10, 0, 0));
const ancien = process.env.SYNCHRO_CRM_V3;

beforeEach(() => {
  file.evenements.length = 0;
});
afterEach(() => {
  if (ancien === undefined) delete process.env.SYNCHRO_CRM_V3;
  else process.env.SYNCHRO_CRM_V3 = ancien;
});

const appel = () =>
  transmettreOriginesV3({
    email: "personne@exemple.test",
    cleIdempotence: "run_zernio_0001",
    origines: [construireOrigine(demande(), quand)],
    quand,
  });

describe("synchro v3 — contrat", () => {
  it("synchro v3 éteinte : transmettreOriginesV3 ne met rien en file", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    expect(await appel()).toBe("eteinte");
    process.env.SYNCHRO_CRM_V3 = "1";
    expect(await appel()).toBe("eteinte");
    process.env.SYNCHRO_CRM_V3 = "false";
    expect(await appel()).toBe("eteinte");
    expect(file.evenements).toHaveLength(0);
  });

  it("charge conforme au schéma CRM (fixture JSON partagée)", async () => {
    process.env.SYNCHRO_CRM_V3 = "true";
    expect(await appel()).toBe("mise_en_file");
    expect(file.evenements).toHaveLength(1);
    expect(file.evenements[0]).toEqual(fixture);
  });

  it("la charge ne porte ni jeton de commentaire (même en HMAC) ni pseudo ni texte", async () => {
    process.env.SYNCHRO_CRM_V3 = "true";
    await appel();
    const texte = JSON.stringify((file.evenements[0] as { payload: unknown }).payload);
    expect(texte).not.toContain("comm_ref_test_01");
    expect(texte).not.toMatch(/"(commentaire_ref|pseudo|texte|nom)"/);
  });

  it("rejeu de la même clé : même event_id (aucun doublon côté CRM)", async () => {
    process.env.SYNCHRO_CRM_V3 = "true";
    await appel();
    await appel();
    const [a, b] = file.evenements as { event_id: string }[];
    expect(a?.event_id).toBe(b?.event_id);
  });
});
