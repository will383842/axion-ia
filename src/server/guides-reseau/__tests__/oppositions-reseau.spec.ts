// @vitest-environment node
//
// `POST /api/interne/oppositions-reseau` — « stop » écrit en message privé. Base EN MÉMOIRE,
// CRM et relances SIMULÉS, sans réseau, adresses de domaine réservé (.test). Aucune suppression.
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const { interdit, bd, limite } = vi.hoisted(() => {
  const bd = {
    oppositions: [] as Ligne[],
    appelsPrisma: 0,
    crm: [] as unknown[],
    relances: [] as unknown[],
    enqueueEmail: [] as unknown[],
    sentry: [] as unknown[],
    creerLeve: null as null | (() => Error),
    concurrent: false,
    n: 0,
    outbox: [] as Ligne[],
    crmPerd: false,
    suppressions: 0,
    cles: [] as string[],
    limiteRefusee: false,
    effacement: false,
    videes: 0,
    contacts: [] as Ligne[],
  };
  return {
    bd,
    limite: async (cle: string) => {
      bd.cles.push(cle);
      return { allowed: !bd.limiteRefusee };
    },
    interdit: async () => {
      bd.suppressions++;
      throw new Error("interdit : aucune suppression");
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactGuideReseau: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { emailKey: string; merciStatut: { notIn: string[] } };
        data: Ligne;
      }) => {
        const cibles = bd.contacts.filter(
          (c) =>
            c.emailKey === where.emailKey &&
            !where.merciStatut.notIn.includes(String(c.merciStatut)),
        );
        for (const c of cibles) Object.assign(c, data);
        return { count: cibles.length };
      },
      delete: interdit,
      deleteMany: interdit,
    },
    emailOpposition: {
      findUnique: async ({ where }: { where: Ligne }) => {
        bd.appelsPrisma++;
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
        const ok = (l: Ligne) =>
          Object.entries(where).every(([k, v]) =>
            v === null
              ? (l[k] ?? null) === null
              : typeof v === "object"
                ? (l[k] ?? null) !== null
                : l[k] === v,
          );
        const cibles = bd.oppositions.filter(ok);
        for (const l of cibles) Object.assign(l, data);
        return { count: cibles.length };
      },
      create: async ({ data }: { data: Ligne }) => {
        bd.appelsPrisma++;
        if (bd.creerLeve) throw bd.creerLeve();
        if (bd.concurrent) {
          // L'autre appel a posé la ligne entre notre lecture et notre création.
          bd.oppositions.push({ id: `o${++bd.n}`, ...data });
          throw p2002();
        }
        if (bd.oppositions.some((l) => l.emailHash === data.emailHash)) throw p2002();
        const ligne = { id: `o${++bd.n}`, ...data };
        bd.oppositions.push(ligne);
        return { id: ligne.id };
      },
      delete: interdit,
      deleteMany: interdit,
    },
    crmSyncOutbox: {
      findFirst: async ({ where }: { where: Ligne }) => {
        bd.appelsPrisma++;
        return bd.outbox.find((l) => l.subjectRef === where.subjectRef) ?? null;
      },
      delete: interdit,
      // Seul l'effacement (simulé par le scénario 4) vide la file ; jamais une opposition.
      deleteMany: async () => {
        if (!bd.effacement) return interdit();
        const n = bd.outbox.length;
        bd.outbox.length = 0;
        bd.videes += n;
        return { count: n };
      },
    },
    guideRequest: { delete: interdit, deleteMany: interdit },
    newsletterSubscriber: { delete: interdit, deleteMany: interdit },
    guideReseauReception: { delete: interdit, deleteMany: interdit },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (cle: string) => limite(cle) }));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: async (i: Ligne) => {
    bd.crm.push(i);
    // Comme enqueue.ts : une ligne par eventId (unicité), ou rien si la perte est silencieuse.
    if (bd.crmPerd) return;
    if (!bd.outbox.some((l) => l.eventId === i.eventId)) {
      bd.outbox.push({ eventId: i.eventId, subjectRef: i.subjectRef });
    }
  },
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: async (...a: unknown[]) => {
    bd.relances.push(a);
    return 0;
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.enqueueEmail.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (e: unknown, ctx: unknown) => bd.sentry.push([e, ctx]),
}));

import { POST } from "@/app/api/interne/oppositions-reseau/route";
import { signerRequete } from "@/server/videos/signature";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  enregistrerOpposition,
  enregistrerOppositionPourAdresse,
  jetonOpposition,
} from "@/server/email/opposition";

const SECRET = "g".repeat(40);
const CHEMIN = "/api/interne/oppositions-reseau";
const ADRESSE = "personne.secrete@exemple.test";
const PARTIE_LOCALE = "personne.secrete";
const CLE = "run_zernio_stop_0001";

const valide = {
  schemaVersion: 1,
  cleIdempotence: CLE,
  email: ADRESSE,
  motif: "stop",
  reseau: "instagram",
};

let dernierNonce = "";
function appel(
  corps: unknown = valide,
  opt: { secret?: string; chemin?: string; decalage?: number; brut?: string } = {},
): Promise<Response> {
  const texte = opt.brut ?? JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  dernierNonce = nonce;
  const horodatage = String(Math.floor(Date.now() / 1000) + (opt.decalage ?? 0));
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

const sorties: string[] = [];
import { afterEach } from "vitest";
afterEach(() => {
  // Aucun scénario ne supprime quoi que ce soit.
  expect(bd.suppressions).toBe(0);
});
beforeEach(() => {
  bd.oppositions.length = bd.crm.length = bd.relances.length = 0;
  bd.enqueueEmail.length = bd.sentry.length = 0;
  bd.appelsPrisma = 0;
  bd.outbox.length = bd.cles.length = bd.contacts.length = 0;
  bd.crmPerd = false;
  bd.suppressions = 0;
  bd.effacement = false;
  bd.videes = 0;
  bd.limiteRefusee = false;
  process.env.CRM_SYNC_ENABLED = "true";
  bd.creerLeve = null;
  bd.concurrent = false;
  bd.n = 0;
  sorties.length = 0;
  process.env.OPPOSITIONS_RESEAU_ENABLED = "true";
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET;
  delete process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT;
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      sorties.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
  }
});

describe("interrupteur et secret", () => {
  it.each([undefined, "1", "false", "TRUE", ""])(
    "interrupteur « %s » → 503, rien lu",
    async (v) => {
      if (v === undefined) delete process.env.OPPOSITIONS_RESEAU_ENABLED;
      else process.env.OPPOSITIONS_RESEAU_ENABLED = v;
      const r = await appel();
      expect(r.status).toBe(503);
      expect((await r.json()).erreur).toBe("reception_eteinte");
      expect(bd.appelsPrisma).toBe(0);
      expect(bd.crm).toHaveLength(0);
    },
  );

  it("sans secret → 503 reception_non_configuree", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_non_configuree");
    expect(bd.appelsPrisma).toBe(0);
  });

  it("secret de 31 caractères → 503", async () => {
    process.env.GUIDES_RESEAU_HMAC_SECRET = "x".repeat(31);
    expect((await appel(valide, { secret: "x".repeat(31) })).status).toBe(503);
    expect(bd.appelsPrisma).toBe(0);
  });

  it("seulement VIDEOS_STUDIO_HMAC_SECRET : AUCUN repli → 503", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect(bd.appelsPrisma).toBe(0);
  });
});

describe("débit", () => {
  it("la clé de débit commence par internal:oppositions-reseau:", async () => {
    await appel();
    expect(bd.cles.length).toBeGreaterThan(0);
    for (const c of bd.cles) expect(c.startsWith("internal:oppositions-reseau:")).toBe(true);
  });

  it("limite atteinte → 429 trop_de_requetes, aucun accès base", async () => {
    bd.limiteRefusee = true;
    const r = await appel();
    expect(r.status).toBe(429);
    expect((await r.json()).erreur).toBe("trop_de_requetes");
    expect(bd.appelsPrisma).toBe(0);
    expect(bd.crm).toHaveLength(0);
  });
});

describe("signature", () => {
  it("mauvaise signature → 401", async () => {
    expect((await appel(valide, { secret: "z".repeat(40) })).status).toBe(401);
    expect(bd.oppositions).toHaveLength(0);
  });
  it("horodatage hors fenêtre (> 300 s) → 401", async () => {
    expect((await appel(valide, { decalage: -400 })).status).toBe(401);
    expect(bd.oppositions).toHaveLength(0);
  });
  it("signature d'une autre route → 401", async () => {
    const r = await appel(valide, { chemin: "/api/interne/demandes-guide-reseau" });
    expect(r.status).toBe(401);
    expect(bd.oppositions).toHaveLength(0);
  });
  it("secret précédent accepté pendant une rotation", async () => {
    process.env.GUIDES_RESEAU_HMAC_SECRET = "n".repeat(40);
    process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT = SECRET;
    expect((await appel()).status).toBe(200);
  });
});

describe("opposition", () => {
  it("corps valide : une ligne source reseau-stop, CRM une fois, relances annulées", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, type: "opposition", recue: true });
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.oppositions[0]!.source).toBe("reseau-stop");
    expect(bd.crm).toHaveLength(1);
    expect(bd.relances).toHaveLength(1);
    expect(bd.enqueueEmail).toHaveLength(0);
  });

  it("rejeu (nouveau nonce, même clé) : 200 identique, une ligne, CRM non rappelé", async () => {
    const a = await appel();
    const b = await appel();
    expect(b.status).toBe(200);
    expect(await b.json()).toEqual(await a.json());
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.crm).toHaveLength(1);
  });

  it("adresse déjà écartée : 200 identique", async () => {
    const a = await appel({ ...valide, email: "autre@exemple.test" });
    const b = await appel();
    const c = await appel();
    expect(await c.json()).toEqual(await a.json());
    expect(await b.json()).toEqual({ ok: true, type: "opposition", recue: true });
  });

  it("adresse en majuscules et espaces : même empreinte", async () => {
    await appel();
    await appel({ ...valide, email: `  ${ADRESSE.toUpperCase()} ` });
    expect(bd.oppositions).toHaveLength(1);
  });

  it("deux appels simultanés (P2002 au second) : deux 200, une ligne", async () => {
    const premier = await appel();
    bd.oppositions.length = 0;
    bd.concurrent = true;
    const second = await appel();
    expect(premier.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await premier.json());
    expect(bd.oppositions).toHaveLength(1);
  });

  it("occurredAt valide ou hors fenêtre : accepté, jamais stocké", async () => {
    const r1 = await appel({ ...valide, occurredAt: new Date().toISOString() });
    const r2 = await appel({ ...valide, occurredAt: "2001-01-01T00:00:00.000Z" });
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(JSON.stringify(bd.oppositions)).not.toContain("2001");
  });
});

describe("opposition : contacts de la page guide mis à l'écart", () => {
  const cle = hashEmailForLookup(ADRESSE)!;
  const cleAutre = hashEmailForLookup("autre@exemple.test")!;
  const peupler = () =>
    bd.contacts.push(
      { id: "c1", emailKey: cle, merciStatut: "a_envoyer" },
      { id: "c2", emailKey: cle, merciStatut: "envoye" },
      { id: "c3", emailKey: cleAutre, merciStatut: "a_envoyer" },
      { id: "marque", emailKey: "-", merciStatut: "a_envoyer" },
    );
  const statuts = () => bd.contacts.map((c) => c.merciStatut);

  it("les contacts de l'adresse passent à ecarte ; autre adresse et marque '-' intactes ; zéro suppression", async () => {
    peupler();
    expect((await appel()).status).toBe(200);
    expect(statuts()).toEqual(["ecarte", "ecarte", "a_envoyer", "a_envoyer"]);
    expect(bd.contacts).toHaveLength(4);
    expect(bd.suppressions).toBe(0);
  });

  it("adresse inconnue : 200 identique, aucune ligne touchée", async () => {
    peupler();
    const r = await appel({ ...valide, email: "inconnue@exemple.test" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, type: "opposition", recue: true });
    expect(statuts()).toEqual(["a_envoyer", "envoye", "a_envoyer", "a_envoyer"]);
  });

  it("rejeu : aucun changement de plus", async () => {
    peupler();
    await appel();
    const apres = JSON.stringify(bd.contacts);
    expect((await appel()).status).toBe(200);
    expect(JSON.stringify(bd.contacts)).toBe(apres);
  });
});

describe("corps refusé (422)", () => {
  const cas: Array<[string, Ligne]> = [
    ["type demande_effacement", { ...valide, type: "demande_effacement" }],
    ["champ inconnu", { ...valide, surprise: "valeur-secrete-xyz" }],
    ["motif autre", { ...valide, motif: "effacement" }],
    ["réseau invalide", { ...valide, reseau: "myspace" }],
    ["adresse invalide", { ...valide, email: "pas-une-adresse" }],
    ["clé trop courte", { ...valide, cleIdempotence: "court" }],
  ];
  it.each(cas)("%s → 422 sans la valeur ni file d'e-mails", async (_n, corps) => {
    const r = await appel(corps);
    expect(r.status).toBe(422);
    const texte = await r.text();
    for (const v of ["valeur-secrete-xyz", "demande_effacement", "myspace", "pas-une-adresse"]) {
      if (JSON.stringify(corps).includes(v)) expect(texte).not.toContain(v);
    }
    expect(bd.oppositions).toHaveLength(0);
    expect(bd.enqueueEmail).toHaveLength(0);
    expect(bd.crm).toHaveLength(0);
  });

  it("un champ inconnu est nommé, jamais sa valeur", async () => {
    const r = await appel({ ...valide, surprise: "valeur-secrete-xyz" });
    const j = await r.json();
    expect(j.champs).toContain("surprise");
  });

  it("JSON invalide → 422", async () => {
    expect((await appel(null, { brut: "{pas du json" })).status).toBe(422);
  });

  it("corps de 5 Ko → 413", async () => {
    const r = await appel({ ...valide, remplissage: "a".repeat(5 * 1024) });
    expect(r.status).toBe(413);
    expect(bd.oppositions).toHaveLength(0);
  });
});

describe("aucune suppression (mocks delete/deleteMany qui lèvent « interdit »)", () => {
  it("tous les scénarios passent sans déclencher le moindre delete", async () => {
    const statuts = [
      (await appel()).status,
      (await appel()).status,
      (await appel({ ...valide, type: "demande_effacement" })).status,
    ];
    expect(statuts).toEqual([200, 200, 422]);
    expect(sorties.join("\n")).not.toContain("interdit");
  });
});

describe("aucune donnée de personne dans les sorties", () => {
  const verifier = () => {
    const tout = JSON.stringify([sorties, bd.sentry]) + dernierNonce;
    for (const interdite of [ADRESSE, PARTIE_LOCALE, "exemple.test", CLE]) {
      expect(tout).not.toContain(interdite);
    }
    expect(JSON.stringify([sorties, bd.sentry])).not.toContain(dernierNonce);
  };

  it("succès : seul l'événement structuré est journalisé", async () => {
    await appel();
    const evt = sorties.find((s) => s.includes("guides_reseau_opposition"));
    expect(JSON.parse(evt!)).toEqual({
      event: "guides_reseau_opposition",
      reseau: "instagram",
      motif: "stop",
    });
    verifier();
  });

  it("exception dont le message contient l'adresse", async () => {
    bd.creerLeve = () => new Error(`échec pour ${ADRESSE} clé ${CLE}`);
    const r = await appel();
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain(PARTIE_LOCALE);
    verifier();
  });

  it("exception levée par le CRM, message contenant l'adresse : 500, puis renvoi → 200", async () => {
    const crm = await import("@/server/crm-sync");
    vi.spyOn(crm, "syncNewsletterOptOutToCrm").mockRejectedValueOnce(
      new Error(`CRM refuse ${ADRESSE}`),
    );
    const r = await appel();
    expect(r.status).toBe(500);
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.relances).toHaveLength(1);
    verifier();
    const r2 = await appel();
    expect(r2.status).toBe(200);
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.outbox).toHaveLength(1);
    expect(bd.suppressions).toBe(0);
    verifier();
  });

  it("perte silencieuse du CRM : 500, puis renvoi → 200 avec une seule ligne en file", async () => {
    bd.crmPerd = true;
    expect((await appel()).status).toBe(500);
    expect(bd.oppositions).toHaveLength(1);
    expect(bd.relances).toHaveLength(1);
    bd.crmPerd = false;
    expect((await appel()).status).toBe(200);
    expect(bd.outbox).toHaveLength(1);
    expect(bd.crm).toHaveLength(2);
    expect((bd.crm[0] as Ligne).eventId).toBe((bd.crm[1] as Ligne).eventId);
    expect((bd.crm[0] as Ligne).subjectRef).toBe((bd.crm[1] as Ligne).subjectRef);
    expect(bd.suppressions).toBe(0);
    verifier();
  });

  it("Sentry : findUnique lève une erreur contenant l'adresse → 500, nom seul, ni adresse ni partie locale", async () => {
    const prisma = (await import("@/lib/prisma")).prisma as unknown as {
      emailOpposition: { findUnique: (...a: unknown[]) => unknown };
    };
    vi.spyOn(prisma.emailOpposition, "findUnique").mockRejectedValueOnce(
      new Error("échec " + ADRESSE),
    );
    const r = await appel();
    expect(r.status).toBe(500);
    expect(bd.sentry.length).toBeGreaterThan(0);
    const ctx = bd.sentry.map((x) => (x as unknown[])[0]);
    expect(ctx).toContainEqual({ name: "Error" });
    const tout = JSON.stringify(bd.sentry);
    expect(tout).not.toContain(ADRESSE);
    expect(tout).not.toContain(PARTIE_LOCALE);
    verifier();
  });

  it("enregistrement en échec (panne de base) -> 500 sans l'adresse", async () => {
    bd.creerLeve = () => new Error("panne");
    const r = await appel();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, erreur: "erreur_interne" });
    verifier();
  });
});

describe("🔴 RGPD — le CRM ne reçoit jamais l'adresse d'une personne purgée ou effacée", () => {
  const empreinte = () => hashEmailForLookup(ADRESSE)!;
  const jeton = () => jetonOpposition(ADRESSE);

  beforeEach(() => {
    process.env.AUTH_SECRET = "t".repeat(48);
  });

  it("(1) adresse déjà en base (ancienne ligne) → CRM non appelé, 200", async () => {
    bd.oppositions.push({ id: "o0", emailHash: empreinte(), source: "ancienne" });
    const r = await appel();
    expect(r.status).toBe(200);
    expect(bd.crm).toHaveLength(0);
    expect(bd.outbox).toHaveLength(0);
  });

  it("(2) attente ET interdit renseignées, file vide → CRM non appelé, aucune ligne créée", async () => {
    bd.oppositions.push({
      id: "o0",
      emailHash: empreinte(),
      crmEnAttenteDepuis: new Date(),
      crmInterditLe: new Date(),
    });
    await appel();
    expect(bd.crm).toHaveLength(0);
    expect(bd.outbox).toHaveLength(0);
  });

  it("(3) stop → ligne en file → purge des lignes sent → second stop → aucune nouvelle ligne", async () => {
    await appel();
    expect(bd.outbox).toHaveLength(1);
    expect(bd.oppositions[0]!.crmEnAttenteDepuis ?? null).toBeNull(); // remise à NULL
    bd.outbox.length = 0; // purge de rétention
    const r = await appel();
    expect(r.status).toBe(200);
    expect(bd.outbox).toHaveLength(0);
    expect(bd.crm).toHaveLength(1);
  });

  it("(4) stop CRM en échec → effacement → nouveau stop, lien, console : aucune ligne, CRM non rappelé", async () => {
    bd.crmPerd = true;
    expect((await appel()).status).toBe(500);
    expect(bd.oppositions[0]!.crmEnAttenteDepuis).toBeInstanceOf(Date);
    const appelsAvant = bd.crm.length;
    bd.effacement = true;
    const { eraseCrmOutboxForEmail } = await import("@/lib/rgpd-erase");
    await eraseCrmOutboxForEmail(ADRESSE);
    bd.effacement = false;
    expect(bd.oppositions[0]!.crmInterditLe).toBeInstanceOf(Date);
    bd.crmPerd = false;
    await appel();
    await enregistrerOpposition(jeton());
    await enregistrerOppositionPourAdresse(ADRESSE);
    expect(bd.crm).toHaveLength(appelsAvant);
    expect(JSON.stringify(bd.outbox)).not.toContain(ADRESSE);
    expect(bd.outbox).toHaveLength(0);
    expect(bd.oppositions).toHaveLength(1);
  });

  it("(5) opposition créée par la rétention puis clic sur le jeton → CRM non appelé", async () => {
    bd.oppositions.push({ id: "o0", emailHash: empreinte(), source: "desinscrit-retention" });
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, dejaOpposee: true });
    expect(bd.crm).toHaveLength(0);
  });

  it("(6) cas normal : CRM en échec → attente posée ; renvoi → même subjectRef/eventId, attente remise à NULL", async () => {
    bd.crmPerd = true;
    expect((await appel()).status).toBe(500);
    expect(bd.oppositions[0]!.crmEnAttenteDepuis).toBeInstanceOf(Date);
    bd.crmPerd = false;
    expect((await appel()).status).toBe(200);
    expect((bd.crm[0] as Ligne).eventId).toBe((bd.crm[1] as Ligne).eventId);
    expect((bd.crm[0] as Ligne).subjectRef).toBe((bd.crm[1] as Ligne).subjectRef);
    expect(bd.oppositions[0]!.crmEnAttenteDepuis ?? null).toBeNull();
  });
});
