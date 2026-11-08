// @vitest-environment node
//
// Scénarios de bout en bout autour de l'opposition reçue du Studio (« stop » en message privé).
// Complète `oppositions-reseau.spec.ts` (déjà : rejeu même clé, panne du CRM, champ inconnu,
// aucune suppression, effacement après opposition) : ici seulement les cas manquants.
// Base EN MÉMOIRE, file d'e-mails et CRM SIMULÉS, adresses de domaine réservé (.test).
// Ces scénarios décrivent le comportement attendu et passent tous : le rattrapage écarte
// désormais une adresse opposée (corrigé par la PR #1823), il n'y a donc plus aucun `it.fails`.
// Un test qui rougirait ici signale une régression du code du site, pas un cas connu.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const { bd, interdit } = vi.hoisted(() => {
  const bd = {
    oppositions: [] as Ligne[],
    demandes: [] as Ligne[],
    envois: [] as unknown[][],
    logs: { destinataire: 0, heure: 0 },
    outbox: [] as Ligne[],
    suppressions: 0,
    n: 0,
  };
  return {
    bd,
    interdit: async () => {
      bd.suppressions++;
      throw new Error("interdit : aucune suppression");
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: {
      findUnique: async ({ where }: { where: Ligne }) => {
        if (where.id !== undefined) {
          const l = bd.oppositions.find((x) => x.id === where.id);
          return l
            ? {
                crmEnAttenteDepuis: l.crmEnAttenteDepuis ?? null,
                crmInterditLe: l.crmInterditLe ?? null,
              }
            : null;
        }
        return bd.oppositions.find((l) => l.emailHash === where.emailHash) ?? null;
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const cibles = bd.oppositions.filter((l) =>
          Object.entries(where).every(([k, v]) =>
            v === null
              ? (l[k] ?? null) === null
              : typeof v === "object"
                ? (l[k] ?? null) !== null
                : l[k] === v,
          ),
        );
        for (const l of cibles) Object.assign(l, data);
        return { count: cibles.length };
      },
      create: async ({ data }: { data: Ligne }) => {
        if (bd.oppositions.some((l) => l.emailHash === data.emailHash)) throw p2002();
        const ligne = { id: `o${++bd.n}`, ...data };
        bd.oppositions.push(ligne);
        return { id: ligne.id };
      },
      delete: interdit,
      deleteMany: interdit,
    },
    crmSyncOutbox: {
      findFirst: async ({ where }: { where: Ligne }) =>
        bd.outbox.find((l) => l.subjectRef === where.subjectRef) ?? null,
      delete: interdit,
      deleteMany: interdit,
    },
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) => {
        if (where["emailKey_aimant"]) {
          const c = where["emailKey_aimant"] as Ligne;
          return (
            bd.demandes.find((d) => d.emailKey === c.emailKey && d.aimant === c.aimant) ?? null
          );
        }
        return bd.demandes.find((d) => d.id === where.id) ?? null;
      },
      findUniqueOrThrow: async ({ where }: { where: Ligne }) => {
        const c = where["emailKey_aimant"] as Ligne;
        return bd.demandes.find((d) => d.emailKey === c.emailKey && d.aimant === c.aimant)!;
      },
      findMany: async ({ where }: { where: Ligne }) => {
        const gte = (where.createdAt as { gte: Date; lte: Date }).gte;
        const lte = (where.createdAt as { gte: Date; lte: Date }).lte;
        const age = (where.OR as Array<{ queuedAt: null | { lt: Date } }>)[1]!.queuedAt as {
          lt: Date;
        };
        return bd.demandes.filter(
          (d) =>
            d.origine !== "admin" &&
            d.sentAt === null &&
            (d.createdAt as Date) >= gte &&
            (d.createdAt as Date) <= lte &&
            (d.queuedAt === null || (d.queuedAt as Date) < age.lt),
        );
      },
      create: async ({ data }: { data: Ligne }) => {
        if (bd.demandes.some((d) => d.emailKey === data.emailKey && d.aimant === data.aimant))
          throw p2002();
        const l = { id: `d${++bd.n}`, sentAt: null, queuedAt: null, sendCount: 0, ...data };
        bd.demandes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.demandes.find((d) => d.id === where.id)!;
        Object.assign(l, data);
        return l;
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const f = bd.demandes.filter((d) => d.id === where.id);
        f.forEach((d) => Object.assign(d, data));
        return { count: f.length };
      },
      delete: interdit,
      deleteMany: interdit,
    },
    emailLog: {
      count: async (a: { where: { recipient?: string } }) =>
        a.where.recipient ? bd.logs.destinataire : bd.logs.heure,
      findMany: async () => [],
    },
    emailOutbox: { count: async () => 0 },
    newsletterSubscriber: {
      findUnique: async () => null,
      updateMany: async () => ({ count: 0 }),
      delete: interdit,
      deleteMany: interdit,
    },
    guideReseauReception: { delete: interdit, deleteMany: interdit },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: async (i: Ligne) => {
    if (!bd.outbox.some((l) => l.eventId === i.eventId)) {
      bd.outbox.push({ eventId: i.eventId, subjectRef: i.subjectRef });
    }
  },
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: async () => 0,
}));
vi.mock("@/lib/consents", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  recordConsentEvent: async () => true,
}));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => "oui" }));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: async () => ({ retenu: false }),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

import { POST } from "@/app/api/interne/oppositions-reseau/route";
import { signerRequete } from "@/server/videos/signature";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { traiterDemande } from "@/server/guides-reseau/traitement";
import { rattraperGuides } from "@/server/guide-ia/rattrapage";
import { PLAFOND_HORAIRE_GUIDE } from "@/server/guide-ia/config";
import type { DemandeGuideReseau } from "@/server/guides-reseau/contrat";

const SECRET = "g".repeat(40);
const CHEMIN = "/api/interne/oppositions-reseau";
const ADRESSE = "personne.secrete@exemple.test";

const valide = {
  schemaVersion: 1,
  cleIdempotence: "run_zernio_stop_0001",
  email: ADRESSE,
  motif: "stop",
  reseau: "instagram",
};

function appel(
  corps: unknown = valide,
  opt: { nonce?: string; horodatage?: string } = {},
): Promise<Response> {
  const texte = JSON.stringify(corps);
  const nonce = opt.nonce ?? crypto.randomBytes(16).toString("hex");
  const horodatage = opt.horodatage ?? String(Math.floor(Date.now() / 1000));
  const signature = signerRequete({
    secret: SECRET,
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
        "content-type": "application/json",
        "x-axion-horodatage": horodatage,
        "x-axion-nonce": nonce,
        "x-axion-signature": signature,
      },
      body: texte,
    }),
  );
}

const demandeReseau = (email = ADRESSE): DemandeGuideReseau =>
  ({
    schemaVersion: 1,
    cleIdempotence: "run_zernio_0001",
    email,
    mot: "guide",
    reseau: "instagram",
    guide: "guide-ia",
    accord: "non_demande",
    versionTexteM1: "m1-brouillon-v1",
    locale: "fr",
  }) as unknown as DemandeGuideReseau;

// Rattrapage : la demande doit avoir plus de 5 min et moins de 7 jours.
const MAINTENANT = new Date();
const IL_Y_A_UN_JOUR = new Date(MAINTENANT.getTime() - 24 * 3_600_000);
const EMAIL_KEY = () => hashEmailForLookup(ADRESSE)!;

function ligneFormulaire(): Ligne {
  return {
    id: "d-formulaire",
    email: ADRESSE,
    emailKey: EMAIL_KEY(),
    aimant: "guide-ia",
    origine: "formulaire",
    source: "site",
    locale: "fr",
    downloadToken: "a".repeat(64),
    sendCount: 0,
    sentAt: null,
    queuedAt: null,
    createdAt: IL_Y_A_UN_JOUR,
  };
}

afterEach(() => {
  // Aucun scénario ne supprime quoi que ce soit.
  expect(bd.suppressions).toBe(0);
});

beforeEach(() => {
  bd.oppositions.length = bd.demandes.length = bd.envois.length = bd.outbox.length = 0;
  bd.logs.destinataire = bd.logs.heure = 0;
  bd.suppressions = 0;
  bd.n = 0;
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.OPPOSITIONS_RESEAU_ENABLED = "true";
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET;
  delete process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT;
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

describe("(a) rejeu", () => {
  // décision : l'idempotence par empreinte tient lieu d'anti-rejeu, comme reception.ts
  it("même nonce rejoué dans la fenêtre (même corps signé) → 200 identique, sans nouvel effet", async () => {
    const nonce = "c".repeat(32);
    const horodatage = String(Math.floor(Date.now() / 1000));
    const premier = await appel(valide, { nonce, horodatage });
    const second = await appel(valide, { nonce, horodatage });
    expect(premier.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await premier.json());
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.outbox).toHaveLength(1);
    expect(bd.suppressions).toBe(0);
  });

  it("même cleIdempotence, nouveau nonce → 200 identique, une seule ligne d'opposition", async () => {
    const a = await appel(valide, { nonce: "a".repeat(32) });
    const b = await appel(valide, { nonce: "b".repeat(32) });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await b.json()).toEqual(await a.json());
    expect(bd.oppositions).toHaveLength(1);
  });
});

describe("(b) doublon", () => {
  it("deux clés, même adresse en casse différente → une seule ligne, 200 deux fois", async () => {
    const a = await appel({ ...valide, cleIdempotence: "cle_stop_aaaaaaaa" });
    const b = await appel({
      ...valide,
      cleIdempotence: "cle_stop_bbbbbbbb",
      email: "Personne.Secrete@EXEMPLE.test",
    });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await b.json()).toEqual(await a.json());
    expect(bd.oppositions).toHaveLength(1);
  });
});

describe("(c) désordre — opposition et demandes du guide", () => {
  it("opposition puis demande du guide, même adresse → guide « opposee », aucun e-mail, aucune ligne", async () => {
    expect((await appel()).status).toBe(200);
    const r = await traiterDemande(demandeReseau(), MAINTENANT);
    expect(r).toMatchObject({ ok: true, guide: "opposee" });
    expect(bd.envois).toHaveLength(0);
    expect(bd.demandes).toHaveLength(0);
  });

  it("demande (réseau) → plafond horaire → opposition → rattrapage : aucun envoi", async () => {
    bd.logs.heure = PLAFOND_HORAIRE_GUIDE; // plafond atteint : la demande attend
    const d = await traiterDemande(demandeReseau(), IL_Y_A_UN_JOUR);
    expect(d).toMatchObject({ ok: true, guide: "plafond" });
    expect(bd.demandes).toHaveLength(1);
    expect(bd.demandes[0]!.origine).toBe("message_prive");
    expect(bd.envois).toHaveLength(0);

    expect((await appel()).status).toBe(200);

    bd.logs.heure = 0; // le plafond se relâche
    const rapport = await rattraperGuides(MAINTENANT);
    expect(rapport.relancees).toBe(0);
    expect(bd.envois).toHaveLength(0);
  });

  // Scénario RGPD :
  //   1. la personne a demandé le guide par le FORMULAIRE du site (ligne guide_requests,
  //      origine « formulaire », jamais envoyée) ;
  //   2. elle écrit ensuite « stop » en message privé d'un réseau → ligne email_oppositions ;
  //   3. le rattrapage horaire reprend la demande : il contrôle l'opposition quelle que soit
  //      l'origine, donc il écarte la ligne et ne met rien en file.
  it("🔴 ligne d'origine « formulaire » (non réécrite) + plafond + opposition + rattrapage → aucun envoi", async () => {
    bd.demandes.push(ligneFormulaire());
    bd.logs.heure = PLAFOND_HORAIRE_GUIDE;
    // La demande réseau retrouve la ligne existante : l'origine « formulaire » n'est pas réécrite.
    const d = await traiterDemande(demandeReseau(), IL_Y_A_UN_JOUR);
    expect(d).toMatchObject({ ok: true, nouvelle: false, guide: "plafond" });
    expect(bd.demandes[0]!.origine).toBe("formulaire");

    expect((await appel()).status).toBe(200);

    bd.logs.heure = 0;
    const rapport = await rattraperGuides(MAINTENANT);
    expect(rapport.ecartees).toBe(1);
    expect(bd.envois).toHaveLength(0);
  });
});

describe("(e) route éteinte ou mal configurée", () => {
  it("route éteinte → 503 avant toute lecture du corps (la requête n'est même pas touchée)", async () => {
    delete process.env.OPPOSITIONS_RESEAU_ENABLED;
    const intacte = new Proxy(
      {},
      {
        get() {
          throw new Error("la requête a été lue alors que la route est éteinte");
        },
      },
    ) as unknown as NextRequest;
    const r = await POST(intacte);
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_eteinte");
    expect(bd.oppositions).toHaveLength(0);
  });

  it("seulement VIDEOS_STUDIO_HMAC_SECRET posé → 503 reception_non_configuree", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_non_configuree");
    expect(bd.oppositions).toHaveLength(0);
  });
});
