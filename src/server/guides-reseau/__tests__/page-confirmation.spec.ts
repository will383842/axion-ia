// @vitest-environment node
//
// Lot S2 — `confirmerPageGuide` : la validation de la page « Recevoir le guide ».
// Base EN MÉMOIRE (contraintes d'unicité rejouées), transport e-mail SIMULÉ, DNS simulé.
// Données 100 % fictives (example.test).
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

type Ligne = Record<string, unknown>;
const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
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
}));

function client() {
  return {
    $executeRaw: async () => 0,
    contactGuideReseau: {
      create: async ({ data }: { data: Ligne }) => {
        // Le temps d'un tour : deux transactions simultanées se croisent vraiment.
        await new Promise((r) => setTimeout(r, 1));
        if (bd.contacts.some((c) => c.jetonEmpreinte === data.jetonEmpreinte)) throw p2002();
        const l = { id: `c${++bd.n}`, ...data };
        bd.contacts.push(l);
        return l;
      },
      findUnique: async ({ where }: { where: Ligne }) =>
        bd.contacts.find((c) => egal(c, where)) ?? null,
    },
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
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client()),
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
    return { enqueued: true };
  },
}));
vi.mock("@/server/notifications", () => ({ notify: async () => undefined }));

import { confirmerPageGuide, type EntreeConfirmation } from "../page-confirmation";
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
    ...o,
  };
}

function ecritures(): number {
  return bd.contacts.length + bd.demandes.length + bd.preuves.length + bd.envois.length;
}

beforeEach(() => {
  bd.demandes.length = bd.contacts.length = bd.preuves.length = bd.envois.length = 0;
  bd.limites.length = bd.journal.length = 0;
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
      (await confirmerPageGuide(entree({ jeton: jeton({ conv: "conv_exemple_0002" }), prenom: "b".repeat(50), email: "autre@example.test" }))).ok,
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

describe("adresse", () => {
  it("opposée : réponse IDENTIQUE à un succès, rien n'est envoyé ni écrit", async () => {
    bd.opposees.add(ADRESSE);
    const r = await confirmerPageGuide(entree());
    const succes = await confirmerPageGuide(
      entree({ jeton: jeton({ conv: "conv_exemple_0009" }), email: "autre@example.test" }),
    );
    expect(r).toEqual(succes);
    expect(bd.contacts).toHaveLength(1); // seulement celui de l'autre adresse
    expect(bd.envois).toHaveLength(1);
    expect(bd.demandes.every((d) => d.emailKey !== `h:${ADRESSE}`)).toBe(true);
    expect(bd.preuves.every((p) => p["email"] !== ADRESSE)).toBe(true);
  });

  it("opposée : le jeton n'est pas consommé (rien n'est écrit)", async () => {
    bd.opposees.add(ADRESSE);
    const j = jeton();
    await confirmerPageGuide(entree({ jeton: j }));
    expect(bd.contacts).toHaveLength(0);
    expect(ecritures()).toBe(0);
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
      mot: "GUIDE",
      reseau: "instagram",
      compteRef: "page_principale",
      postRef: "post_exemple_0001",
      versionM1: "m1-2026-11",
      versionConsentement: VERSION_CONSENTEMENT_PAGE_GUIDE,
      consentEmpreinte: EMPREINTE_CASE_PAGE_GUIDE,
      consentiLe: MAINTENANT,
      jetonEmpreinte: empreinteJeton(j),
      merciStatut: "a_envoyer",
    });
    expect(c["prenom"]).not.toContain("Camille");
    expect(String(c["prenom"]).startsWith("enc:")).toBe(true);
    expect(c["convRef"]).toMatch(/^[0-9a-f]{64}$/);
    expect(c["convRef"]).not.toBe(DONNEES.conv);
    expect(c["guideRequestId"]).toBe(bd.demandes[0]!["id"]);
  });

  it("la demande garde l'origine « message_prive » et la source du réseau", async () => {
    await confirmerPageGuide(entree());
    expect(bd.demandes[0]).toMatchObject({
      origine: "message_prive",
      source: "mot-guide:instagram",
      aimant: "guide-ia",
    });
  });

  it("la preuve : form_ref guide-reseau-page, action consent, version + empreinte du texte", async () => {
    await confirmerPageGuide(entree());
    expect(bd.preuves).toHaveLength(1);
    expect(bd.preuves[0]).toMatchObject({
      formRef: FORM_REF_PAGE_GUIDE,
      action: "consent",
      email: ADRESSE,
      occurredAt: MAINTENANT,
      ip: "203.0.113.7",
      userAgent: "agent-exemple",
    });
    expect(String(bd.preuves[0]!["consentVersion"])).toContain(VERSION_CONSENTEMENT_PAGE_GUIDE);
    expect(String(bd.preuves[0]!["consentVersion"])).toContain(
      EMPREINTE_CASE_PAGE_GUIDE.slice(0, 32),
    );
    expect(String(bd.preuves[0]!["consentVersion"]).length).toBeLessThanOrEqual(64);
  });

  it("l'e-mail du guide porte la désinscription (gabarit de la page), jamais de lettre", async () => {
    await confirmerPageGuide(entree());
    expect(bd.envois).toHaveLength(1);
    const [gabarit, destinataire, , payload] = bd.envois[0] as [string, string, string, Record<string, unknown>];
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
    await confirmerPageGuide(entree({ jeton: jeton({ conv: "conv_exemple_0004" }), email: "opp@example.test" }));
    const tout = bd.journal.join("\n");
    expect(tout).not.toContain("example.test");
    expect(tout).not.toContain("Camille");
    expect(tout).not.toContain(SECRET);
    expect(tout).not.toContain(crypto.createHash("sha256").update("x").digest("hex")); // garde-fou du harnais
  });
});
