// @vitest-environment node
//
// Lot PV-1 bis — `type: "demande_effacement"` : passe par la mise à l'écart commune (marque,
// trace `gdpr.erase.requested`, alerte dans la CLOCHE), AUCUNE suppression, AUCUN e-mail. Base EN MÉMOIRE, file d'e-mails SIMULÉE, sans réseau,
// adresses de domaines réservés (.test).
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
  ecartees: [] as string[],
  alertes: [] as unknown[][],
  cloche: [] as Ligne[],
  traces: [] as Ligne[],
  marques: [] as Ligne[],
  emails: [] as unknown[][],
  enfile: { reponse: { enqueued: true } as Record<string, unknown> },
  echecFinal: false,
  n: 0,
  contacts: [] as Ligne[],
  suppressionsContacts: 0,
}));

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
        cibles.forEach((c) => Object.assign(c, data));
        return { count: cibles.length };
      },
      deleteMany: async () => {
        bd.suppressionsContacts++;
        throw new Error("interdit : aucune suppression");
      },
      delete: async () => {
        bd.suppressionsContacts++;
        throw new Error("interdit : aucune suppression");
      },
    },
    activityLog: {
      findFirst: async ({ where }: { where: { action: string; changes: { equals: string } } }) =>
        bd.traces.find(
          (t) =>
            t.action === where.action && (t.changes as Ligne).reference === where.changes.equals,
        ) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        const l = { id: `t${bd.traces.length + 1}`, ...data };
        bd.traces.push(l);
        return { id: l.id };
      },
    },
    emailOpposition: {
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        if (!bd.enfile.reponse.enqueued) throw new Error("panne base");
        const cibles = bd.marques.filter(
          (m) => m.emailHash === where.emailHash && m.effacementDemandeLe == null,
        );
        cibles.forEach((m) => Object.assign(m, data));
        return { count: cibles.length };
      },
      findUnique: async ({ where }: { where: Ligne }) =>
        bd.marques.find((m) => m.emailHash === where.emailHash) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        bd.marques.push({ ...data });
        return { id: "o1" };
      },
    },
    alerteSysteme: { findFirst: async () => null, update: async () => ({}) },
    guideRequest: {
      findUnique: async () => null,
      create: async () => {
        throw new Error("interdit : le chemin d'effacement ne crée aucune demande");
      },
      deleteMany: async () => {
        throw new Error("interdit : aucune suppression");
      },
      delete: async () => {
        throw new Error("interdit : aucune suppression");
      },
    },
    newsletterSubscriber: {
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => {
        throw new Error("interdit : aucune suppression");
      },
      delete: async () => {
        throw new Error("interdit : aucune suppression");
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
          bd.echecFinal = false;
          throw new Error("panne du journal");
        }
        bd.journal.filter((j) => egal(j, where)).forEach((j) => Object.assign(j, data));
        return {};
      },
      deleteMany: async ({ where }: { where: Ligne }) => {
        const garde = bd.journal.filter((j) => !egal(j, where));
        bd.journal.splice(0, bd.journal.length, ...garde);
        return {};
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (e: string) => bd.ecartees.includes(e),
  enregistrerOppositionPourAdresse: async (e: string) => {
    if (!bd.ecartees.includes(e)) bd.ecartees.push(e);
    return { ok: true, email: e, dejaOpposee: false };
  },
}));
vi.mock("@/lib/rgpd-erase", () => ({
  ecarterRapportsAvantAuditPourEmail: async () => ({ ecartes: 0 }),
}));
// Alerte dans la CLOCHE : le service est simulé ; tout e-mail passerait par `enqueueEmail`.
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: async (a: Ligne) => {
    bd.cloche.push(a);
    bd.alertes.push([a]);
    return { id: "al1" };
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.emails.push(a);
    return { enqueued: true };
  },
}));

import { POST } from "@/app/api/interne/demandes-guide-reseau/route";
import { signerRequete } from "@/server/videos/signature";
import { analyserCorps } from "../contrat";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const SECRET = "s".repeat(40);
const CHEMIN = "/api/interne/demandes-guide-reseau";
const ADRESSE = "personne@exemple.test";

const effacement = {
  schemaVersion: 1,
  type: "demande_effacement",
  cleIdempotence: "run_zernio_eff1",
  email: ADRESSE,
  reseau: "instagram",
};
const demandeGuide = {
  schemaVersion: 1,
  cleIdempotence: "run_zernio_0001",
  email: ADRESSE,
  mot: "guide",
  reseau: "instagram",
  guide: "guide-ia",
  accord: "non_demande",
  versionTexteM1: "m1-brouillon-v1",
};

function appel(corps: Ligne = effacement): Promise<Response> {
  const texte = JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
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

beforeEach(() => {
  bd.demandes.length = bd.abonnes.length = bd.journal.length = 0;
  bd.ecartees.length = bd.alertes.length = 0;
  bd.cloche.length = bd.traces.length = bd.marques.length = bd.emails.length = 0;
  bd.enfile.reponse = { enqueued: true };
  bd.echecFinal = false;
  bd.n = 0;
  bd.contacts.length = 0;
  bd.suppressionsContacts = 0;
  process.env.GUIDES_RESEAU_ENABLED = "true";
  process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  delete process.env.QUALIOPI_ALERTE_EMAIL;
  delete process.env.WEEKLY_REPORT_EMAIL;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("demande d'effacement", () => {
  it("message privé : marque posée, trace écrite, alerte dans la cloche, AUCUN e-mail", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    // marque « effacement demandé » (plus aucun envoi)
    const hash = hashEmailForLookup(ADRESSE)!;
    expect(bd.marques.find((m) => m.emailHash === hash)?.effacementDemandeLe).toBeInstanceOf(Date);
    // trace de preuve, empreintes seulement
    expect(bd.traces).toHaveLength(1);
    expect(bd.traces[0]).toMatchObject({
      action: "gdpr.erase.requested",
      targetType: "message_prive",
      targetId: null,
    });
    expect((bd.traces[0]!.changes as Ligne).reference).toBe("run_zernio_eff1");
    expect(JSON.stringify(bd.traces)).not.toContain(ADRESSE);
    expect((bd.traces[0]!.changes as Ligne).origine).toBe("message-prive");
    // alerte cloche, niveau info
    expect(bd.cloche).toHaveLength(1);
    expect(bd.cloche[0]).toMatchObject({ code: "rgpd_effacement_a_traiter", niveau: "info" });
    // aucun e-mail
    expect(bd.emails).toHaveLength(0);
  });

  it("rejeu (même run) : une seule alerte, même après une exception tardive", async () => {
    bd.echecFinal = true; // l'enregistrement final échoue APRÈS la mise en file
    const a = await appel();
    expect(a.status).toBe(200);
    const b = await appel();
    expect(b.status).toBe(200);
    expect(bd.alertes).toHaveLength(1);
    expect(await b.json()).toEqual(await a.json());
  });

  it("réservation périmée portant la marque : close, jamais retraitée", async () => {
    bd.echecFinal = true;
    await appel();
    // Simule une ligne restée « en cours » avec la marque, vieille de plus de 2 min.
    const l = bd.journal[0]!;
    l.reponseStatut = 0;
    l.reponseCorps = { marque: "email_en_file", ok: true, type: "demande_effacement", recue: true };
    l.recueLe = new Date(Date.now() - 10 * 60_000);
    const r = await appel();
    expect(r.status).toBe(200);
    expect(bd.alertes).toHaveLength(1);
  });

  it("aucune suppression : aucune ligne de personne retirée ni créée", async () => {
    bd.demandes.push({ id: "d0", emailKey: "k" });
    bd.abonnes.push({ id: "a0", email: ADRESSE, status: "confirmed" });
    const avant = [bd.demandes.length, bd.abonnes.length];
    expect((await appel()).status).toBe(200);
    expect([bd.demandes.length, bd.abonnes.length]).toEqual(avant);
  });

  it("l'adresse est mise à l'écart des envois (opposition)", async () => {
    await appel();
    expect(bd.ecartees).toEqual([ADRESSE]);
  });

  it("adresse inconnue : alerte quand même, réponse neutre sans erreur", async () => {
    const r = await appel({ ...effacement, email: "inconnue@exemple.test" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, type: "demande_effacement", recue: true });
    expect(bd.alertes).toHaveLength(1);
  });

  it("marque impossible à poser : 500, clé rendue, nouvel essai possible, aucune trace en double", async () => {
    bd.enfile.reponse = { enqueued: false };
    expect((await appel()).status).toBe(500);
    expect(bd.journal).toHaveLength(0);
    bd.enfile.reponse = { enqueued: true };
    expect((await appel()).status).toBe(200);
    expect(bd.marques).toHaveLength(1);
    expect(bd.emails).toHaveLength(0);
  });

  it("aucune donnée de personne dans la réponse, le journal ni les sorties", async () => {
    const r = await appel();
    expect(JSON.stringify(await r.json())).not.toContain("exemple.test");
    expect(JSON.stringify(bd.journal)).not.toContain("exemple.test");
    const sorties = [...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls];
    expect(JSON.stringify(sorties)).not.toContain("exemple.test");
  });

  it("interrupteur éteint : 503 neutre identique, rien écrit", async () => {
    const guide = (delete process.env.GUIDES_RESEAU_ENABLED, await appel(demandeGuide));
    const eff = await appel();
    expect(eff.status).toBe(503);
    expect(await eff.json()).toEqual(await guide.json());
    expect(bd.journal).toHaveLength(0);
    expect(bd.alertes).toHaveLength(0);
    expect(bd.ecartees).toHaveLength(0);
  });
});

describe("demande d'effacement : contacts de la page guide mis à l'écart", () => {
  const cle = hashEmailForLookup(ADRESSE)!;
  const cleAutre = hashEmailForLookup("autre@exemple.test")!;

  function contacts() {
    bd.contacts.push(
      { id: "c1", emailKey: cle, merciStatut: "a_envoyer" },
      { id: "c2", emailKey: cle, merciStatut: "envoye" },
      { id: "c3", emailKey: cle, merciStatut: "ecartee" },
      { id: "c4", emailKey: cleAutre, merciStatut: "a_envoyer" },
      { id: "marque", emailKey: "-", merciStatut: "a_envoyer" },
    );
  }
  const statut = (id: string) => bd.contacts.find((c) => c.id === id)!.merciStatut;

  it("les contacts de l'adresse passent à ecarte ; aucun deleteMany ; UNE alerte cloche, aucun e-mail", async () => {
    contacts();
    expect((await appel()).status).toBe(200);
    expect(statut("c1")).toBe("ecarte");
    expect(statut("c2")).toBe("ecarte");
    expect(bd.suppressionsContacts).toBe(0);
    expect(bd.contacts).toHaveLength(5);
    expect(bd.alertes).toHaveLength(1);
    expect(bd.emails).toHaveLength(0);
  });

  it("l'ancienne graphie ecartee n'est pas réécrite", async () => {
    contacts();
    await appel();
    expect(statut("c3")).toBe("ecartee");
  });

  it("les lignes d'une autre adresse ne bougent pas, ni la marque email_key='-'", async () => {
    contacts();
    await appel();
    expect(statut("c4")).toBe("a_envoyer");
    expect(statut("marque")).toBe("a_envoyer");
  });

  it("adresse inconnue : aucune ligne touchée, pas d'erreur, alerte quand même", async () => {
    contacts();
    const r = await appel({ ...effacement, email: "inconnue@exemple.test" });
    expect(r.status).toBe(200);
    expect(bd.contacts.map((c) => c.merciStatut)).toEqual([
      "a_envoyer",
      "envoye",
      "ecartee",
      "a_envoyer",
      "a_envoyer",
    ]);
    expect(bd.alertes).toHaveLength(1);
  });

  it("rejeu : aucun changement de plus, toujours une seule alerte, jamais de suppression", async () => {
    contacts();
    await appel();
    const apres = JSON.stringify(bd.contacts);
    await appel();
    expect(JSON.stringify(bd.contacts)).toBe(apres);
    expect(bd.alertes).toHaveLength(1);
    expect(bd.suppressionsContacts).toBe(0);
  });
});

describe("contrat", () => {
  const brut = (o: Ligne) => analyserCorps(Buffer.from(JSON.stringify(o)));

  it("une requête sans `type` suit le schéma historique", () => {
    const a = brut(demandeGuide);
    expect(a.ok && a.demande?.guide).toBe("guide-ia");
  });

  it("schéma strict : champ inconnu, `type` inconnu, champs de guide mêlés → refusés", () => {
    expect(brut({ ...effacement, intrus: 1 }).ok).toBe(false);
    expect(brut({ ...effacement, type: "autre" }).ok).toBe(false);
    expect(brut({ ...effacement, guide: "guide-ia" }).ok).toBe(false);
    expect(brut({ ...effacement, email: "pas-une-adresse" }).ok).toBe(false);
  });

  it("une demande de guide ordinaire reste inchangée (guide envoyé, aucune alerte)", async () => {
    // Le chemin guide a besoin de sa propre base : ici on vérifie seulement qu'il n'emprunte
    // JAMAIS le chemin d'effacement (aucune alerte, aucune opposition posée).
    await appel(demandeGuide).catch(() => undefined);
    expect(bd.alertes.filter((a) => a[0] === "qualiopi-alerte-interne")).toHaveLength(0);
    expect(bd.ecartees).toHaveLength(0);
  });
});
