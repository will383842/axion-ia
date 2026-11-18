// @vitest-environment node
//
// `POST /api/interne/oppositions-par-conv` — LECTURE seule : des conversations sont-elles opposées côté site ?
// Base simulée (trois tables lues, espions sur toute écriture), adresses fictives de domaine réservé.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const { bd } = vi.hoisted(() => ({
  bd: {
    marques: [] as string[],
    contacts: [] as Ligne[],
    adressesOpposees: [] as string[],
    lectures: 0,
    ecritures: 0,
    panne: null as null | "marques" | "contacts" | "adresses",
  },
}));

vi.mock("@/lib/prisma", () => {
  const ecriture = () => async () => {
    bd.ecritures++;
    return {};
  };
  const ecritures = {
    create: ecriture(),
    createMany: ecriture(),
    update: ecriture(),
    updateMany: ecriture(),
    upsert: ecriture(),
    delete: ecriture(),
    deleteMany: ecriture(),
  };
  return {
    prisma: {
      oppositionConvRef: {
        ...ecritures,
        findMany: async ({ where }: { where: { convRef: { in: string[] } } }) => {
          bd.lectures++;
          if (bd.panne === "marques") throw new Error("panne marques");
          return bd.marques
            .filter((m) => where.convRef.in.includes(m))
            .map((convRef) => ({ convRef }));
        },
      },
      contactGuideReseau: {
        ...ecritures,
        findMany: async ({ where }: { where: { convRef: { in: string[] } } }) => {
          bd.lectures++;
          if (bd.panne === "contacts") throw new Error("panne contacts");
          return bd.contacts.filter((c) => where.convRef.in.includes(String(c.convRef)));
        },
      },
      emailOpposition: {
        ...ecritures,
        findMany: async ({ where }: { where: { emailHash: { in: string[] } } }) => {
          bd.lectures++;
          if (bd.panne === "adresses") throw new Error("panne adresses");
          return bd.adressesOpposees
            .filter((h) => where.emailHash.in.includes(h))
            .map((emailHash) => ({ emailHash }));
        },
      },
      $executeRaw: async () => {
        bd.ecritures++;
        return 0;
      },
      $transaction: async () => {
        bd.ecritures++;
      },
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

import { POST } from "@/app/api/interne/oppositions-par-conv/route";
import { signerRequete } from "@/server/videos/signature";
import { hmacConversationRef } from "@/server/guides-reseau/origines";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const SECRET = "g".repeat(40);
const CHEMIN = "/api/interne/oppositions-par-conv";
const CONV_A = "c1_AbCdEf0123456789_-xyZQ";
const CONV_B = "c1_ZyXwVu9876543210_-aBcD";
const CONV_C = "c1_Qq1234567890abcdefGHIJ";
const ADRESSE = "personne.secrete@exemple.test";

function appel(
  corps: unknown,
  opt: { secret?: string; brut?: string; age?: number; requete?: string } = {},
): Promise<Response> {
  const texte = opt.brut ?? JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000) - (opt.age ?? 0));
  const signature = signerRequete({
    secret: opt.secret ?? SECRET,
    horodatage,
    nonce,
    methode: "POST",
    chemin: CHEMIN,
    corps: texte,
  });
  return POST(
    new NextRequest(`http://localhost${CHEMIN}${opt.requete ?? ""}`, {
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
const req = (convs: string[]) => ({ schemaVersion: 1, convs });
const contact = (conv: string, o: Ligne = {}): Ligne => ({
  convRef: hmacConversationRef(conv),
  emailKey: hashEmailForLookup(ADRESSE)!,
  merciStatut: "a_envoyer",
  ...o,
});
const conv = (r: unknown) => (r as { resultats: { conv: string; opposee: boolean }[] }).resultats;

const sorties: string[] = [];
beforeEach(() => {
  bd.marques.length = bd.contacts.length = bd.adressesOpposees.length = sorties.length = 0;
  bd.lectures = bd.ecritures = 0;
  bd.panne = null;
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
  expect(bd.ecritures).toBe(0);
  expect(sorties.join("\n")).not.toContain(ADRESSE);
  expect(sorties.join("\n")).not.toContain(CONV_A);
  expect(sorties.join("\n")).not.toContain(hmacConversationRef(CONV_A));
  vi.restoreAllMocks();
});

describe("interrupteur, signature, requête", () => {
  it("éteint → 503 et zéro lecture", async () => {
    delete process.env.OPPOSITIONS_RESEAU_ENABLED;
    bd.marques.push(hmacConversationRef(CONV_A));
    expect((await appel(req([CONV_A]))).status).toBe(503);
    expect(bd.lectures).toBe(0);
  });
  it("signature fausse → 401", async () => {
    expect((await appel(req([CONV_A]), { secret: "x".repeat(40) })).status).toBe(401);
    expect(bd.lectures).toBe(0);
  });
  it("horodatage périmé → 401", async () => {
    expect((await appel(req([CONV_A]), { age: 3600 })).status).toBe(401);
    expect(bd.lectures).toBe(0);
  });
  it("chaîne de requête → 400", async () => {
    const r = await appel(req([CONV_A]), { requete: "?a=1" });
    expect(r.status).toBe(400);
    expect((await r.json()).erreur).toBe("chaine_de_requete_refusee");
  });
  it("corps de plus de 4 Ko → 413", async () => {
    expect((await appel(null, { brut: " ".repeat(5000) })).status).toBe(413);
  });
});

describe("corps strict", () => {
  it("101 éléments → 422", async () => {
    const convs = Array.from({ length: 101 }, (_, i) => `c1_${String(i).padStart(22, "a")}`);
    const r = await appel(req(convs));
    expect(r.status).toBe(422);
    expect((await r.json()).erreur).toBe("schema_invalide");
    expect(bd.lectures).toBe(0);
  });
  it("100 éléments → 200", async () => {
    const convs = Array.from({ length: 100 }, (_, i) => `c1_${String(i).padStart(22, "a")}`);
    expect((await appel(req(convs))).status).toBe(200);
  });
  it("liste vide, doublon, forme fausse, autre version → 422", async () => {
    for (const c of [
      req([]),
      req([CONV_A, CONV_A]),
      req(["c1_court"]),
      { schemaVersion: 2, convs: [CONV_A] },
    ]) {
      const r = await appel(c);
      expect(r.status).toBe(422);
      expect((await r.json()).erreur).toBe("schema_invalide");
    }
    expect(bd.lectures).toBe(0);
  });
  it("clé en trop → 422 unknown_field avec la liste des champs", async () => {
    const r = await appel({ ...req([CONV_A]), extra: 1 });
    expect(r.status).toBe(422);
    const j = await r.json();
    expect(j.erreur).toBe("unknown_field");
    expect(j.champs).toEqual(["extra"]);
  });
  it("JSON invalide → 422 json_invalide", async () => {
    const r = await appel(null, { brut: "{pas du json" });
    expect(r.status).toBe(422);
    expect((await r.json()).erreur).toBe("json_invalide");
  });
});

describe("décision", () => {
  it("(a) marque oppositions_conv_ref → true ; inconnu → false ; même ordre", async () => {
    bd.marques.push(hmacConversationRef(CONV_B));
    const r = await appel(req([CONV_A, CONV_B]));
    expect(r.status).toBe(200);
    expect(conv(await r.json())).toEqual([
      { conv: CONV_A, opposee: false },
      { conv: CONV_B, opposee: true },
    ]);
  });
  it("(b) merci_statut écarté (toutes graphies lues) → true", async () => {
    const { MERCI_STATUTS_ECARTES_LUS } = await import("@/server/guides-reseau/merci-statut");
    expect(MERCI_STATUTS_ECARTES_LUS.length).toBeGreaterThan(0);
    for (const statut of MERCI_STATUTS_ECARTES_LUS) {
      bd.contacts.length = 0;
      bd.contacts.push(contact(CONV_A, { merciStatut: statut }));
      const r = await appel(req([CONV_A, CONV_B]));
      expect(conv(await r.json()).map((x) => x.opposee)).toEqual([true, false]);
    }
  });
  it("contact normal sans opposition → false", async () => {
    bd.contacts.push(contact(CONV_A));
    expect(conv(await (await appel(req([CONV_A]))).json())[0]!.opposee).toBe(false);
  });
  it("(c) adresse dans email_oppositions (effacement compris) → true", async () => {
    bd.contacts.push(contact(CONV_A), contact(CONV_C, { emailKey: "autre".padEnd(64, "0") }));
    bd.adressesOpposees.push(hashEmailForLookup(ADRESSE)!);
    const r = await appel(req([CONV_A, CONV_B, CONV_C]));
    expect(conv(await r.json()).map((x) => x.opposee)).toEqual([true, false, false]);
  });
  it("trois lectures groupées au plus", async () => {
    bd.contacts.push(contact(CONV_A));
    await appel(req([CONV_A, CONV_B, CONV_C]));
    expect(bd.lectures).toBe(3);
  });
});

describe("fermé", () => {
  for (const panne of ["marques", "contacts", "adresses"] as const) {
    it(`panne de lecture (${panne}) → 500, aucun résultat`, async () => {
      bd.panne = panne;
      bd.contacts.push(contact(CONV_A));
      const r = await appel(req([CONV_A, CONV_B]));
      expect(r.status).toBe(500);
      const j = await r.json();
      expect(j).toEqual({ ok: false, erreur: "erreur_interne" });
      expect(JSON.stringify(j)).not.toContain("opposee");
    });
  }
});

describe("lecture seule, journal, réponse", () => {
  it("aucune écriture (espions create/update/upsert/delete/$executeRaw)", async () => {
    bd.marques.push(hmacConversationRef(CONV_A));
    bd.contacts.push(contact(CONV_B));
    await appel(req([CONV_A, CONV_B]));
    expect(bd.ecritures).toBe(0);
  });
  it("journal : un seul événement {event, n}, réponse sans @ ni convRef", async () => {
    bd.marques.push(hmacConversationRef(CONV_A));
    bd.contacts.push(contact(CONV_B));
    const r = await appel(req([CONV_A, CONV_B]));
    const texte = JSON.stringify(await r.json());
    expect(texte).not.toContain("@");
    for (const c of [CONV_A, CONV_B]) expect(texte).not.toContain(hmacConversationRef(c));
    const evts = sorties.filter((s) => s.includes("guides_reseau_oppositions_par_conv"));
    expect(evts).toHaveLength(1);
    expect(JSON.parse(evts[0]!)).toEqual({ event: "guides_reseau_oppositions_par_conv", n: 2 });
    expect(sorties.join("\n")).not.toContain("@");
  });
});

describe("fixture v1 (recopiée dans le Studio)", () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, "fixtures", "oppositions-par-conv.v1.json"), "utf8"),
  ) as { requete: unknown; reponse: unknown };
  it("la requête est acceptée et la réponse est exactement celle de la fixture", async () => {
    bd.marques.push(hmacConversationRef(CONV_A));
    const r = await appel(f.requete);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(f.reponse);
  });
});
