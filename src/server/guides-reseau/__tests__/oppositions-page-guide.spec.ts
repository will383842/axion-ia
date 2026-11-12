// @vitest-environment node
//
// `POST /api/interne/oppositions-page-guide` — « stop » écrit APRÈS la page du guide, transmis par référence de
// conversation (sans adresse). Base et enregistrement d'opposition SIMULÉS, adresses fictives de domaine réservé.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const { bd } = vi.hoisted(() => ({
  bd: {
    contacts: [] as Ligne[],
    adressesOpposees: [] as string[],
    opposition: { ok: true, crmAverti: true } as { ok: boolean; crmAverti: boolean },
    suppressions: 0,
    /** Lignes de `oppositions_conv_ref` (références hachées), unicité rejouée. */
    marques: [] as string[],
    marquePanne: false,
    limiteRefusee: false,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    oppositionConvRef: {
      upsert: async ({ where }: { where: { convRef: string } }) => {
        if (bd.marquePanne) throw new Error("écriture de la marque impossible");
        if (!bd.marques.includes(where.convRef)) bd.marques.push(where.convRef);
        return { id: "m" };
      },
      delete: async () => {
        bd.suppressions++;
      },
      deleteMany: async () => {
        bd.suppressions++;
      },
    },
    contactGuideReseau: {
      findMany: async ({ where }: { where: { convRef: string } }) =>
        bd.contacts
          .filter((c) => c.convRef === where.convRef)
          .map((c) => ({
            id: c.id,
            emailKey: c.emailKey,
            guideRequest: c.email ? { email: c.email } : null,
          })),
      updateMany: async ({
        where,
        data,
      }: {
        where: { emailKey?: string; convRef?: string; merciStatut: { notIn: string[] } };
        data: Ligne;
      }) => {
        const cibles = bd.contacts.filter(
          (c) =>
            (where.emailKey === undefined || c.emailKey === where.emailKey) &&
            (where.convRef === undefined || c.convRef === where.convRef) &&
            !where.merciStatut.notIn.includes(String(c.merciStatut)),
        );
        for (const c of cibles) Object.assign(c, data);
        return { count: cibles.length };
      },
      delete: async () => {
        bd.suppressions++;
      },
      deleteMany: async () => {
        bd.suppressions++;
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: !bd.limiteRefusee }),
}));
vi.mock("@/server/email/opposition", () => ({
  enregistrerOppositionPourAdresse: async (email: string) => {
    if (bd.opposition.ok) bd.adressesOpposees.push(email);
    return bd.opposition;
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

import { POST } from "@/app/api/interne/oppositions-page-guide/route";
import { signerRequete } from "@/server/videos/signature";
import { hmacConversationRef } from "@/server/guides-reseau/origines";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const SECRET = "g".repeat(40);
const CHEMIN = "/api/interne/oppositions-page-guide";
const CONV = "c1_AbCdEf0123456789_-xyZQ";
const ADRESSE = "personne.secrete@exemple.test";
const valide = {
  schemaVersion: 1,
  cleIdempotence: "run_page_stop_0001",
  conv: CONV,
  reseau: "instagram",
  occurredAt: "2026-11-11T10:00:00.000Z",
};

function appel(
  corps: unknown = valide,
  opt: { secret?: string; brut?: string; chemin?: string } = {},
): Promise<Response> {
  const texte = opt.brut ?? JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
  const signature = signerRequete({
    secret: opt.secret ?? SECRET,
    horodatage,
    nonce,
    methode: "POST",
    chemin: opt.chemin ?? CHEMIN,
    corps: texte,
  });
  return POST(
    new NextRequest(`http://localhost${CHEMIN}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-axion-horodatage": horodatage,
        "x-axion-nonce": nonce,
        "x-axion-signature": signature,
      },
      body: texte,
    }),
  );
}
const contact = (o: Ligne = {}): Ligne => ({
  id: "k1",
  emailKey: hashEmailForLookup(ADRESSE),
  email: ADRESSE,
  convRef: hmacConversationRef(CONV),
  merciStatut: "a_envoyer",
  ...o,
});

const sorties: string[] = [];
beforeEach(() => {
  bd.contacts.length = bd.adressesOpposees.length = sorties.length = 0;
  bd.opposition = { ok: true, crmAverti: true };
  bd.suppressions = 0;
  bd.marques.length = 0;
  bd.marquePanne = false;
  bd.limiteRefusee = false;
  process.env.OPPOSITIONS_RESEAU_ENABLED = "true";
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET;
  delete process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT;
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      sorties.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
  }
});
afterEach(() => {
  expect(bd.suppressions).toBe(0);
  expect(sorties.join("\n")).not.toContain(ADRESSE);
  expect(sorties.join("\n")).not.toContain(CONV);
  vi.restoreAllMocks();
});

describe("authentification et interrupteur", () => {
  it("éteint → 503, rien n'est écrit", async () => {
    delete process.env.OPPOSITIONS_RESEAU_ENABLED;
    bd.contacts.push(contact());
    expect((await appel()).status).toBe(503);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
  });
  it("sans secret → 503", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    expect((await appel()).status).toBe(503);
  });
  it("mauvaise signature → 401, rien n'est écrit", async () => {
    bd.contacts.push(contact());
    expect((await appel(valide, { secret: "x".repeat(40) })).status).toBe(401);
    expect(bd.adressesOpposees).toHaveLength(0);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
  });
  it("secret des vidéos refusé (aucun repli)", async () => {
    process.env.VIDEOS_STUDIO_HMAC_SECRET = "v".repeat(40);
    expect((await appel(valide, { secret: "v".repeat(40) })).status).toBe(401);
  });
  it("débit dépassé → 429", async () => {
    bd.limiteRefusee = true;
    expect((await appel()).status).toBe(429);
  });
});

describe("corps strict", () => {
  it.each([
    ["adresse en plus", { ...valide, email: ADRESSE }],
    [
      "conv absente",
      { schemaVersion: 1, cleIdempotence: valide.cleIdempotence, reseau: "instagram" },
    ],
    ["conv mal formée", { ...valide, conv: "c1_court" }],
    ["conv sans préfixe", { ...valide, conv: "AbCdEf0123456789_-xyZQ" }],
    ["version inconnue", { ...valide, schemaVersion: 2 }],
    ["réseau inconnu", { ...valide, reseau: "myspace" }],
    ["clé trop courte", { ...valide, cleIdempotence: "a" }],
  ])("%s → 422, rien n'est écrit", async (_n, corps) => {
    bd.contacts.push(contact());
    const r = await appel(corps);
    expect(r.status).toBe(422);
    expect(bd.adressesOpposees).toHaveLength(0);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
  });
  it("JSON invalide → 422", async () => {
    expect((await appel(null, { brut: "{pas du json" })).status).toBe(422);
  });
});

describe("effet : l'opposition l'emporte, rien n'est supprimé", () => {
  it("référence connue : adresse écartée des envois, contact écarté, 200 sans adresse", async () => {
    bd.contacts.push(contact());
    const r = await appel();
    expect(r.status).toBe(200);
    const texte = JSON.stringify(await r.json());
    expect(texte).not.toContain(ADRESSE);
    expect(JSON.parse(texte)).toEqual({ ok: true, type: "opposition", recue: true });
    expect(bd.adressesOpposees).toEqual([ADRESSE]);
    expect(bd.contacts[0]!.merciStatut).toBe("ecarte");
  });
  it("rejeu (même corps) : même réponse, aucune suppression", async () => {
    bd.contacts.push(contact());
    expect((await appel()).status).toBe(200);
    expect((await appel()).status).toBe(200);
    expect(bd.contacts).toHaveLength(1);
  });
  it("référence inconnue : réponse identique (200), la MARQUE de la référence est écrite, aucun contact touché", async () => {
    bd.contacts.push(contact({ convRef: "autre" }));
    const r = await appel();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, type: "opposition", recue: true });
    expect(bd.adressesOpposees).toHaveLength(0);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
    expect(bd.marques).toEqual([hmacConversationRef(CONV)]);
  });
  it("référence inconnue ou connue : exactement la même réponse HTTP (statut, corps)", async () => {
    const inconnue = await appel();
    const corpsInconnue = await inconnue.json();
    bd.contacts.push(contact());
    const connue = await appel();
    expect(connue.status).toBe(inconnue.status);
    expect(await connue.json()).toEqual(corpsInconnue);
  });
  it("deux STOP successifs : une seule ligne de marque", async () => {
    expect((await appel()).status).toBe(200);
    expect((await appel()).status).toBe(200);
    expect(bd.marques).toHaveLength(1);
  });
  it("marque non écrite → 500 (le Studio renverra) et aucun contact n'est touché", async () => {
    bd.marquePanne = true;
    bd.contacts.push(contact());
    expect((await appel()).status).toBe(500);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
    expect(bd.adressesOpposees).toHaveLength(0);
  });
  it("la marque ne contient ni la référence brute ni l'adresse", async () => {
    bd.contacts.push(contact());
    await appel();
    expect(JSON.stringify(bd.marques)).not.toContain(CONV);
    expect(JSON.stringify(bd.marques)).not.toContain(ADRESSE);
  });
  it("marque d'adresse opposée (convRef « - ») jamais ciblée", async () => {
    bd.contacts.push(contact({ convRef: "-", emailKey: "-", email: null }));
    const r = await appel({ ...valide, conv: "c1_AbCdEf0123456789_-xyZQ" });
    expect(r.status).toBe(200);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
  });
  it("contact déjà écarté (graphie ancienne) : non réécrit", async () => {
    bd.contacts.push(contact({ merciStatut: "ecartee" }));
    expect((await appel()).status).toBe(200);
    expect(bd.contacts[0]!.merciStatut).toBe("ecartee");
  });
  it("opposition non enregistrée ou CRM non prévenu → 500 (le Studio renverra), contact NON écarté", async () => {
    bd.contacts.push(contact());
    bd.opposition = { ok: true, crmAverti: false };
    const r = await appel();
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain(ADRESSE);
    expect(bd.contacts[0]!.merciStatut).toBe("a_envoyer");
  });
  it("contact sans demande liée (pas d'adresse lisible) : écarté quand même par la référence", async () => {
    bd.contacts.push(contact({ email: null }));
    expect((await appel()).status).toBe(200);
    expect(bd.adressesOpposees).toHaveLength(0);
    expect(bd.contacts[0]!.merciStatut).toBe("ecarte");
  });
});
