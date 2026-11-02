// @vitest-environment node
//
// Lot PV-1 — `POST /api/interne/demandes-guide-reseau`. Base EN MÉMOIRE, transport e-mail
// SIMULÉ (aucun e-mail réel), DNS simulé. Les contraintes d'unicité de la vraie base sont
// rejouées (clé d'idempotence, nonce, couple adresse/aimant).
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
const egal = (l: Ligne, where: Ligne) => Object.entries(where).every(([k, v]) => l[k] === v);

const bd = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  abonnes: [] as Ligne[],
  journal: [] as Ligne[],
  preuves: [] as Ligne[],
  opposees: new Set<string>(),
  domaine: { verdict: "oui" as "oui" | "non" | "inconnu" },
  envois: [] as unknown[][],
  enfile: { reponse: { enqueued: true } as Record<string, unknown> },
  logs: { destinataire: 0, heure: 0 },
  echecFinal: false,
  n: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const c = where["emailKey_aimant"] as Ligne | undefined;
        return (
          bd.demandes.find((d) =>
            c ? d.emailKey === c.emailKey && d.aimant === c.aimant : egal(d, where),
          ) ?? null
        );
      },
      findUniqueOrThrow: async ({ where }: { where: Ligne }) => {
        const c = where["emailKey_aimant"] as Ligne;
        return bd.demandes.find((d) => d.emailKey === c.emailKey && d.aimant === c.aimant)!;
      },
      create: async ({ data }: { data: Ligne }) => {
        if (bd.demandes.some((d) => d.emailKey === data.emailKey && d.aimant === data.aimant))
          throw p2002();
        const l = { id: `d${++bd.n}`, ...data };
        bd.demandes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.demandes.find((d) => egal(d, where))!;
        Object.assign(l, data);
        return l;
      },
    },
    newsletterSubscriber: {
      findUnique: async ({ where }: { where: Ligne }) =>
        bd.abonnes.find((a) => egal(a, where)) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        if (bd.abonnes.some((a) => a.email === data.email)) throw p2002();
        const l = { id: `a${++bd.n}`, ...data };
        bd.abonnes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        Object.assign(
          bd.abonnes.find((a) => egal(a, where))!,
          data,
        );
        return {};
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const f = bd.abonnes.filter((a) =>
          Object.entries(where).every(([k, v]) =>
            v && typeof v === "object" && "in" in (v as Ligne)
              ? ((v as Ligne).in as unknown[]).includes(a[k])
              : a[k] === v,
          ),
        );
        f.forEach((a) => Object.assign(a, data));
        return { count: f.length };
      },
    },
    guideReseauReception: {
      findUnique: async ({ where }: { where: Ligne }) =>
        bd.journal.find((j) => egal(j, where)) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        if (
          bd.journal.some((j) => j.cleIdempotence === data.cleIdempotence || j.nonce === data.nonce)
        )
          throw p2002();
        bd.journal.push({ id: `j${++bd.n}`, recueLe: new Date(), ...data });
        return {};
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        if (bd.echecFinal && data.reponseStatut === 200) {
          bd.echecFinal = false; // une seule panne : l'enregistrement du catch passe
          throw new Error("panne du journal");
        }
        bd.journal.filter((j) => egal(j, where)).forEach((j) => Object.assign(j, data));
        return {};
      },
      deleteMany: async ({ where }: { where: Ligne }) => {
        const garde = bd.journal.filter((j) => !egal(j, where));
        const n = bd.journal.length - garde.length;
        bd.journal.splice(0, bd.journal.length, ...garde);
        return { count: n };
      },
    },
    emailLog: {
      count: async (a: { where: { recipient?: string } }) =>
        a.where.recipient ? bd.logs.destinataire : bd.logs.heure,
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/consents", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  recordConsentEvent: async (i: Ligne) => {
    bd.preuves.push(i);
    return true;
  },
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (e: string) => bd.opposees.has(e),
}));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => bd.domaine.verdict }));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return bd.enfile.reponse;
  },
}));
vi.mock("@/server/crm-sync", () => ({ syncNewsletterOptInToCrm: async () => undefined }));
vi.mock("@/server/crm-sync/exclusions", () => ({ estExclueDuCrm: () => true }));
vi.mock("@/server/crm-sync/inscription-lettre", () => ({ evenementInscriptionLettre: () => ({}) }));
vi.mock("@/server/notifications", () => ({ notify: async () => undefined }));

import { POST } from "@/app/api/interne/demandes-guide-reseau/route";
import { signerRequete, sha256Hex } from "@/server/videos/signature";
import { confirmerLettre } from "@/server/newsletter/confirmer";

const SECRET = "s".repeat(40);
const CHEMIN = "/api/interne/demandes-guide-reseau";
const ADRESSE = "personne@exemple.test";

const corpsBase = {
  schemaVersion: 1,
  cleIdempotence: "run_zernio_0001",
  email: ADRESSE,
  mot: "guide",
  reseau: "instagram",
  guide: "guide-ia",
  accord: "non_demande",
  versionTexteM1: "m1-brouillon-v1",
};

function appel(
  corps: Ligne | string = corpsBase,
  opt: { secret?: string; nonce?: string; horodatage?: number; type?: string } = {},
): Promise<Response> {
  const texte = typeof corps === "string" ? corps : JSON.stringify(corps);
  const nonce = opt.nonce ?? crypto.randomBytes(16).toString("hex");
  const horodatage = String(opt.horodatage ?? Math.floor(Date.now() / 1000));
  const signature = signerRequete({
    secret: opt.secret ?? SECRET,
    horodatage,
    nonce,
    methode: "POST",
    chemin: CHEMIN,
    corps: texte,
  });
  return POST(
    new NextRequest(`http://localhost${CHEMIN}`, {
      method: "POST",
      headers: {
        "content-type": opt.type ?? "application/json",
        "x-axion-horodatage": horodatage,
        "x-axion-nonce": nonce,
        "x-axion-signature": signature,
      },
      body: texte,
    }),
  );
}

beforeEach(() => {
  bd.demandes.length = bd.abonnes.length = bd.journal.length = bd.preuves.length = 0;
  bd.envois.length = 0;
  bd.opposees.clear();
  bd.domaine.verdict = "oui";
  bd.enfile.reponse = { enqueued: true };
  bd.logs.destinataire = bd.logs.heure = 0;
  bd.n = 0;
  process.env.GUIDES_RESEAU_ENABLED = "true";
  process.env.VIDEOS_SITE_ENABLED = "true";
  process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("porte d'entrée", () => {
  it("drapeau GUIDES_RESEAU_ENABLED éteint → 503, rien lu ni écrit", async () => {
    delete process.env.GUIDES_RESEAU_ENABLED;
    const r = await appel();
    expect(r.status).toBe(503);
    expect(bd.journal).toHaveLength(0);
    expect(bd.demandes).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
  });

  it("drapeau différent de « true » → 503 (défaut sûr)", async () => {
    process.env.GUIDES_RESEAU_ENABLED = "1";
    expect((await appel()).status).toBe(503);
  });

  it("signature fausse → 401, rien d'écrit", async () => {
    const r = await appel(corpsBase, { secret: "x".repeat(40) });
    expect(r.status).toBe(401);
    expect(bd.demandes).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
  });

  it("horodatage hors fenêtre (rejeu tardif) → 401", async () => {
    const r = await appel(corpsBase, { horodatage: Math.floor(Date.now() / 1000) - 3600 });
    expect(r.status).toBe(401);
  });

  it("corps invalide → 422 sans consommer la clé ; champ inconnu refusé", async () => {
    expect((await appel("pas du json")).status).toBe(422);
    const r = await appel({ ...corpsBase, intrus: 1 });
    expect(r.status).toBe(422);
    expect(bd.journal).toHaveLength(0);
  });

  it("« oui » sans version de la question M2 → 422 ; guide inconnu → 422", async () => {
    expect((await appel({ ...corpsBase, accord: "oui" })).status).toBe(422);
    expect((await appel({ ...corpsBase, guide: "autre-guide" })).status).toBe(422);
  });
});

describe("adresse", () => {
  it("domaine sans boîte e-mail → refusée (422), aucune ligne, clé rendue pour une correction", async () => {
    bd.domaine.verdict = "non";
    const r = await appel();
    expect(r.status).toBe(422);
    expect(((await r.json()) as Ligne).erreur).toBe("adresse_refusee");
    expect(bd.demandes).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
    expect(bd.journal).toHaveLength(0);
    bd.domaine.verdict = "oui";
    expect((await appel()).status).toBe(200);
  });

  it("DNS muet (« inconnu ») → la demande passe", async () => {
    bd.domaine.verdict = "inconnu";
    expect((await appel()).status).toBe(200);
  });
});

describe("la demande, la preuve et le guide", () => {
  it("crée la demande (message_prive, source mot-…:réseau), écrit `information`, envoie le guide", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.demandes[0]).toMatchObject({
      aimant: "guide-ia",
      origine: "message_prive",
      source: "mot-guide:instagram",
      version: "m1-brouillon-v1",
    });
    expect(bd.demandes[0]!.derniereDemandeFormulaireAt).toBeInstanceOf(Date);
    expect(bd.preuves).toHaveLength(1);
    expect(bd.preuves[0]).toMatchObject({
      action: "information",
      consentVersion: "m1-brouillon-v1",
    });
    expect(bd.envois).toHaveLength(1);
    expect(bd.envois[0]![0]).toBe("guide-ia-envoi");
    expect(bd.abonnes).toHaveLength(0);
  });

  it.each(["non", "non_demande", "oui"])(
    "guide envoyé quel que soit l'accord (%s)",
    async (accord) => {
      const r = await appel({ ...corpsBase, accord, versionTexteM2: "m2-brouillon-v1" });
      expect(r.status).toBe(200);
      expect(bd.envois).toHaveLength(1);
    },
  );

  it("la réponse et les journaux ne contiennent jamais l'adresse", async () => {
    const r = await appel({ ...corpsBase, accord: "oui", versionTexteM2: "m2-brouillon-v1" });
    expect(JSON.stringify(await r.json())).not.toContain(ADRESSE);
    expect(JSON.stringify(bd.journal)).not.toContain(ADRESSE);
    const sorties = [...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls];
    expect(JSON.stringify(sorties)).not.toContain(ADRESSE);
  });

  it("plafond atteint : la demande est gardée, le rattrapage la reprendra (200, guide « plafond »)", async () => {
    bd.logs.heure = 30;
    const r = await appel();
    expect(r.status).toBe(200);
    expect(((await r.json()) as Ligne).guide).toBe("plafond");
    expect(bd.envois).toHaveLength(0);
    expect(bd.demandes).toHaveLength(1);
  });

  it("3 e-mails déjà envoyés à cette adresse sur 24 h → rien de plus ne part", async () => {
    bd.logs.destinataire = 3;
    expect(((await (await appel()).json()) as Ligne).guide).toBe("limite-destinataire");
    expect(bd.envois).toHaveLength(0);
  });
});

describe("idempotence (clé = identifiant du run)", () => {
  it("même run, même corps → réponse rejouée, aucun second effet", async () => {
    const a = await appel();
    const b = await appel(); // autre nonce, même run
    expect(b.status).toBe(200);
    expect(b.headers.get("x-axion-rejeu")).toBe("1");
    expect(await b.json()).toEqual(await a.json());
    expect(bd.envois).toHaveLength(1);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
  });

  it("exception APRÈS la mise en file, puis nouvel appel → UN seul enqueueEmail (clé jamais libérée)", async () => {
    // Le journal plante UNE fois, à l'écriture de la réponse finale, après la mise en file.
    bd.echecFinal = true;
    const a = await appel();
    expect(a.status).toBe(200);
    expect(bd.envois).toHaveLength(1);
    expect(bd.journal).toHaveLength(1);
    expect(bd.journal[0]!.reponseStatut).toBe(200);
    const b = await appel();
    expect(b.headers.get("x-axion-rejeu")).toBe("1");
    expect(bd.envois).toHaveLength(1);
  });

  it("réservation reprise après 2 min : si la marque « e-mail en file » existe, rien n'est remis en file", async () => {
    bd.journal.push({
      id: "j0",
      cleIdempotence: corpsBase.cleIdempotence,
      nonce: "c".repeat(32),
      corpsSha256: sha256Hex(JSON.stringify(corpsBase)),
      reponseStatut: 0,
      reponseCorps: { marque: "email_en_file", ok: true, demandeId: "d1", guide: "en-file" },
      recueLe: new Date(Date.now() - 5 * 60_000),
    });
    const r = await appel();
    expect(r.status).toBe(200);
    expect(r.headers.get("x-axion-rejeu")).toBe("1");
    expect(bd.envois).toHaveLength(0);
    expect(bd.journal[0]).toMatchObject({ reponseStatut: 200 });
    expect(bd.journal[0]!.reponseCorps).not.toHaveProperty("marque");
  });

  it("réservation périmée SANS marque → reprise normale (un envoi)", async () => {
    bd.journal.push({
      id: "j0",
      cleIdempotence: corpsBase.cleIdempotence,
      nonce: "d".repeat(32),
      corpsSha256: sha256Hex(JSON.stringify(corpsBase)),
      reponseStatut: 0,
      reponseCorps: {},
      recueLe: new Date(Date.now() - 5 * 60_000),
    });
    expect((await appel()).status).toBe(200);
    expect(bd.envois).toHaveLength(1);
  });

  it("même run, corps différent → 409 cle_reutilisee", async () => {
    await appel();
    const r = await appel({ ...corpsBase, mot: "devis" });
    expect(r.status).toBe(409);
    expect(((await r.json()) as Ligne).erreur).toBe("cle_reutilisee");
  });

  it("même nonce pour un autre run → 409 nonce_reutilise (anti-rejeu)", async () => {
    const nonce = "a".repeat(32);
    await appel(corpsBase, { nonce });
    const r = await appel({ ...corpsBase, cleIdempotence: "run_zernio_0002" }, { nonce });
    expect(r.status).toBe(409);
    expect(((await r.json()) as Ligne).erreur).toBe("nonce_reutilise");
  });

  it("réservation encore fraîche (appel simultané) → 409 en_cours, aucun second effet", async () => {
    bd.journal.push({
      id: "j0",
      cleIdempotence: corpsBase.cleIdempotence,
      nonce: "b".repeat(32),
      corpsSha256: sha256Hex(JSON.stringify(corpsBase)),
      reponseStatut: 0,
      reponseCorps: {},
      recueLe: new Date(),
    });
    const r = await appel();
    expect(r.status).toBe(409);
    expect(bd.envois).toHaveLength(0);
  });

  it("deux runs pour la même adresse → une seule demande (une par personne et par aimant)", async () => {
    await appel();
    await appel({ ...corpsBase, cleIdempotence: "run_zernio_0002" });
    expect(bd.demandes).toHaveLength(1);
  });
});

describe("accord : double accord", () => {
  const OUI = { ...corpsBase, accord: "oui", versionTexteM2: "m2-brouillon-v1" };

  it("« Oui » → inscription `pending` (jamais confirmed), aucune ligne `optin` à ce stade", async () => {
    const r = await appel(OUI);
    expect(((await r.json()) as Ligne).accord).toBe("oui_en_attente_de_clic");
    expect(bd.abonnes).toHaveLength(1);
    expect(bd.abonnes[0]).toMatchObject({
      status: "pending",
      consentFormRef: "newsletter-reseau-message-prive",
      consentVersion: "m2-brouillon-v1",
      source: "mot-guide:instagram",
    });
    expect(bd.preuves.map((p) => p.action)).toEqual(["information"]);
  });

  it("« Non » / non demandé → aucune inscription", async () => {
    await appel({ ...corpsBase, accord: "non" });
    await appel({ ...corpsBase, cleIdempotence: "run_zernio_0002", accord: "non_demande" });
    expect(bd.abonnes).toHaveLength(0);
  });

  it("l'e-mail du guide porte le bloc de confirmation (jeton du double accord)", async () => {
    await appel(OUI);
    const payload = bd.envois[0]![3] as Ligne;
    expect(payload.doubleAccordToken).toBe(bd.abonnes[0]!.confirmToken);
    expect(payload.downloadToken).toBeTruthy();
  });

  it("sans clic de confirmation : jamais d'abonnement confirmé ; après le clic : confirmed + `optin`", async () => {
    await appel(OUI);
    expect(bd.abonnes[0]!.status).toBe("pending");
    const jeton = bd.abonnes[0]!.confirmToken as string;
    const c = await confirmerLettre(jeton, { maintenant: new Date() });
    expect(c.ok).toBe(true);
    expect(bd.abonnes[0]).toMatchObject({ status: "confirmed", confirmToken: null });
    expect(bd.preuves.map((p) => p.action)).toEqual(["information", "optin"]);
    expect(bd.preuves[1]).toMatchObject({
      formRef: "newsletter-reseau-message-prive",
      consentVersion: "m2-brouillon-v1",
    });
  });

  it("adresse OPPOSÉE avec une ligne `pending` réseau existante → l'e-mail ne porte PAS le bouton", async () => {
    bd.abonnes.push({
      id: "a0",
      email: ADRESSE,
      status: "pending",
      confirmToken: "t".repeat(40),
      unsubscribeToken: "u".repeat(40),
      consentFormRef: "newsletter-reseau-message-prive",
    });
    bd.opposees.add(ADRESSE);
    const r = await appel(OUI);
    expect(((await r.json()) as Ligne).accord).toBe("ecarte");
    expect(bd.envois).toHaveLength(1);
    expect((bd.envois[0]![3] as Ligne).doubleAccordToken).toBeUndefined();
  });

  it("accord « non » avec une ligne `pending` réseau existante → l'e-mail ne porte PAS le bouton", async () => {
    bd.abonnes.push({
      id: "a0",
      email: ADRESSE,
      status: "pending",
      confirmToken: "t".repeat(40),
      unsubscribeToken: "u".repeat(40),
      consentFormRef: "newsletter-reseau-message-prive",
    });
    await appel({ ...corpsBase, accord: "non" });
    expect(bd.envois).toHaveLength(1);
    expect((bd.envois[0]![3] as Ligne).doubleAccordToken).toBeUndefined();
  });

  it("confirmerLettre refuse une adresse opposée (jeton pending valide)", async () => {
    await appel(OUI);
    bd.opposees.add(ADRESSE);
    const c = await confirmerLettre(bd.abonnes[0]!.confirmToken as string, {
      maintenant: new Date(),
    });
    expect(c.ok).toBe(false);
    expect(bd.abonnes[0]!.status).toBe("pending");
    expect(bd.preuves.map((p) => p.action)).toEqual(["information"]);
  });

  it("adresse déjà abonnée → rien ne change", async () => {
    bd.abonnes.push({
      id: "a0",
      email: ADRESSE,
      status: "confirmed",
      unsubscribeToken: "u".repeat(40),
    });
    const r = await appel(OUI);
    expect(((await r.json()) as Ligne).accord).toBe("oui_deja_confirme");
    expect(bd.abonnes).toHaveLength(1);
    expect(bd.abonnes[0]!.status).toBe("confirmed");
  });
});

describe("opposition respectée", () => {
  it("adresse opposée : le guide part, aucune inscription, aucune suppression", async () => {
    bd.opposees.add(ADRESSE);
    const r = await appel({ ...corpsBase, accord: "oui", versionTexteM2: "m2-brouillon-v1" });
    expect(r.status).toBe(200);
    expect(((await r.json()) as Ligne).accord).toBe("ecarte");
    expect(bd.abonnes).toHaveLength(0);
    expect(bd.envois).toHaveLength(1);
    expect((bd.envois[0]![3] as Ligne).doubleAccordToken).toBeUndefined();
    expect(bd.demandes).toHaveLength(1);
  });

  it("désabonnée : un « Oui » ne lève pas son désabonnement", async () => {
    bd.abonnes.push({ id: "a0", email: ADRESSE, status: "unsubscribed", confirmToken: null });
    const r = await appel({ ...corpsBase, accord: "oui", versionTexteM2: "m2-brouillon-v1" });
    expect(((await r.json()) as Ligne).accord).toBe("ecarte");
    expect(bd.abonnes[0]!.status).toBe("unsubscribed");
    expect(bd.envois).toHaveLength(1);
  });
});

describe("drapeau, secret et débit propres à la route (COR-INT-A)", () => {
  const SECRET_GUIDES = "g".repeat(40);

  it("ne dépend plus de VIDEOS_SITE_ENABLED : vidéos éteintes, guides allumés → 200", async () => {
    delete process.env.VIDEOS_SITE_ENABLED;
    expect((await appel()).status).toBe(200);
  });

  it("drapeau guides éteint : réponse neutre identique, vidéos allumées ou non", async () => {
    delete process.env.GUIDES_RESEAU_ENABLED;
    const a = await appel();
    delete process.env.VIDEOS_SITE_ENABLED;
    const b = await appel();
    expect(a.status).toBe(503);
    expect(b.status).toBe(503);
    expect(await a.text()).toBe(await b.text());
  });

  it("GUIDES_RESEAU_HMAC_SECRET propre : il prime, le secret des vidéos n'ouvre plus la route", async () => {
    process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET_GUIDES;
    try {
      expect((await appel(corpsBase, { secret: SECRET })).status).toBe(401);
      expect((await appel(corpsBase, { secret: SECRET_GUIDES })).status).toBe(200);
    } finally {
      delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    }
  });

  it("repli documenté : sans secret propre, le secret des vidéos signe encore", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    expect((await appel()).status).toBe(200);
  });

  it("aucun secret du tout → 503 reception_non_configuree", async () => {
    delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect(((await r.json()) as Ligne).erreur).toBe("reception_non_configuree");
  });

  it("base factice du build (stub.invalid) → 503 base_indisponible", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await appel();
    expect(r.status).toBe(503);
    expect(((await r.json()) as Ligne).erreur).toBe("base_indisponible");
  });
});
