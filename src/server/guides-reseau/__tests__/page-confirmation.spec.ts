// @vitest-environment node
//
// Lot S2 — `confirmerPageGuide` : la validation de la page « Recevoir le guide ».
// Base EN MÉMOIRE (contraintes d'unicité rejouées), transport e-mail SIMULÉ, DNS simulé.
// Données 100 % fictives (example.test).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

type Ligne = Record<string, unknown>;
const p2002 = (target?: string[] | string) =>
  Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    ...(target === undefined ? {} : { meta: { target } }),
  });
const egal = (l: Ligne, where: Ligne) => Object.entries(where).every(([k, v]) => l[k] === v);

const bd = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  abonnes: [] as Ligne[],
  contacts: [] as Ligne[],
  preuves: [] as Ligne[],
  opposees: new Set<string>(),
  domaine: { verdict: "oui" as "oui" | "non" | "inconnu" },
  envois: [] as unknown[][],
  limites: [] as string[],
  limiteAtteinte: false,
  logsDestinataire: 0,
  journal: [] as string[],
  n: 0,
  /** Origines écrites par `enregistrerOrigine` (historique v3). */
  origines: [] as Ligne[],
  /** Charges transmises au CRM (`transmettreOriginesV3`). */
  crm: [] as Ligne[],
  mxAppels: 0,
  /** Panne simulée de la mise en file de l'e-mail. */
  enfilePanne: false,
  /** Conflit simulé sur guide_requests : nombre de création qui échouent en P2002. */
  conflitDemande: { restant: 0, gagnante: false },
  /** Lectures `guideRequest.findUnique` faites DANS une transaction. */
  lecturesDansTransaction: 0,
  /** Suites inscrites dans `after()` (next/server), exécutées par `confirmerPageGuide` du test. */
  apres: [] as (() => unknown)[],
  /** Pannes simulées DANS la transaction (après l'écriture du contact et de la demande). */
  echecOrigine: false,
  echecPreuve: false,
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: (f: () => unknown) => {
    bd.apres.push(f);
  },
}));

/** Lignes créées par une transaction : retirées si elle échoue (comme PostgreSQL). */
type Trace = { contacts: Ligne[]; demandes: Ligne[]; origines: Ligne[]; preuves: Ligne[] };

function client(trace?: Trace) {
  const dansTransaction = trace !== undefined;
  return {
    $executeRaw: async () => 0,
    trace,
    consentEvent: {
      create: async ({ data }: { data: Ligne }) => {
        if (bd.echecPreuve) throw new Error("écriture de la preuve impossible");
        const l = { id: `p${++bd.n}`, ...data };
        bd.preuves.push(l);
        trace?.preuves.push(l);
        return l;
      },
    },
    contactGuideReseau: {
      create: async ({ data }: { data: Ligne }) => {
        // Le temps d'un tour : deux transactions simultanées se croisent vraiment.
        await new Promise((r) => setTimeout(r, 1));
        if (bd.contacts.some((c) => c.jetonEmpreinte === data.jetonEmpreinte))
          throw p2002(["jeton_empreinte"]);
        const l = { id: `c${++bd.n}`, ...data };
        bd.contacts.push(l);
        trace?.contacts.push(l);
        return l;
      },
      findUnique: async ({ where }: { where: Ligne }) =>
        bd.contacts.find((c) => egal(c, where)) ?? null,
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.contacts.find((c) => egal(c, where))!;
        Object.assign(l, data);
        return l;
      },
    },
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) => {
        if (dansTransaction) bd.lecturesDansTransaction += 1;
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
        if (bd.conflitDemande.restant > 0) {
          bd.conflitDemande.restant -= 1;
          // Une demande simultanée (formulaire /guide-ia) a gagné la course.
          if (bd.conflitDemande.gagnante) {
            // Créée par une AUTRE transaction (validée) : elle n'est pas dans la trace.
            bd.demandes.push({ id: `d${++bd.n}`, ...data, origine: "formulaire" });
          }
          throw p2002(["email_key", "aimant"]);
        }
        if (bd.demandes.some((d) => d.emailKey === data.emailKey && d.aimant === data.aimant))
          throw p2002(["email_key", "aimant"]);
        const l = { id: `d${++bd.n}`, ...data };
        bd.demandes.push(l);
        trace?.demandes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.demandes.find((d) => egal(d, where))!;
        Object.assign(l, data);
        return l;
      },
    },
  };
}

vi.mock("@/lib/prisma", () => {
  const base = client();
  return {
    prisma: {
      ...base,
      newsletterSubscriber: {
        create: async () => {
          throw new Error("newsletter_subscribers ne doit JAMAIS être écrite par ce parcours");
        },
        update: async () => {
          throw new Error("newsletter_subscribers ne doit JAMAIS être écrite par ce parcours");
        },
        upsert: async () => {
          throw new Error("newsletter_subscribers ne doit JAMAIS être écrite par ce parcours");
        },
      },
      emailLog: {
        count: async (a: { where: { recipient?: string } }) =>
          a.where.recipient ? bd.logsDestinataire : 0,
      },
      // Comme PostgreSQL : si la transaction échoue, rien de ce qu'elle a créé ne reste.
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const trace: Trace = { contacts: [], demandes: [], origines: [], preuves: [] };
        try {
          return await fn(client(trace));
        } catch (e) {
          for (const l of trace.contacts) bd.contacts.splice(bd.contacts.indexOf(l), 1);
          for (const l of trace.demandes) bd.demandes.splice(bd.demandes.indexOf(l), 1);
          for (const l of trace.origines) bd.origines.splice(bd.origines.indexOf(l), 1);
          for (const l of trace.preuves) bd.preuves.splice(bd.preuves.indexOf(l), 1);
          throw e;
        }
      },
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string) => {
    bd.limites.push(cle);
    return { allowed: !bd.limiteAtteinte };
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${Buffer.from(v).toString("base64")}`,
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (e: string) => bd.opposees.has(e),
}));
vi.mock("@/server/guide-ia/mx", () => ({
  domaineRecoitDesEmails: async () => {
    bd.mxAppels += 1;
    return bd.domaine.verdict;
  },
}));
vi.mock("../origines", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  // L'origine s'écrit DANS la transaction de la page (client `tx` reçu en premier argument).
  ecrireOrigineDansTransaction: async (tx: { trace?: Trace }, emailKey: string, o: Ligne) => {
    if (bd.echecOrigine) throw new Error("écriture de l'origine impossible");
    const l = { emailKey, ...o };
    bd.origines.push(l);
    tx.trace?.origines.push(l);
    return { creee: true, archivees: 0, total: 0 };
  },
}));
vi.mock("../synchro-v3", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  transmettreOriginesV3: async (a: Ligne) => {
    bd.crm.push(a);
    return "mise_en_file";
  },
}));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    if (bd.enfilePanne) throw new Error("redis indisponible");
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@/server/notifications", () => ({ notify: async () => undefined }));

import {
  confirmerPageGuide as confirmerSansSuite,
  PLANCHER_REPONSE_MS,
  type EntreeConfirmation,
} from "../page-confirmation";

/** Comme la production : la réponse part, PUIS les suites inscrites dans `after()` s'exécutent. */
async function viderApres(): Promise<void> {
  while (bd.apres.length > 0) await bd.apres.shift()!();
}
async function confirmerPageGuide(e: EntreeConfirmation) {
  const r = await confirmerSansSuite(e);
  await viderApres();
  return r;
}
import { creerJeton, empreinteJeton, type DonneesLien } from "../lien-page-guide";
import {
  EMPREINTE_CASE_PAGE_GUIDE,
  FORM_REF_PAGE_GUIDE,
  VERSION_CONSENTEMENT_PAGE_GUIDE,
} from "@/content/guides-reseau";

const SECRET = "L".repeat(40);
const MAINTENANT = new Date("2026-11-08T10:00:00.000Z");
const DONNEES: DonneesLien = {
  conv: "conv_exemple_0001",
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  compte: "page_principale",
  post_ref: "post_exemple_0001",
  version_m1: "m1-2026-11",
};
const ADRESSE = "personne@example.test";
const jeton = (d: Partial<DonneesLien> = {}, ms = MAINTENANT.getTime()) =>
  creerJeton({ ...DONNEES, ...d }, SECRET, ms);

function entree(o: Partial<EntreeConfirmation> = {}): EntreeConfirmation {
  return {
    jeton: jeton(),
    prenom: "Camille",
    email: ADRESSE,
    caseCochee: true,
    ip: "203.0.113.7",
    userAgent: "agent-exemple",
    secret: SECRET,
    maintenant: MAINTENANT,
    // Le plancher de durée a ses propres tests (horloge simulée) ; ailleurs, aucune attente.
    plancherMs: 0,
    ...o,
  };
}

function ecritures(): number {
  return bd.contacts.length + bd.demandes.length + bd.preuves.length + bd.envois.length;
}

beforeEach(() => {
  bd.demandes.length = bd.contacts.length = bd.preuves.length = bd.envois.length = 0;
  bd.limites.length = bd.journal.length = 0;
  bd.origines.length = bd.crm.length = 0;
  bd.mxAppels = 0;
  bd.apres.length = 0;
  bd.echecOrigine = bd.echecPreuve = false;
  bd.lecturesDansTransaction = 0;
  bd.enfilePanne = false;
  bd.conflitDemande.restant = 0;
  bd.conflitDemande.gagnante = false;
  bd.opposees.clear();
  bd.domaine.verdict = "oui";
  bd.limiteAtteinte = false;
  bd.logsDestinataire = 0;
  bd.n = 0;
  for (const m of ["warn", "error", "log", "info"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      bd.journal.push(a.map(String).join(" "));
    });
  }
});

describe("case de consentement", () => {
  it("case absente → 422, AUCUNE écriture, rien d'envoyé", async () => {
    const r = await confirmerPageGuide(entree({ caseCochee: false }));
    expect(r).toEqual({ ok: false, statut: 422, erreur: "case" });
    expect(ecritures()).toBe(0);
  });

  it("case du guide seule : aucune trace d'accord aux informations (colonnes vides, une seule preuve)", async () => {
    expect((await confirmerPageGuide(entree())).ok).toBe(true);
    const c = bd.contacts[0]!;
    expect(c.infosStatut).toBeUndefined(); // défaut de la base : 'aucune'
    expect(c.infosConsentiLe).toBeUndefined();
    expect(bd.preuves.map((p) => p.formRef)).toEqual(["guide-reseau-page"]);
  });

  it("case des informations cochée : enregistrée « non_transmise », avec sa propre preuve", async () => {
    expect((await confirmerPageGuide(entree({ infosCochee: true }))).ok).toBe(true);
    const c = bd.contacts[0]!;
    expect(c.infosStatut).toBe("non_transmise");
    expect(c.infosVersion).toBe("page-guide-infos-2026-11-11");
    expect(c.infosConsentiLe).toEqual(MAINTENANT);
    expect(bd.preuves.map((p) => p.formRef).sort()).toEqual([
      "guide-reseau-page",
      "guide-reseau-page-infos",
    ]);
  });

  it("case des informations seule, sans la case du guide → 422, AUCUNE écriture", async () => {
    const r = await confirmerPageGuide(entree({ caseCochee: false, infosCochee: true }));
    expect(r).toEqual({ ok: false, statut: 422, erreur: "case" });
    expect(ecritures()).toBe(0);
  });

  it("prénom vide, espaces seuls, ou plus de 50 caractères → 422 sans écriture", async () => {
    for (const prenom of ["", "   ", "x".repeat(51)]) {
      const r = await confirmerPageGuide(entree({ prenom }));
      expect(r).toEqual({ ok: false, statut: 422, erreur: "prenom" });
    }
    expect(ecritures()).toBe(0);
  });

  it("prénom de 1 et de 50 caractères accepté (bornes incluses)", async () => {
    expect((await confirmerPageGuide(entree({ prenom: "A" }))).ok).toBe(true);
    expect(
      (
        await confirmerPageGuide(
          entree({
            jeton: jeton({ conv: "conv_exemple_0002" }),
            prenom: "b".repeat(50),
            email: "autre@example.test",
          }),
        )
      ).ok,
    ).toBe(true);
  });

  it("adresse mal formée → 422 sans écriture", async () => {
    const r = await confirmerPageGuide(entree({ email: "pas-une-adresse" }));
    expect(r).toEqual({ ok: false, statut: 422, erreur: "email" });
    expect(ecritures()).toBe(0);
  });
});

describe("jeton", () => {
  it("falsifié (signature) → refus neutre « lien », aucune écriture", async () => {
    const [partie] = jeton().split(".");
    const faux = `${partie}.${Buffer.from("x".repeat(32)).toString("base64url")}`;
    expect(await confirmerPageGuide(entree({ jeton: faux }))).toEqual({
      ok: false,
      statut: 400,
      erreur: "lien",
    });
    expect(ecritures()).toBe(0);
  });

  it("expiré → même refus neutre que falsifié (la cause ne se lit jamais)", async () => {
    const vieux = jeton({}, MAINTENANT.getTime() - 8 * 24 * 3600 * 1000);
    const a = await confirmerPageGuide(entree({ jeton: vieux }));
    const [partie] = jeton().split(".");
    const b = await confirmerPageGuide(entree({ jeton: `${partie}.AAAA` }));
    expect(a).toEqual(b);
    expect(ecritures()).toBe(0);
  });

  it("secret du lien absent → refus neutre, rien d'écrit", async () => {
    const r = await confirmerPageGuide(entree({ secret: "" }));
    expect(r.ok).toBe(false);
    expect(ecritures()).toBe(0);
  });

  it("rejoué : le deuxième envoi ne crée rien et répond comme un succès neutre", async () => {
    const j = jeton();
    const premier = await confirmerPageGuide(entree({ jeton: j }));
    expect(premier).toEqual({ ok: true });
    const avant = ecritures();
    const second = await confirmerPageGuide(entree({ jeton: j, email: "autre@example.test" }));
    expect(second).toEqual({ ok: true });
    expect(ecritures()).toBe(avant);
    expect(bd.contacts).toHaveLength(1);
  });

  it("deux envois SIMULTANÉS du même jeton = une seule demande, un seul contact, un seul e-mail", async () => {
    const j = jeton();
    const [a, b] = await Promise.all([
      confirmerPageGuide(entree({ jeton: j })),
      confirmerPageGuide(entree({ jeton: j })),
    ]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(bd.contacts).toHaveLength(1);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.envois).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
  });
});

describe("M1 — suites après la réponse (after)", () => {
  it("adresse ordinaire : origine ET preuve sont écrites AVANT la réponse ; seul l'e-mail part après, le CRM jamais au POST", async () => {
    const r = await confirmerSansSuite(entree());
    expect(r).toEqual({ ok: true });
    expect(bd.origines).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
    expect(bd.contacts).toHaveLength(1);
    expect(bd.crm).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
    expect(bd.apres).toHaveLength(1);
    await viderApres();
    // Lot S3 : l'événement CRM part AU CLIC du lien du guide, jamais au POST de la page.
    expect(bd.crm).toHaveLength(0);
    expect(bd.origines).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
    expect(bd.envois).toHaveLength(1);
  });

  it("adresse opposée : un after() est inscrit aussi, et rien ne part", async () => {
    bd.opposees.add(ADRESSE);
    expect(await confirmerSansSuite(entree())).toEqual({ ok: true });
    expect(bd.apres).toHaveLength(1);
    await viderApres();
    expect(bd.origines).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
    expect(bd.preuves).toHaveLength(0);
  });

  it("opposée : la même lecture guideRequest.findUnique dans la transaction que le chemin normal", async () => {
    await confirmerPageGuide(entree({ jeton: jeton({ conv: "conv_exemple_0011" }) }));
    const normal = bd.lecturesDansTransaction;
    expect(normal).toBeGreaterThan(0);
    bd.lecturesDansTransaction = 0;
    bd.opposees.add(ADRESSE);
    await confirmerPageGuide(entree());
    expect(bd.lecturesDansTransaction).toBe(normal);
  });

  it("une suite qui échoue ne remonte pas : la réponse est déjà partie", async () => {
    bd.enfilePanne = true;
    await expect(confirmerPageGuide(entree())).resolves.toEqual({ ok: true });
  });
});

describe("adresse", () => {
  it("opposée : réponse IDENTIQUE à un succès, rien n'est envoyé ni écrit pour cette adresse", async () => {
    bd.opposees.add(ADRESSE);
    const r = await confirmerPageGuide(entree());
    const succes = await confirmerPageGuide(
      entree({ jeton: jeton({ conv: "conv_exemple_0009" }), email: "autre@example.test" }),
    );
    expect(r).toEqual(succes);
    expect(bd.envois).toHaveLength(1);
    expect(bd.demandes.every((d) => d.emailKey !== `h:${ADRESSE}`)).toBe(true);
    expect(bd.preuves.every((p) => p["personKey"] !== `h:${ADRESSE}`)).toBe(true);
    expect(bd.origines.every((o) => o["emailKey"] !== `h:${ADRESSE}`)).toBe(true);
    expect(bd.crm).toHaveLength(0);
  });

  it("M1 — opposée : le jeton est CONSOMMÉ comme pour un succès, par une marque sans donnée personnelle", async () => {
    bd.opposees.add(ADRESSE);
    const j = jeton();
    expect(await confirmerPageGuide(entree({ jeton: j }))).toEqual({ ok: true });
    // Même état qu'après un succès : une ligne porte l'empreinte du jeton…
    expect(bd.contacts).toHaveLength(1);
    expect(bd.contacts[0]!["jetonEmpreinte"]).toBe(empreinteJeton(j));
    // …mais rien de la personne : ni clé d'adresse, ni prénom, ni demande, ni preuve.
    const marque = JSON.stringify(bd.contacts[0]);
    expect(marque).not.toContain(ADRESSE);
    expect(marque).not.toContain(`h:${ADRESSE}`);
    expect(marque).not.toContain("Camille");
    expect(marque).not.toContain(Buffer.from("Camille").toString("base64"));
    expect(bd.contacts[0]!["merciStatut"]).toBe("ecarte");
    // La marque ne porte aucune preuve d'accord : « sans objet ».
    expect(bd.contacts[0]!["preuveStatut"]).toBe("sans_objet");
    expect(bd.demandes).toHaveLength(0);
    expect(bd.preuves).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
    expect(bd.origines).toHaveLength(0);
    expect(bd.crm).toHaveLength(0);
    // Rejouer le même jeton avec une adresse ordinaire ne donne RIEN : comme après un succès.
    const rejeu = await confirmerPageGuide(entree({ jeton: j, email: "autre@example.test" }));
    expect(rejeu).toEqual({ ok: true });
    expect(bd.envois).toHaveLength(0);
    expect(bd.contacts).toHaveLength(1);
  });

  it("M1 — opposée : le MÊME travail qu'un succès (MX, limites, verrou) — pas de sortie précoce", async () => {
    await confirmerPageGuide(entree({ jeton: jeton({ conv: "conv_exemple_0010" }) }));
    const mxSucces = bd.mxAppels;
    const limitesSucces = bd.limites.length;
    bd.mxAppels = 0;
    bd.limites.length = 0;
    bd.opposees.add(ADRESSE);
    await confirmerPageGuide(entree());
    expect(bd.mxAppels).toBe(mxSucces);
    expect(bd.limites.length).toBe(limitesSucces);
  });

  it("M1 — opposée ET domaine sans MX : la même erreur qu'une adresse ordinaire sans MX", async () => {
    bd.opposees.add(ADRESSE);
    bd.domaine.verdict = "non";
    const a = await confirmerPageGuide(entree());
    const b = await confirmerPageGuide(entree({ email: "autre@example.test" }));
    expect(a).toEqual(b);
  });

  it("MX « non » → message d'erreur (422), aucune écriture", async () => {
    bd.domaine.verdict = "non";
    expect(await confirmerPageGuide(entree())).toEqual({
      ok: false,
      statut: 422,
      erreur: "adresse_refusee",
    });
    expect(ecritures()).toBe(0);
  });

  it("MX « inconnu » (panne DNS) → la demande passe", async () => {
    bd.domaine.verdict = "inconnu";
    expect(await confirmerPageGuide(entree())).toEqual({ ok: true });
    expect(bd.envois).toHaveLength(1);
  });

  it("trop de demandes pour une personne → 429, rien d'écrit", async () => {
    bd.limiteAtteinte = true;
    expect(await confirmerPageGuide(entree())).toEqual({
      ok: false,
      statut: 429,
      erreur: "trop_de_requetes",
    });
    expect(ecritures()).toBe(0);
  });
});

describe("déjà servi", () => {
  it("guide déjà parti à cette adresse il y a moins de 24 h : pas de second envoi, succès", async () => {
    bd.logsDestinataire = 1;
    expect(await confirmerPageGuide(entree())).toEqual({ ok: true });
    expect(bd.envois).toHaveLength(0);
    // La personne a consenti : la preuve et le contact sont bien écrits.
    expect(bd.contacts).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
  });
});

describe("ce qui est écrit", () => {
  it("la ligne contact porte les champs demandés, prénom CHIFFRÉ, conv_ref HACHÉ", async () => {
    const j = jeton();
    expect(await confirmerPageGuide(entree({ jeton: j }))).toEqual({ ok: true });
    const c = bd.contacts[0]!;
    expect(c).toMatchObject({
      emailKey: `h:${ADRESSE}`,
      versionConsentement: VERSION_CONSENTEMENT_PAGE_GUIDE,
      consentEmpreinte: EMPREINTE_CASE_PAGE_GUIDE,
      consentiLe: MAINTENANT,
      jetonEmpreinte: empreinteJeton(j),
      merciStatut: "a_envoyer",
      // Preuve de l'accord : posée « en attente » (l'adresse n'est qu'une saisie, non vérifiée).
      preuveStatut: "en_attente",
    });
    expect(c["prenom"]).not.toContain("Camille");
    expect(String(c["prenom"]).startsWith("enc:")).toBe(true);
    expect(c["convRef"]).toMatch(/^[0-9a-f]{64}$/);
    expect(c["convRef"]).not.toBe(DONNEES.conv);
    expect(c["guideRequestId"]).toBe(bd.demandes[0]!["id"]);
  });

  it("B1 — l'ORIGINE n'est PAS recopiée dans contacts_guide_reseau (ni mot, ni réseau, ni compte, ni post, ni version M1)", async () => {
    await confirmerPageGuide(entree());
    for (const k of ["mot", "reseau", "compteRef", "postRef", "versionM1"]) {
      expect(bd.contacts[0], k).not.toHaveProperty(k);
    }
  });

  it("la demande garde l'origine « message_prive » et la source du réseau", async () => {
    await confirmerPageGuide(entree());
    expect(bd.demandes[0]).toMatchObject({
      origine: "message_prive",
      source: "mot-guide:instagram",
      aimant: "guide-ia",
    });
  });

  it("la preuve : form_ref guide-reseau-page, action consent_attente (plus de « consent »), version + empreinte du texte, rien en clair", async () => {
    await confirmerPageGuide(entree());
    expect(bd.preuves).toHaveLength(1);
    expect(bd.preuves.some((p) => p["action"] === "consent")).toBe(false);
    expect(bd.preuves[0]).toMatchObject({
      formRef: FORM_REF_PAGE_GUIDE,
      action: "consent_attente",
      personKey: `h:${ADRESSE}`,
      occurredAt: MAINTENANT,
    });
    expect(bd.preuves[0]!["ipHash"]).not.toBe("203.0.113.7");
    expect(bd.preuves[0]!["userAgent"]).not.toBe("agent-exemple");
    expect(String(bd.preuves[0]!["consentVersion"])).toContain(VERSION_CONSENTEMENT_PAGE_GUIDE);
    expect(String(bd.preuves[0]!["consentVersion"])).toContain(
      EMPREINTE_CASE_PAGE_GUIDE.slice(0, 32),
    );
    expect(String(bd.preuves[0]!["consentVersion"]).length).toBeLessThanOrEqual(64);
  });

  it("l'e-mail du guide porte la désinscription (gabarit de la page), jamais de lettre", async () => {
    await confirmerPageGuide(entree());
    expect(bd.envois).toHaveLength(1);
    const [gabarit, destinataire, , payload] = bd.envois[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("guide-ia-envoi");
    expect(destinataire).toBe(ADRESSE);
    expect(payload["reseau"]).toBe(true);
    expect(payload["pageGuide"]).toBe(true);
    expect(String(payload["oppositionToken"]).startsWith("op1.")).toBe(true);
    expect(payload).not.toHaveProperty("unsubscribeToken");
    expect(payload).not.toHaveProperty("confirmToken");
    expect(payload).not.toHaveProperty("doubleAccordToken");
  });

  it("aucune ligne newsletter_subscribers n'est créée (le mock lèverait)", async () => {
    await expect(confirmerPageGuide(entree())).resolves.toEqual({ ok: true });
  });
});

describe("journaux", () => {
  it("aucune adresse ni prénom dans les journaux, succès comme refus", async () => {
    await confirmerPageGuide(entree());
    bd.domaine.verdict = "non";
    await confirmerPageGuide(entree({ jeton: jeton({ conv: "conv_exemple_0003" }) }));
    bd.domaine.verdict = "oui";
    bd.opposees.add("opp@example.test");
    await confirmerPageGuide(
      entree({ jeton: jeton({ conv: "conv_exemple_0004" }), email: "opp@example.test" }),
    );
    const tout = bd.journal.join("\n");
    expect(tout).not.toContain("example.test");
    expect(tout).not.toContain("Camille");
    expect(tout).not.toContain(SECRET);
    expect(tout).not.toContain(crypto.createHash("sha256").update("x").digest("hex")); // garde-fou du harnais
  });
});

describe("B1 — l'origine va dans l'historique v3 (guide_reseau_origines), au CRM seulement au clic", () => {
  it("enregistrerOrigine reçoit mot, réseau du registre, compte, post_ref, famille guide_reseau", async () => {
    await confirmerPageGuide(entree());
    expect(bd.origines).toHaveLength(1);
    expect(bd.origines[0]).toMatchObject({
      emailKey: `h:${ADRESSE}`,
      mot: "GUIDE",
      reseau: "instagram",
      guide: "guide-ia",
      compte: "page_principale",
      postRef: "post_exemple_0001",
      famille: "guide_reseau",
      detail: "guide_ia",
    });
    expect(String(bd.origines[0]!["cleIdempotence"])).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  });

  it("le POST n'envoie RIEN au CRM (transmettreOriginesV3 jamais appelée) : l'origine est relue au clic", async () => {
    await confirmerPageGuide(entree());
    expect(bd.origines).toHaveLength(1);
    expect(bd.crm).toHaveLength(0);
  });

  it("un jeton rejoué n'écrit ni seconde preuve ni second contact (réponse neutre)", async () => {
    const j = jeton();
    await confirmerPageGuide(entree({ jeton: j }));
    expect(bd.preuves).toHaveLength(1);
    await confirmerPageGuide(entree({ jeton: j }));
    expect(bd.preuves).toHaveLength(1);
    expect(bd.contacts).toHaveLength(1);
    expect(bd.preuves[0]!["action"]).toBe("consent_attente");
  });

  it("un jeton rejoué n'écrit aucune seconde origine", async () => {
    const j = jeton();
    await confirmerPageGuide(entree({ jeton: j }));
    await confirmerPageGuide(entree({ jeton: j }));
    expect(bd.origines).toHaveLength(1);
    expect(bd.crm).toHaveLength(0);
  });

  it("l'origine n'est pas écrite quand la validation échoue (case, MX…)", async () => {
    await confirmerPageGuide(entree({ caseCochee: false }));
    bd.domaine.verdict = "non";
    await confirmerPageGuide(entree());
    expect(bd.origines).toHaveLength(0);
    expect(bd.crm).toHaveLength(0);
  });
});

describe("B3 — formats exigés par le CRM, validés avant toute écriture", () => {
  // SITE-COMPTE : le compte du jeton est une liste fermée (contrat) ; un jeton signé avec un autre
  // compte est refusé AVANT toute écriture, avec le refus neutre « lien » (la cause ne se lit jamais).
  it.each(["Page-Principale", "x", "a".repeat(41), "compte_example_01"])(
    "jeton signé avec un compte hors liste fermée (%s) : refus neutre « lien », rien d'écrit, rien envoyé",
    async (compte) => {
      const charge = {
        v: 1,
        conv: DONNEES.conv,
        mot: DONNEES.mot,
        reseau: DONNEES.reseau,
        guide: DONNEES.guide,
        compte,
        post_ref: DONNEES.post_ref,
        version_m1: DONNEES.version_m1,
        exp: Math.floor(MAINTENANT.getTime() / 1000) + 48 * 3600,
      };
      const partie = Buffer.from(JSON.stringify(charge), "utf8").toString("base64url");
      const sig = crypto.createHmac("sha256", SECRET).update(partie, "utf8").digest("base64url");
      expect(await confirmerPageGuide(entree({ jeton: `${partie}.${sig}` }))).toEqual({
        ok: false,
        statut: 400,
        erreur: "lien",
      });
      expect(ecritures()).toBe(0);
      expect(bd.crm).toHaveLength(0);
      expect(bd.envois).toHaveLength(0);
    },
  );

  it("post_ref absent : accepté, rien de plus à faire", async () => {
    const { post_ref: _p, ...sansPost } = DONNEES;
    await confirmerPageGuide(entree({ jeton: creerJeton(sansPost, SECRET, MAINTENANT.getTime()) }));
    expect(bd.origines[0]!["postRef"]).toBeNull();
    expect(bd.crm).toHaveLength(0);
  });

  it("post_ref hors format CRM (< 8 caractères) : retiré de l'origine, le reste est envoyé", async () => {
    await confirmerPageGuide(entree({ jeton: jeton({ post_ref: "abc" }) }));
    expect(bd.origines[0]!["postRef"]).toBeNull();
    expect(bd.envois).toHaveLength(1);
  });

  it("le débit « par post » n'utilise que la référence valide", async () => {
    await confirmerPageGuide(entree({ jeton: jeton({ post_ref: "abc" }) }));
    expect(bd.limites.some((l) => l.includes(":post:"))).toBe(false);
  });
});

describe("B2 — un conflit d'unicité n'est un succès neutre QUE pour le jeton", () => {
  it("P2002 sur guide_requests (demande simultanée) : la transaction est rejouée, le guide PART", async () => {
    bd.conflitDemande.restant = 1;
    bd.conflitDemande.gagnante = true;
    expect(await confirmerPageGuide(entree())).toEqual({ ok: true });
    expect(bd.contacts).toHaveLength(1);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.contacts[0]!["guideRequestId"]).toBe(bd.demandes[0]!["id"]);
    expect(bd.envois).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
  });

  it("P2002 persistant sur guide_requests : l'erreur remonte, JAMAIS un succès sans guide, jeton non consommé", async () => {
    bd.conflitDemande.restant = 99;
    await expect(confirmerPageGuide(entree())).rejects.toMatchObject({ code: "P2002" });
    expect(bd.contacts).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
  });

  it("P2002 dont meta.target est la contrainte nommée du jeton : succès neutre", async () => {
    const j = jeton();
    await confirmerPageGuide(entree({ jeton: j }));
    expect(await confirmerPageGuide(entree({ jeton: j }))).toEqual({ ok: true });
    expect(bd.envois).toHaveLength(1);
  });
});

describe("mises en file : un échec ne perd pas la demande", () => {
  it("l'e-mail ne peut pas être mis en file : la demande et la preuve sont écrites, aucune erreur à la personne", async () => {
    bd.enfilePanne = true;
    expect(await confirmerPageGuide(entree())).toEqual({ ok: true });
    expect(bd.demandes).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
    expect(bd.journal.join("\n")).not.toContain("example.test");
  });
});

describe("adresse : le validateur de /guide-ia", () => {
  it("une adresse sans point dans le domaine (acceptée par l'ancienne regex) est refusée", async () => {
    expect(await confirmerPageGuide(entree({ email: "personne@localhost" }))).toEqual({
      ok: false,
      statut: 422,
      erreur: "email",
    });
    expect(ecritures()).toBe(0);
  });
});

describe("S2-ATOMIQUE — contact, origine et preuve dans UNE seule transaction", () => {
  it("succès : la ligne contacts_guide_reseau, l'origine et la preuve sont présentes ENSEMBLE, avant toute suite", async () => {
    expect(await confirmerSansSuite(entree())).toEqual({ ok: true });
    expect(bd.contacts).toHaveLength(1);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.origines).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
    // Aucune des trois écritures ne dépend du `after()` : si le conteneur s'arrête ici, tout est là.
    expect(bd.envois).toHaveLength(0);
  });

  it("échec de l'ORIGINE au milieu : rollback complet, rien d'écrit, jeton non consommé", async () => {
    bd.echecOrigine = true;
    const j = jeton();
    await expect(confirmerSansSuite(entree({ jeton: j }))).rejects.toThrow();
    expect(bd.contacts).toHaveLength(0);
    expect(bd.demandes).toHaveLength(0);
    expect(bd.origines).toHaveLength(0);
    expect(bd.preuves).toHaveLength(0);
    expect(bd.apres).toHaveLength(0);
    expect(bd.envois).toHaveLength(0);
    // La panne passée, le MÊME lien fonctionne (le jeton n'a pas été brûlé).
    bd.echecOrigine = false;
    expect(await confirmerPageGuide(entree({ jeton: j }))).toEqual({ ok: true });
    expect(bd.contacts).toHaveLength(1);
    expect(bd.origines).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
  });

  it("échec de la PREUVE (dernière écriture) : rollback complet, y compris contact, demande et origine", async () => {
    bd.echecPreuve = true;
    await expect(confirmerSansSuite(entree())).rejects.toThrow();
    expect(bd.contacts).toHaveLength(0);
    expect(bd.demandes).toHaveLength(0);
    expect(bd.origines).toHaveLength(0);
    expect(bd.preuves).toHaveLength(0);
    expect(bd.apres).toHaveLength(0);
  });

  it("l'échec ne journalise ni adresse ni prénom", async () => {
    bd.echecPreuve = true;
    await expect(confirmerSansSuite(entree())).rejects.toThrow();
    const tout = bd.journal.join("\n");
    expect(tout).not.toContain("example.test");
    expect(tout).not.toContain("Camille");
  });

  it("rejeu du même jeton : réponse identique, ni doublon de contact, d'origine ni de preuve", async () => {
    const j = jeton();
    const premier = await confirmerPageGuide(entree({ jeton: j }));
    const rejeu = await confirmerPageGuide(entree({ jeton: j }));
    expect(rejeu).toEqual(premier);
    expect(bd.contacts).toHaveLength(1);
    expect(bd.demandes).toHaveLength(1);
    expect(bd.origines).toHaveLength(1);
    expect(bd.preuves).toHaveLength(1);
    expect(bd.envois).toHaveLength(1);
  });
});

describe("S2-PLANCHER — le temps de réponse ne révèle pas si l'adresse existe déjà", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(MAINTENANT);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Durée SIMULÉE écoulée entre l'appel et la réponse. */
  async function duree(e: EntreeConfirmation): Promise<number> {
    const debut = Date.now();
    let fin = -1;
    const p = confirmerSansSuite(e).then((r) => {
      fin = Date.now();
      return r;
    });
    await vi.advanceTimersByTimeAsync(PLANCHER_REPONSE_MS * 4);
    await p;
    return fin - debut;
  }

  it("le plancher est nommé et vaut au moins 250 ms", () => {
    expect(PLANCHER_REPONSE_MS).toBeGreaterThanOrEqual(250);
  });

  it("adresse NEUVE : la réponse ne part pas avant le plancher", async () => {
    const d = await duree(entree({ plancherMs: undefined }));
    expect(d).toBeGreaterThanOrEqual(PLANCHER_REPONSE_MS);
  });

  it("adresse DÉJÀ CONNUE (demande existante) : la réponse ne part pas avant le plancher", async () => {
    bd.demandes.push({
      id: "d-existante",
      emailKey: `h:${ADRESSE}`,
      aimant: "guide-ia",
      origine: "formulaire",
      downloadToken: "t".repeat(64),
    });
    const d = await duree(
      entree({ plancherMs: undefined, jeton: jeton({ conv: "conv_exemple_0021" }) }),
    );
    expect(d).toBeGreaterThanOrEqual(PLANCHER_REPONSE_MS);
  });

  it("adresse opposée : même plancher", async () => {
    bd.opposees.add(ADRESSE);
    const d = await duree(entree({ plancherMs: undefined }));
    expect(d).toBeGreaterThanOrEqual(PLANCHER_REPONSE_MS);
  });

  it("les durées adresse neuve / déjà connue sont indiscernables (toutes deux égales au plancher)", async () => {
    const neuve = await duree(entree({ plancherMs: undefined }));
    const connue = await duree(
      entree({ plancherMs: undefined, jeton: jeton({ conv: "conv_exemple_0022" }) }),
    );
    expect(Math.abs(neuve - connue)).toBeLessThan(20);
  });

  it("un échec en cours de route attend aussi le plancher avant de remonter", async () => {
    bd.echecPreuve = true;
    const debut = Date.now();
    let fin = -1;
    const p = confirmerSansSuite(entree({ plancherMs: undefined })).catch(() => {
      fin = Date.now();
    });
    await vi.advanceTimersByTimeAsync(PLANCHER_REPONSE_MS * 4);
    await p;
    expect(fin - debut).toBeGreaterThanOrEqual(PLANCHER_REPONSE_MS);
  });
});
