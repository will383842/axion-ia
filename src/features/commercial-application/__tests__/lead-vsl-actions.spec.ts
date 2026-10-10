/**
 * Capture en deux temps du tunnel apporteurs avec vidéo — les règles R1 à R8 de
 * `03-MESSAGES-ET-DECISIONS.md`, une par une.
 *
 * Ce que ces cas verrouillent :
 *   R1  toute avancée annule les tâches des états précédents ; les tâches portent
 *       un `jobId` dérivé de l'empreinte, jamais l'adresse ;
 *   R2  aucun message A* ni B* après l'étape 2, une réservation ou un dossier
 *       complet ;
 *   R3  une adresse déjà connue reçoit la MÊME réponse « succès », aucun nouvel
 *       e-mail, aucune rétrogradation, aucune écriture ; un double clic ne crée
 *       qu'une ligne ; le jeton d'un autre n'ouvre rien ;
 *   R4  B1 dit « choisissez votre créneau », jamais « votre candidature est
 *       retenue » ;
 *   R5  A1 (+30 min), A2 (+2 j), A3 (+7 j) : jamais deux le même jour ;
 *   R6  rien ne part pour une fiche effacée ;
 *   R7/R8 vouvoiement, vocabulaire du réseau, aucun délai promis, aucun numéro.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { serializeUtmCookie } from "@/lib/utm";

const ID_LEAD = "11111111-1111-4111-8111-111111111111";

const creer = vi.fn(async (_a: unknown) => ({
  id: ID_LEAD,
  submittedAt: new Date("2026-10-05T10:00:00Z"),
}));
let lignesExistantes: Array<{ id: string; details: unknown }> = [];
const chercherLignes = vi.fn(async (..._a: unknown[]) => lignesExistantes);
let ligneParId: unknown = null;
const chercherUne = vi.fn(async (..._a: unknown[]) => ligneParId);
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const retirer = vi.fn(async (_id: string) => 1);
const notifier = vi.fn(async (_a: unknown) => ({ ok: true }));
const consentement = vi.fn(async (_a: unknown) => true);
const honeypot = vi.fn();
const avancer = vi.fn<(...a: unknown[]) => Promise<"avance" | "deja" | "introuvable">>(
  async () => "avance",
);
const majCible = vi.fn(async (..._a: unknown[]) => undefined);
const ajouterRetour = vi.fn(async (..._a: unknown[]) => undefined);
const completerRetour = vi.fn<(...a: unknown[]) => Promise<"complete" | "deja" | "introuvable">>(
  async () => "complete",
);
const envoyerMeta = vi.fn(async (..._a: unknown[]) => ({ envoye: true as const }));
const verrou = vi.fn<(...a: unknown[]) => Promise<string | null>>(async () => "OK");
const verrouRendu = vi.fn(async (..._a: unknown[]) => 1);
let cookieUtm: string | undefined;
let plafondEmailAtteint = false;
let ipSaturee = false;
const compteurs: string[] = [];

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string) => {
    compteurs.push(cle);
    return {
      allowed:
        !(plafondEmailAtteint && cle.startsWith("lead-vsl:email:")) &&
        !(ipSaturee && (cle === "lead-vsl:203.0.113.7" || cle === "lead-vsl-2:203.0.113.7")),
      count: 1,
      remaining: 9,
      resetAt: 0,
      panne: false,
    };
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: { set: (...a: unknown[]) => verrou(...a), del: (...a: unknown[]) => verrouRendu(...a) },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      create: (a: unknown) => creer(a),
      findMany: (...a: unknown[]) => chercherLignes(...a),
      findFirst: (...a: unknown[]) => chercherUne(...a),
    },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({
    get: (name: string) => (name === "axion_utm" && cookieUtm ? { value: cookieUtm } : undefined),
  }),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: () => undefined,
  captureMessage: () => undefined,
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h${e.toLowerCase().replace(/[^a-z0-9]/g, "")}` : null),
}));
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
  emailsQueue: { remove: (id: string) => retirer(id) },
}));
vi.mock("@/server/email/email-log", () => ({ marquerAnnule: vi.fn(async () => 1) }));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: (a: unknown) => consentement(a),
  CONSENT_FORM_REFS: { leadApporteur: "lead-apporteur-facebook" },
}));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireCandidatures: () => "contact@axion-ia.com",
}));
vi.mock("@/lib/security/honeypot-observable", () => ({
  signalerHoneypot: (...a: unknown[]) => honeypot(...a),
}));
vi.mock("@/server/meta/conversions-api", () => ({
  envoyerEvenementMeta: (...a: unknown[]) => envoyerMeta(...a),
}));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/console/${p}` }));
vi.mock("../lead-vsl-details", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../lead-vsl-details")>();
  return {
    ...reel,
    avancerVslEtape2: (...a: unknown[]) => avancer(...a),
    majVslCible: (...a: unknown[]) => majCible(...a),
    ajouterRetourVsl: (...a: unknown[]) => ajouterRetour(...a),
    completerRetourVsl: (...a: unknown[]) => completerRetour(...a),
  };
});

import { capturerLeadVsl, completerLeadVsl } from "../lead-vsl-actions";
import { creerJeton, verifierJeton } from "../jeton-lead";
import { annulerRelancesLeadApporteur } from "../relances-lead-apporteur";

const MAINTENANT = Date.parse("2026-10-05T10:00:00Z");

function entree(extra: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}) {
  return {
    prenom: "Nadia",
    email: "nadia@example.com",
    consent: true,
    consentPub: true,
    ctx: {
      query: "?utm_source=facebook&utm_campaign=apporteurs&fbclid=IwAR0abcdefghijklmnop",
      fbp: "fb.1.1725000000000.123456",
      fbclid: "IwAR0abcdefghijklmnop",
      fbclidAt: MAINTENANT - 60_000,
      // Page affichée il y a 20 s : un humain.
      renderedAt: MAINTENANT - 20_000,
      ...ctx,
    },
    ...extra,
  };
}

type Entree = Parameters<typeof capturerLeadVsl>[0];
const capturer = (e: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}) =>
  capturerLeadVsl(entree(e, ctx) as unknown as Entree);

type CreateArgs = { data: { details: Record<string, unknown>; contactName: string } };
const detailsCrees = () => (creer.mock.calls[0]?.[0] as CreateArgs).data.details;

const jobsPoses = () =>
  enfiler.mock.calls.map((c) => ({
    gabarit: c[0] as string,
    a: c[1] as string,
    payload: c[3] as Record<string, unknown>,
    options: c[4] as { delayMs?: number; jobId?: string },
  }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  process.env["AUTH_SECRET"] = "secret-de-test-assez-long-pour-signer";
  delete process.env["CALENDLY_APPORTEUR_URL"];
  creer.mockClear();
  chercherLignes.mockClear();
  chercherUne.mockClear();
  enfiler.mockClear();
  retirer.mockClear();
  notifier.mockClear();
  consentement.mockClear();
  honeypot.mockClear();
  avancer.mockReset();
  avancer.mockResolvedValue("avance");
  majCible.mockClear();
  ajouterRetour.mockClear();
  completerRetour.mockReset();
  completerRetour.mockResolvedValue("complete");
  envoyerMeta.mockClear();
  verrou.mockReset();
  verrou.mockResolvedValue("OK");
  verrouRendu.mockClear();
  compteurs.length = 0;
  cookieUtm = undefined;
  plafondEmailAtteint = false;
  ipSaturee = false;
  lignesExistantes = [];
  ligneParId = null;
});

describe("étape 1 — capturerLeadVsl", () => {
  it("crée UNE ligne premier-contact avec details.vsl, sans écraser l'échelle d'étapes", async () => {
    cookieUtm = serializeUtmCookie({ utm_source: "facebook", utm_campaign: "cookie-prime" });
    const r = await capturer();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.leadId).toBe(ID_LEAD);
    expect(creer).toHaveBeenCalledTimes(1);

    const d = detailsCrees();
    expect(d["unifiedType"]).toBe("recrutement");
    expect(d["subType"]).toBe("candidature-commerciale");
    // Même échelle qu'aujourd'hui : un lead vidéo est un « premier contact ».
    expect(d["etape"]).toBe("premier-contact");
    expect(d["source"]).toBe("/apporteur-affaires/video");
    expect(d["consentVersion"]).toBe("lead-apporteur-vsl-v4-2026-10-07");
    expect(d["vsl"]).toMatchObject({
      version: "vsl-v1",
      etapeAtteinte: 1,
      atteinte: { e1: "2026-10-05T10:00:00.000Z" },
    });
    expect(d["vsl"]).not.toHaveProperty("suspect");
    expect((d["candidature"] as Record<string, unknown>)["sourceConnaissance"]).toBe("facebook");
    // Aucune donnée personnelle en clair dans `details`.
    expect(JSON.stringify(d)).not.toContain("nadia@");
  });

  it("garde la réponse à la bannière avec sa date, et le fbclid horodaté (lot 5)", async () => {
    await capturer();
    const funnel = detailsCrees()["funnel"] as Record<string, unknown>;
    expect(funnel["consentPub"]).toEqual({ accepte: true, le: "2026-10-05T10:00:00.000Z" });
    expect(funnel["fbclid"]).toBe(true);
    expect(funnel["fbclidValeur"]).toBe("IwAR0abcdefghijklmnop");
    expect(funnel["fbcCreeLe"]).toBe(new Date(MAINTENANT - 60_000).toISOString());
    expect(funnel["utm"]).toMatchObject({ utm_source: "facebook", utm_campaign: "apporteurs" });
  });

  it("sans consentement publicitaire, la VALEUR du fbclid et le _fbp ne sont pas gardés", async () => {
    await capturer({ consentPub: false });
    const funnel = detailsCrees()["funnel"] as Record<string, unknown>;
    expect(funnel["consentPub"]).toMatchObject({ accepte: false });
    expect(funnel["fbclid"]).toBe(true);
    expect(funnel).not.toHaveProperty("fbclidValeur");
    expect(funnel).not.toHaveProperty("fbp");
  });

  it("enregistre la preuve de consentement v4 — celle du texte de la case", async () => {
    await capturer();
    expect(consentement).toHaveBeenCalledTimes(1);
    expect(consentement.mock.calls[0]?.[0]).toMatchObject({
      consentVersion: "lead-apporteur-vsl-v4-2026-10-07",
      action: "optin",
    });
  });

  it("R5 / branche A : A1 à +30 min, A2 à +2 j, A3 à +7 j, jamais deux le même jour", async () => {
    await capturer();
    const jobs = jobsPoses();
    expect(jobs).toHaveLength(3);
    const [a1, a2, a3] = jobs;
    expect(a1?.gabarit).toBe("lead-apporteur-recu");
    expect(a1?.payload["variante"]).toBe("vsl-abandon");
    expect(a1?.options.delayMs).toBe(30 * 60_000);
    expect(a2?.gabarit).toBe("lead-apporteur-relance");
    expect(a2?.payload).toMatchObject({ etape: "j2", variante: "vsl" });
    expect(a2?.options.delayMs).toBe(2 * 24 * 3_600_000);
    expect(a3?.payload).toMatchObject({ etape: "j7", variante: "vsl" });
    expect(a3?.options.delayMs).toBe(7 * 24 * 3_600_000);
    // Jamais deux messages dans la même journée de 24 h.
    const delais = jobs.map((j) => j.options.delayMs as number).sort((x, y) => x - y);
    for (let i = 1; i < delais.length; i++) {
      expect((delais[i] as number) - (delais[i - 1] as number)).toBeGreaterThanOrEqual(
        24 * 3_600_000 - 30 * 60_000,
      );
    }
  });

  it("R1 : les jobId dérivent de l'empreinte (jamais l'adresse) et n'ont aucun « : »", async () => {
    await capturer();
    for (const j of jobsPoses()) {
      expect(j.options.jobId).toContain("hnadiaexamplecom");
      expect(j.options.jobId).not.toContain("nadia@");
      expect(j.options.jobId).not.toContain(":");
    }
  });

  it("les liens de reprise portent un jeton de REPRISE valable jusqu'au dernier rappel", async () => {
    await capturer();
    for (const j of jobsPoses()) {
      const url = String(j.payload["dossierUrl"]);
      expect(url).toMatch(/^https:\/\/axion-ia\.com\/fr\/apporteur-affaires\/video\?r=/);
      const jeton = decodeURIComponent(url.split("?r=")[1] as string);
      const c = verifierJeton(jeton, MAINTENANT + 8 * 24 * 3_600_000);
      expect(c?.lead).toBe(ID_LEAD);
      expect(c?.genre).toBe("reprise");
    }
  });

  it("AUCUNE notification d'équipe à l'étape 1 : un lead partiel n'est pas un candidat", async () => {
    await capturer();
    expect(notifier).not.toHaveBeenCalled();
    expect(jobsPoses().some((j) => j.gabarit === "candidature-commercial-recap")).toBe(false);
  });

  it("renvoie un jeton qui vérifie, porte la ligne et ne contient aucune adresse", async () => {
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    const c = verifierJeton(r.jeton);
    expect(c?.lead).toBe(ID_LEAD);
    expect(c?.suspect).toBe(false);
    expect(Buffer.from(r.jeton.split(".")[0] as string, "base64url").toString()).not.toContain(
      "nadia",
    );
  });

  it("R3 : une adresse déjà connue (ancien formulaire, dossier) reçoit un succès, SANS rien écrire ni envoyer", async () => {
    lignesExistantes = [
      { id: "ancien", details: { etape: "premier-contact", subType: "candidature-commerciale" } },
    ];
    const r = await capturer();
    expect(r.ok).toBe(true);
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(consentement).not.toHaveBeenCalled();
    expect(majCible).not.toHaveBeenCalled();
  });

  it("R3 : la réponse pour une adresse connue est indiscernable d'une vraie (même forme, aucun drapeau)", async () => {
    const neuve = await capturer({ email: "neuve@example.com" });
    const ID_CONNUE = "22222222-2222-4222-8222-222222222222";
    lignesExistantes = [{ id: ID_CONNUE, details: { subType: "x" } }];
    const connue = await capturer({ email: "connue@example.com" });
    if (!neuve.ok || !connue.ok) throw new Error("attendu : succès");
    // Même forme d'identifiant (UUID). Depuis le 2026-10-10 (P2), c'est celui de
    // la fiche RÉELLE : l'`eventID` du `Lead` navigateur ne s'invente plus.
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(neuve.leadId).toMatch(UUID);
    expect(connue.leadId).toMatch(UUID);
    expect(connue.leadId).toBe(ID_CONNUE);
    expect(Object.keys(neuve).sort()).toEqual(Object.keys(connue).sort());
    // Le jeton ne porte AUCUN drapeau qui trahirait « adresse connue ».
    const corps = Buffer.from(connue.jeton.split(".")[0] as string, "base64url").toString();
    expect(corps).not.toMatch(/fant|connu|exist|known/i);
    expect(Object.keys(JSON.parse(corps) as object).sort()).toEqual(
      Object.keys(
        JSON.parse(Buffer.from(neuve.jeton.split(".")[0] as string, "base64url").toString()),
      ).sort(),
    );
  });

  it("R3 : un dossier complet ou commencé n'est jamais rétrogradé (aucun écrit)", async () => {
    for (const details of [
      { subType: "candidature-commerciale" }, // dossier complet (aucun marqueur d'étape)
      { subType: "candidature-commerciale", origine: "ecran-1-dossier" }, // dossier commencé
    ]) {
      lignesExistantes = [{ id: "d", details }];
      creer.mockClear();
      enfiler.mockClear();
      const r = await capturer();
      expect(r.ok).toBe(true);
      expect(creer).not.toHaveBeenCalled();
      expect(enfiler).not.toHaveBeenCalled();
      expect(majCible).not.toHaveBeenCalled();
    }
  });

  it("R3 : un lead vidéo existant est RÉUTILISÉ — même identifiant, aucun nouvel e-mail, aucune création", async () => {
    lignesExistantes = [{ id: "lead-existant", details: { vsl: { etapeAtteinte: 1 } } }];
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.leadId).toBe("lead-existant");
    expect(verifierJeton(r.jeton)?.lead).toBe("lead-existant");
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(consentement).not.toHaveBeenCalled();
    // Seule la date du jeton bouge, par écriture ciblée.
    expect(majCible).toHaveBeenCalledWith(
      "lead-existant",
      expect.objectContaining({ jetonVuLe: expect.any(String) }),
    );
  });

  it("le plafond « 3 par jour par adresse » compte les CRÉATIONS, pas les reprises", async () => {
    lignesExistantes = [{ id: "lead-existant", details: { vsl: { etapeAtteinte: 1 } } }];
    plafondEmailAtteint = true;
    const reprise = await capturer();
    expect(reprise.ok).toBe(true);
    expect(compteurs.some((c) => c.startsWith("lead-vsl:email:"))).toBe(false);

    lignesExistantes = [];
    const creation = await capturer();
    expect(creation).toEqual({ ok: false, error: "rate" });
    expect(creer).not.toHaveBeenCalled();
  });

  it("double clic : le second appel (verrou pris) attend la ligne du premier et ne crée rien", async () => {
    verrou.mockResolvedValue(null);
    // La ligne du premier appel apparaît au premier sondage du second.
    chercherLignes.mockResolvedValueOnce([
      { id: "lead-du-premier-clic", details: { vsl: { etapeAtteinte: 1 } } },
    ]);
    vi.useRealTimers(); // l'attente utilise un vrai setTimeout
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.leadId).toBe("lead-du-premier-clic");
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    // Il n'a pas le verrou : il ne doit pas le rendre non plus.
    expect(verrouRendu).not.toHaveBeenCalled();
  });

  it("rend le verrou après une création", async () => {
    await capturer();
    expect(verrou).toHaveBeenCalledWith(
      expect.stringContaining("hnadiaexamplecom"),
      "1",
      "EX",
      10,
      "NX",
    );
    expect(verrouRendu).toHaveBeenCalledTimes(1);
  });

  it("Redis muet : le tunnel continue sans verrou", async () => {
    verrou.mockRejectedValue(new Error("redis down"));
    const r = await capturer();
    expect(r.ok).toBe(true);
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it("leurre rempli : succès silencieux, rien d'écrit, rien d'envoyé", async () => {
    const r = await capturer({ honeypot: "http://spam.example" });
    expect(r.ok).toBe(true);
    expect(honeypot).toHaveBeenCalledTimes(1);
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(chercherLignes).not.toHaveBeenCalled();
  });

  it("trop rapide (< 3 s après l'affichage) : ligne marquée suspecte, ni e-mail, ni consentement, ni notification", async () => {
    const r = await capturer({}, { renderedAt: MAINTENANT - 1_000 });
    if (!r.ok) throw new Error("attendu : succès");
    expect(creer).toHaveBeenCalledTimes(1);
    expect(detailsCrees()["vsl"]).toMatchObject({ suspect: true });
    expect(enfiler).not.toHaveBeenCalled();
    expect(consentement).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(verifierJeton(r.jeton)?.suspect).toBe(true);
  });

  it("refuse un consentement absent, une adresse invalide, un contexte hors bornes", async () => {
    expect(await capturer({ consent: false })).toEqual({ ok: false, error: "invalid" });
    expect(await capturer({ email: "pas-une-adresse" })).toEqual({ ok: false, error: "invalid" });
    expect(await capturer({}, { query: "x".repeat(2001) })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await capturer({ prenom: "" })).toEqual({ ok: false, error: "invalid" });
    expect(creer).not.toHaveBeenCalled();
  });

  it("limite par IP : « rate » avant tout parsing, rien n'est lu ni écrit", async () => {
    ipSaturee = true;
    expect(await capturer()).toEqual({ ok: false, error: "rate" });
    expect(chercherLignes).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("échec d'écriture : « unknown », aucun message", async () => {
    creer.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await capturer();
    expect(r).toEqual({ ok: false, error: "unknown" });
    expect(enfiler).not.toHaveBeenCalled();
  });
});

function ligneVsl(extra: Record<string, unknown> = {}) {
  return {
    id: ID_LEAD,
    contactName: "enc:Nadia",
    contactEmail: "enc:nadia@example.com",
    details: {
      vsl: { etapeAtteinte: 1, version: "vsl-v1" },
      funnel: { utm: { utm_campaign: "apporteurs" } },
      candidature: { sourceConnaissance: "facebook" },
    },
    ...extra,
  };
}

const COMPLET = {
  telephone: "06 12 34 56 78",
  reponseId: "5-20" as const,
  consent: true,
};

function completer(jeton: string, extra: Record<string, unknown> = {}) {
  return completerLeadVsl({ jeton, ...COMPLET, ...extra } as Parameters<
    typeof completerLeadVsl
  >[0]);
}

describe("étape 2 — completerLeadVsl", () => {
  it("complète la MÊME ligne, rend l'adresse de la page merci avec un jeton frais", async () => {
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 30_000);
    const jeton = creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT });
    const r = await completer(jeton);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.merciUrl).toMatch(/^\/apporteur-affaires\/video\/merci\?j=/);
    expect(avancer).toHaveBeenCalledTimes(1);
    expect(avancer.mock.calls[0]?.[0]).toMatchObject({
      id: ID_LEAD,
      reponseId: "5-20",
      telephoneChiffre: "enc:06 12 34 56 78",
      suspect: false,
    });
  });

  it("le message de la fiche suit l'avancée : « terminée », plus « étape 1 sur 2 »", async () => {
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    const message = String((avancer.mock.calls[0]?.[0] as { message: string }).message);
    expect(message).toContain(
      "Inscription terminée depuis la page vidéo /apporteur-affaires/video",
    );
    expect(message).toContain("source : Facebook");
    expect(message).toContain("créneau à choisir");
    expect(message).not.toContain("étape 1 sur 2");
  });

  it("R1/R2 : annule la branche A (A1, A2, A3) et envoie B1 une seule fois, avec le bouton de réservation", async () => {
    process.env["CALENDLY_APPORTEUR_URL"] = "https://calendly.com/axion-ia/echange-apporteur";
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));

    expect(retirer.mock.calls.map((c) => c[0]).sort()).toEqual(
      [
        "lead-apporteur-kit-hnadiaexamplecom",
        "lead-apporteur-relance-j2-hnadiaexamplecom",
        "lead-apporteur-relance-j7-hnadiaexamplecom",
      ].sort(),
    );
    const b1 = jobsPoses().find((j) => j.gabarit === "lead-apporteur-recu");
    expect(b1?.payload["variante"]).toBe("vsl-etape2");
    expect(b1?.payload["calendlyUrl"]).toBe("https://calendly.com/axion-ia/echange-apporteur");
    expect(b1?.options.jobId).toBe("lead-apporteur-vsl-etape2-hnadiaexamplecom");
    expect(b1?.options.delayMs).toBeUndefined(); // immédiat
    // Aucune adresse dans la clé de tâche.
    expect(b1?.options.jobId).not.toContain("@");
  });

  it("sans lien Calendly valide en configuration, le bouton de B1 mène à la page de remerciement", async () => {
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    const b1 = jobsPoses().find((j) => j.gabarit === "lead-apporteur-recu");
    expect(String(b1?.payload["calendlyUrl"])).toMatch(
      /^https:\/\/axion-ia\.com\/fr\/apporteur-affaires\/video\/merci\?j=/,
    );
  });

  it("N1 : UNE notification à l'équipe, et le récapitulatif interne — une seule fois", async () => {
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(notifier.mock.calls[0]?.[0]).toMatchObject({
      category: "COMMERCIAL_APPLICATION_RECEIVED",
      dedupKey: ID_LEAD,
    });
    const recap = jobsPoses().filter((j) => j.gabarit === "candidature-commercial-recap");
    expect(recap).toHaveLength(1);
    expect(JSON.stringify(recap[0]?.payload)).toContain("De 5 à 20");
  });

  it("B1 non remis à la file (envoi refusé) : aucune trace, la ligne et la notification restent", async () => {
    ligneParId = ligneVsl();
    enfiler.mockImplementation(async (...a: unknown[]) => ({
      enqueued: a[0] !== "lead-apporteur-recu",
    }));
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    // Aucune écriture de « message parti » : seule l'avancée d'étape est écrite.
    expect(majCible).not.toHaveBeenCalled();
    expect(avancer).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledTimes(1);
    enfiler.mockImplementation(async () => ({ enqueued: true }));
  });

  it("R3 : un double clic (étape 2 déjà atteinte) répond « succès » sans second e-mail ni seconde notification", async () => {
    ligneParId = ligneVsl();
    avancer.mockResolvedValue("deja");
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(retirer).not.toHaveBeenCalled();
  });

  it("jeton d'un autre (falsifié), expiré ou illisible : « jeton », rien n'est lu ni écrit", async () => {
    ligneParId = ligneVsl();
    const bon = creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT });
    const [corps, sig] = bon.split(".") as [string, string];
    const contenu = JSON.parse(Buffer.from(corps, "base64url").toString()) as { lead: string };
    contenu.lead = "22222222-2222-4222-8222-222222222222";
    const forge = `${Buffer.from(JSON.stringify(contenu)).toString("base64url")}.${sig}`;
    const expire = creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT - 25 * 3_600_000 });
    for (const jeton of [forge, expire, "n'importe quoi à peu près long"]) {
      expect(await completer(jeton)).toEqual({ ok: false, error: "jeton" });
    }
    expect(chercherUne).not.toHaveBeenCalled();
    expect(avancer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("jeton valide MAIS sans ligne derrière (adresse déjà connue, robot) : « succès », rien d'écrit", async () => {
    ligneParId = null;
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(
      creerJeton({ lead: "33333333-3333-4333-8333-333333333333", maintenant: MAINTENANT }),
    );
    expect(r.ok).toBe(true);
    expect(avancer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("le jeton d'une ligne qui n'est PAS un lead vidéo (ancien dossier) n'écrit rien non plus", async () => {
    ligneParId = ligneVsl({ details: { etape: "premier-contact" } });
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(avancer).not.toHaveBeenCalled();
  });

  it("trop rapide (< 2 s après l'émission du jeton) : ligne marquée suspecte, aucun message ni notification", async () => {
    ligneParId = ligneVsl();
    vi.setSystemTime(MAINTENANT + 500);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(avancer.mock.calls[0]?.[0]).toMatchObject({ suspect: true });
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("un lead déjà marqué suspect à l'étape 1 le reste", async () => {
    ligneParId = ligneVsl({ details: { vsl: { etapeAtteinte: 1, suspect: true } } });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("R6 : une fiche effacée (art. 17) ne reçoit rien", async () => {
    ligneParId = ligneVsl({ contactEmail: "enc:erased-abc@erased.local" });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("refuse un téléphone invalide, une réponse hors liste, un consentement absent", async () => {
    const jeton = creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT });
    expect(await completer(jeton, { telephone: "abc" })).toEqual({ ok: false, error: "invalid" });
    expect(await completer(jeton, { reponseId: "beaucoup" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await completer(jeton, { consent: false })).toEqual({ ok: false, error: "invalid" });
    expect(avancer).not.toHaveBeenCalled();
  });

  it("limite par IP : « rate »", async () => {
    ipSaturee = true;
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r).toEqual({ ok: false, error: "rate" });
    expect(avancer).not.toHaveBeenCalled();
  });

  it("échec de base : « unknown »", async () => {
    ligneParId = ligneVsl();
    avancer.mockRejectedValueOnce(new Error("base indisponible"));
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r).toEqual({ ok: false, error: "unknown" });
    expect(enfiler).not.toHaveBeenCalled();
  });
});

describe("R1/R2 — les tâches d'attente s'arrêtent à chaque avancée (réservation, dossier complet)", () => {
  it("annulerRelancesLeadApporteur retire A1, A2 et A3 d'une adresse — c'est ce qu'appellent la réservation et le dossier complet", async () => {
    const n = await annulerRelancesLeadApporteur("nadia@example.com", "réservation");
    expect(n).toBe(3);
    expect(retirer.mock.calls.map((c) => c[0]).sort()).toEqual(
      [
        "lead-apporteur-kit-hnadiaexamplecom",
        "lead-apporteur-relance-j2-hnadiaexamplecom",
        "lead-apporteur-relance-j7-hnadiaexamplecom",
      ].sort(),
    );
  });
});

describe("Lead vers Meta à l'étape 1 (lot 5)", () => {
  const appel = () =>
    envoyerMeta.mock.calls[0] as unknown as [
      string,
      {
        eventId: string;
        email: string;
        telephone?: string | null;
        prenom: string;
        fbp: string | null;
        fbclid: string | null;
        fbcCreeLe: Date | null;
        sourceUrl: string;
      },
      { consentPub: string },
    ];

  it("part à l'étape 1 avec event_id `lead:<id de la ligne>` — celui que le navigateur reçoit", async () => {
    cookieUtm = serializeUtmCookie({ utm_source: "facebook" });
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    expect(envoyerMeta).toHaveBeenCalledTimes(1);
    const [nom, evt, opts] = appel();
    expect(nom).toBe("Lead");
    // Déduplication : le navigateur tire `Lead` avec `eventID = "lead:" + leadId`.
    expect(evt.eventId).toBe(`lead:${r.leadId}`);
    expect(opts.consentPub).toBe("accepted");
    expect(evt.sourceUrl).toBe("https://axion-ia.com/fr/apporteur-affaires/video");
  });

  it("à l'étape 1 il n'y a NI téléphone NI ville : rien d'autre que l'e-mail et le prénom", async () => {
    await capturer();
    const [, evt] = appel();
    expect(evt.email).toBe("nadia@example.com");
    expect(evt.prenom).toBe("Nadia");
    expect(evt).not.toHaveProperty("telephone");
    expect(evt).not.toHaveProperty("ville");
  });

  it("le fbc se fabrique avec l'heure d'ARRIVÉE du clic, pas celle de l'envoi", async () => {
    await capturer();
    const [, evt] = appel();
    expect(evt.fbclid).toBe("IwAR0abcdefghijklmnop");
    expect(evt.fbcCreeLe?.getTime()).toBe(MAINTENANT - 60_000);
    expect(evt.fbp).toBe("fb.1.1725000000000.123456");
  });

  it("sans consentement publicitaire : la règle de refus reste celle de Meta (consentPub passé tel quel), fbp et fbclid ne sont pas transmis", async () => {
    await capturer({ consentPub: false });
    const [, evt, opts] = appel();
    expect(opts.consentPub).toBe("declined");
    expect(evt.fbp).toBeNull();
    expect(evt.fbclid).toBeNull();
    expect(evt.fbcCreeLe).toBeNull();
  });

  it("réponse à la bannière inconnue : « unknown » — le serveur n'en déduit jamais un accord", async () => {
    await capturer({ consentPub: undefined });
    expect(appel()[2].consentPub).toBe("unknown");
  });

  it("une ligne « suspecte » n'envoie RIEN à Meta", async () => {
    await capturer({}, { renderedAt: MAINTENANT - 500 });
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("un contact venu d'ailleurs (LinkedIn) n'est pas compté par la campagne Facebook", async () => {
    cookieUtm = serializeUtmCookie({ utm_source: "linkedin" });
    await capturer({}, { query: "?utm_source=linkedin" });
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("une adresse déjà connue, un lead réutilisé, un leurre : aucun nouvel événement (pas de double comptage)", async () => {
    lignesExistantes = [{ id: "ancien", details: { etape: "premier-contact", subType: "x" } }];
    await capturer();
    lignesExistantes = [{ id: "lead-existant", details: { vsl: { etapeAtteinte: 1 } } }];
    await capturer();
    lignesExistantes = [];
    await capturer({ honeypot: "spam" });
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("une panne de Meta ne fait pas échouer la capture", async () => {
    envoyerMeta.mockRejectedValueOnce(new Error("meta indisponible"));
    const r = await capturer();
    expect(r.ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// P2 (2026-10-10) — une personne DÉJÀ CONNUE revient par la publicité
// ───────────────────────────────────────────────────────────────────────────

const ID_FICHE = "33333333-3333-4333-8333-333333333333";
const ANCIENNE = { id: ID_FICHE, details: { subType: "candidature-commerciale", etape: "1" } };

describe("P2 — déjà connu(e) : étape 1", () => {
  it("garde une trace BORNÉE sur la fiche la plus récente — et rien d'autre", async () => {
    cookieUtm = serializeUtmCookie({
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "apporteurs-vsl-2026-10",
      utm_content: "annonce-42",
    });
    lignesExistantes = [ANCIENNE, { id: "plus-ancienne", details: { subType: "x" } }];
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.leadId).toBe(ID_FICHE);
    expect(ajouterRetour).toHaveBeenCalledTimes(1);
    expect(ajouterRetour.mock.calls[0]?.[0]).toBe(ID_FICHE);
    expect(ajouterRetour.mock.calls[0]?.[1]).toEqual({
      le: "2026-10-05T10:00:00.000Z",
      etape: 1,
      utm: {
        source: "facebook",
        medium: "paid",
        campaign: "apporteurs-vsl-2026-10",
        content: "annonce-42",
      },
      consentPub: true,
    });
    // Ni création, ni écriture de l'étape, ni e-mail, ni notification, ni Meta.
    expect(creer).not.toHaveBeenCalled();
    expect(majCible).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(envoyerMeta).not.toHaveBeenCalled();
    // Le jeton désigne la fiche, et son heure est celle de la trace.
    const j = verifierJeton(r.jeton);
    expect(j?.lead).toBe(ID_FICHE);
    expect(new Date(j?.iat ?? 0).toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });

  it("un robot pressé ne laisse aucune trace, mais reçoit la même forme de réponse", async () => {
    lignesExistantes = [ANCIENNE];
    const r = await capturer({}, { renderedAt: MAINTENANT - 500 });
    expect(r.ok).toBe(true);
    expect(ajouterRetour).not.toHaveBeenCalled();
  });
});

describe("P2 — déjà connu(e) : étape 2", () => {
  /** La fiche existante telle que la lit `ligneDejaConnue` puis la notification. */
  function ficheConnue() {
    return {
      id: ID_FICHE,
      contactEmailHash: "hnadiaexamplecom",
      contactName: "enc:Nadia",
      contactEmail: "enc:nadia@example.com",
      details: {
        subType: "candidature-commerciale",
        retoursVsl: [{ le: "2026-10-05T10:00:00.000Z", etape: 1, utm: { content: "annonce-42" } }],
      },
    };
  }

  it("complète la trace (téléphone CHIFFRÉ), prévient l'équipe une fois, n'écrit RIEN à la personne", async () => {
    lignesExistantes = [ANCIENNE];
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_FICHE, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.merciUrl).toMatch(/^\/apporteur-affaires\/video\/merci\?j=/);
    expect(completerRetour).toHaveBeenCalledTimes(1);
    expect(completerRetour.mock.calls[0]?.[0]).toMatchObject({
      id: ID_FICHE,
      le: "2026-10-05T10:00:00.000Z",
      telephoneChiffre: "enc:06 12 34 56 78",
      reponseId: "5-20",
      suspect: false,
    });
    // Le lead vidéo n'avance pas : la fiche existante garde son étape et son téléphone.
    expect(avancer).not.toHaveBeenCalled();
    // UNE notification, dédoublonnée par fiche et par jour.
    expect(notifier).toHaveBeenCalledTimes(1);
    const n = notifier.mock.calls[0]?.[0] as {
      dedupKey: string;
      payload: { contactName: string; submissionId: string };
    };
    expect(n.dedupKey).toBe(`retour-vsl:${ID_FICHE}:2026-10-05`);
    expect(n.payload.submissionId).toBe(ID_FICHE);
    expect(n.payload.contactName).toContain("Déjà connu(e) : revenu(e) par la publicité");
    // Le récapitulatif interne SEULEMENT : aucun e-mail vers la personne.
    const envois = jobsPoses();
    expect(envois.map((e) => e.gabarit)).toEqual(["candidature-commercial-recap"]);
    expect(envois[0]?.a).toBe("contact@axion-ia.com");
    const lignes = (envois[0]?.payload["rows"] as Array<{ label: string; value: string }>) ?? [];
    expect(lignes).toContainEqual({ label: "Déjà connu(e)", value: "revenu(e) par la publicité" });
    expect(lignes.find((l) => l.label === "Fiche existante")?.value).toBe(
      `https://axion-ia.com/fr/console/contacts/commercial/${ID_FICHE}`,
    );
    // Aucune relance annulée ni posée, aucun Meta serveur.
    expect(retirer).not.toHaveBeenCalled();
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("double validation : la trace est déjà complète → aucune seconde notification", async () => {
    lignesExistantes = [ANCIENNE];
    ligneParId = ficheConnue();
    completerRetour.mockResolvedValue("deja");
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_FICHE, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(notifier).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("🔒 (e) quelqu'un qui tape l'adresse d'autrui ne lit RIEN et n'écrase RIEN", async () => {
    // L'intrus a validé l'étape 1 avec l'adresse de Nadia : il a reçu un jeton.
    lignesExistantes = [ANCIENNE];
    const r1 = await capturer({ prenom: "Intrus", email: "nadia@example.com" });
    if (!r1.ok) throw new Error("attendu : succès");
    // Rien de la fiche ne lui est rendu : ni prénom, ni téléphone, ni étape.
    expect(JSON.stringify(r1)).not.toMatch(/Nadia|enc:|06 |premier-contact/);
    // Seule écriture : UNE entrée ajoutée, qui ne porte pas même le prénom tapé.
    expect(ajouterRetour).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(ajouterRetour.mock.calls[0])).not.toContain("Intrus");

    // Étape 2 : il pose SON téléphone. Il est rangé (chiffré) dans la trace, jamais
    // à la place du téléphone de la fiche ; la réponse ne dit rien de plus.
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    const r2 = await completer(r1.jeton, { telephone: "07 00 00 00 00" });
    if (!r2.ok) throw new Error("attendu : succès");
    expect(Object.keys(r2).sort()).toEqual(["merciUrl", "ok"]);
    expect(JSON.stringify(r2)).not.toMatch(/Nadia|nadia@|enc:/);
    expect(avancer).not.toHaveBeenCalled(); // ni `contact_phone`, ni étape
    expect(creer).not.toHaveBeenCalled();
    expect(completerRetour.mock.calls[0]?.[0]).toMatchObject({
      telephoneChiffre: "enc:07 00 00 00 00",
    });
    // Aucun e-mail ne part vers l'adresse tapée.
    expect(jobsPoses().every((j) => j.a !== "nadia@example.com")).toBe(true);
  });

  it("un jeton de REPRISE (lien d'e-mail) ne mène jamais au parcours « déjà connu »", async () => {
    lignesExistantes = [ANCIENNE];
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_FICHE, genre: "reprise", maintenant: MAINTENANT }));
    expect(completerRetour).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("validée trop vite : trace marquée suspecte, aucune notification", async () => {
    lignesExistantes = [ANCIENNE];
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 500);
    await completer(creerJeton({ lead: ID_FICHE, maintenant: MAINTENANT }));
    expect(completerRetour.mock.calls[0]?.[0]).toMatchObject({ suspect: true });
    expect(notifier).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// P6 (2026-10-10) — `SubmitApplication` vers Meta à l'étape 2
// ───────────────────────────────────────────────────────────────────────────

describe("SubmitApplication vers Meta à l'étape 2", () => {
  const ficheMeta = (funnel: Record<string, unknown>, source = "facebook") =>
    ligneVsl({
      details: {
        vsl: { etapeAtteinte: 1, version: "vsl-v1" },
        funnel,
        candidature: { sourceConnaissance: source },
      },
    });
  const ACCEPTE = {
    consentPub: { accepte: true, le: "2026-10-05T10:00:00.000Z" },
    fbp: "fb.1.1725000000000.123456",
    fbclidValeur: "IwAR0abcdefghijklmnop",
    fbcCreeLe: "2026-10-05T09:59:00.000Z",
  };
  const appel = () =>
    envoyerMeta.mock.calls.find((c) => c[0] === "SubmitApplication") as unknown as
      [string, Record<string, unknown>, { consentPub: string }] | undefined;

  it("part avec event_id `candidature:<id>` — celui que le navigateur reçoit —, le téléphone et le consentement de la FICHE", async () => {
    ligneParId = ficheMeta(ACCEPTE);
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.candidature).toBe(`candidature:${ID_LEAD}`);
    const a = appel();
    expect(a).toBeDefined();
    const [, evt, opts] = a!;
    expect(evt["eventId"]).toBe(`candidature:${ID_LEAD}`);
    expect(evt["email"]).toBe("nadia@example.com");
    expect(evt["telephone"]).toBe("06 12 34 56 78");
    expect(evt["fbp"]).toBe("fb.1.1725000000000.123456");
    expect(evt["fbclid"]).toBe("IwAR0abcdefghijklmnop");
    expect((evt["fbcCreeLe"] as Date).toISOString()).toBe("2026-10-05T09:59:00.000Z");
    expect(evt["sourceUrl"]).toBe("https://axion-ia.com/fr/apporteur-affaires/video");
    expect(opts.consentPub).toBe("accepted");
  });

  it("refus ou absence de réponse à la bannière sur la fiche : la règle de refus de Meta s'applique (jamais « accepted » déduit)", async () => {
    ligneParId = ficheMeta({ consentPub: { accepte: false, le: "x" } });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appel()?.[2].consentPub).toBe("declined");
    envoyerMeta.mockClear();
    ligneParId = ficheMeta({});
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appel()?.[2].consentPub).toBe("unknown");
  });

  it("contact qui ne vient pas de Facebook / Instagram : rien ne part", async () => {
    ligneParId = ficheMeta(ACCEPTE, "linkedin");
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appel()).toBeUndefined();
  });

  it("ligne suspecte : ni envoi, ni eventID rendu au navigateur", async () => {
    ligneParId = ficheMeta(ACCEPTE);
    vi.setSystemTime(MAINTENANT + 500); // trop rapide
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.candidature).toBeUndefined();
    expect(appel()).toBeUndefined();
  });

  it("double validation (« deja ») : même eventID rendu, aucun second envoi serveur", async () => {
    ligneParId = ficheMeta(ACCEPTE);
    avancer.mockResolvedValue("deja");
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.candidature).toBe(`candidature:${ID_LEAD}`);
    expect(appel()).toBeUndefined();
  });

  it("personne DÉJÀ CONNUE (P2) : ni envoi serveur, ni eventID rendu", async () => {
    lignesExistantes = [ANCIENNE];
    ligneParId = {
      id: ID_FICHE,
      contactEmailHash: "hnadiaexamplecom",
      contactName: "enc:Nadia",
      contactEmail: "enc:nadia@example.com",
      details: { subType: "candidature-commerciale", ...{ funnel: ACCEPTE } },
    };
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_FICHE, maintenant: MAINTENANT }));
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.candidature).toBeUndefined();
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("une panne de Meta ne fait pas échouer l'étape 2", async () => {
    ligneParId = ficheMeta(ACCEPTE);
    envoyerMeta.mockRejectedValueOnce(new Error("défaut de programmation"));
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
  });
});
