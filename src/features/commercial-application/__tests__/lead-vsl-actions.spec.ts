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
const ajouterRetour = vi.fn<(...a: unknown[]) => Promise<"ecrit" | "deja" | "introuvable">>(
  async () => "ecrit",
);
const completerRetour = vi.fn<(...a: unknown[]) => Promise<"ecrit" | "deja" | "introuvable">>(
  async () => "ecrit",
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
  ajouterRetour.mockReset();
  ajouterRetour.mockResolvedValue("ecrit");
  completerRetour.mockReset();
  completerRetour.mockResolvedValue("ecrit");
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

  it("R3 : une adresse déjà connue (ancien formulaire, dossier) reçoit un succès — aucune création, aucun envoi, une TRACE du retour seulement", async () => {
    cookieUtm = serializeUtmCookie({
      utm_source: "facebook",
      utm_campaign: "apporteurs-vsl-2026-10",
      utm_content: "ad-42",
    });
    lignesExistantes = [
      { id: "ancien", details: { etape: "premier-contact", subType: "candidature-commerciale" } },
    ];
    const r = await capturer();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("attendu : succès");
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(consentement).not.toHaveBeenCalled();
    expect(majCible).not.toHaveBeenCalled();
    expect(envoyerMeta).not.toHaveBeenCalled();
    // Le jeton désigne la fiche existante ; son heure retrouve la trace à l'étape 2.
    expect(r.leadId).toBe("ancien");
    const c = verifierJeton(r.jeton);
    expect(c?.lead).toBe("ancien");
    expect(ajouterRetour).toHaveBeenCalledTimes(1);
    expect(ajouterRetour.mock.calls[0]).toEqual([
      "ancien",
      {
        le: new Date(c?.iat ?? 0).toISOString(),
        etape: 1,
        utm: { source: "facebook", campaign: "apporteurs-vsl-2026-10", content: "ad-42" },
        consentPub: true,
      },
    ]);
  });

  it("R3 : la trace va à la fiche existante la PLUS RÉCENTE qui n'est pas un lead vidéo", async () => {
    lignesExistantes = [
      { id: "lead-video", details: { vsl: { etapeAtteinte: 1 } } },
      { id: "recente", details: { subType: "candidature-commerciale" } },
      { id: "ancienne", details: { subType: "candidature-commerciale" } },
    ];
    const r = await capturer();
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.leadId).toBe("recente");
    expect(ajouterRetour.mock.calls[0]?.[0]).toBe("recente");
  });

  it("R3 : déjà connue mais trop rapide (robot) : aucune trace, jeton suspect", async () => {
    lignesExistantes = [{ id: "ancien", details: { subType: "candidature-commerciale" } }];
    const r = await capturer({}, { renderedAt: MAINTENANT - 500 });
    if (!r.ok) throw new Error("attendu : succès");
    expect(ajouterRetour).not.toHaveBeenCalled();
    expect(verifierJeton(r.jeton)?.suspect).toBe(true);
  });

  it("R3 : trace impossible (base en panne) : la réponse reste un succès", async () => {
    lignesExistantes = [{ id: "ancien", details: { subType: "candidature-commerciale" } }];
    ajouterRetour.mockRejectedValueOnce(new Error("panne"));
    const r = await capturer();
    expect(r.ok).toBe(true);
  });

  it("R3 : la réponse pour une adresse connue est indiscernable d'une vraie (même forme, aucun drapeau)", async () => {
    const neuve = await capturer({ email: "neuve@example.com" });
    const EXISTANTE = "44444444-4444-4444-8444-444444444444";
    lignesExistantes = [{ id: EXISTANTE, details: { subType: "x" } }];
    const connue = await capturer({ email: "connue@example.com" });
    if (!neuve.ok || !connue.ok) throw new Error("attendu : succès");
    // Même forme d'identifiant (UUID) : celui de la fiche existante, rien de plus.
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(neuve.leadId).toMatch(UUID);
    expect(connue.leadId).toMatch(UUID);
    expect(connue.leadId).toBe(EXISTANTE);
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

  it("le jeton d'une ligne qui n'est PAS une fiche apporteur n'écrit rien", async () => {
    ligneParId = ligneVsl({ details: { etape: "premier-contact" } });
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(avancer).not.toHaveBeenCalled();
    expect(completerRetour).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
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

describe("🔴 R3 — personne DÉJÀ CONNUE revenue par la publicité (2026-10-10)", () => {
  const FICHE = "55555555-5555-4555-8555-555555555555";
  const LE = new Date(MAINTENANT).toISOString();
  function ficheConnue(retours: unknown[] = [{ le: LE, etape: 1, consentPub: true }]) {
    return {
      id: FICHE,
      contactName: "enc:Nadia",
      contactEmail: "enc:nadia@example.com",
      details: {
        subType: "candidature-commerciale",
        etape: "premier-contact",
        retoursVsl: [
          ...retours.map((r) =>
            r && typeof r === "object" && "le" in r && (r as { le: string }).le === LE
              ? { ...r, utm: { campaign: "apporteurs-vsl-2026-10", content: "ad-42" } }
              : r,
          ),
        ],
      },
    };
  }

  it("étape 2 : complète la TRACE (téléphone chiffré), jamais la fiche ni son téléphone", async () => {
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: FICHE, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("attendu : succès");
    expect(r.merciUrl).toMatch(/^\/apporteur-affaires\/video\/merci\?j=/);
    expect(verifierJeton(decodeURIComponent(r.merciUrl.split("?j=")[1] ?? ""))?.lead).toBe(FICHE);
    expect(completerRetour).toHaveBeenCalledTimes(1);
    expect(completerRetour.mock.calls[0]?.[0]).toMatchObject({
      id: FICHE,
      le: LE,
      dirigeants: "5-20",
      telephoneChiffre: "enc:06 12 34 56 78",
    });
    // `avancerVslEtape2` est le SEUL chemin qui écrit `contact_phone` : jamais ici.
    expect(avancer).not.toHaveBeenCalled();
    expect(majCible).not.toHaveBeenCalled();
  });

  it("prévient l'équipe UNE fois par fiche et par jour, avec le récapitulatif « Déjà connu(e) »", async () => {
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: FICHE, maintenant: MAINTENANT }));
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(notifier.mock.calls[0]?.[0]).toMatchObject({
      category: "COMMERCIAL_APPLICATION_RECEIVED",
      dedupKey: `retour-vsl:${FICHE}:2026-10-05`,
      payload: { submissionId: FICHE, contactPhone: "06 12 34 56 78" },
    });
    const jobs = jobsPoses();
    // AUCUN e-mail à la personne : le seul envoi est le récapitulatif interne.
    expect(jobs.map((j) => j.gabarit)).toEqual(["candidature-commercial-recap"]);
    expect(jobs[0]?.a).toBe("contact@axion-ia.com");
    const rows = (jobs[0]?.payload["rows"] ?? []) as Array<{ label: string; value: string }>;
    expect(rows).toContainEqual({ label: "Déjà connu(e)", value: "revenu(e) par la publicité" });
    expect(rows).toContainEqual({
      label: "Fiche existante",
      value: `https://axion-ia.com/fr/console/contacts/commercial/${FICHE}`,
    });
    expect(rows).toContainEqual({ label: "Campagne", value: "apporteurs-vsl-2026-10 · ad-42" });
    expect(jobs[0]?.payload["consoleUrl"]).toBe(
      `https://axion-ia.com/fr/console/contacts/commercial/${FICHE}`,
    );
    // Aucun événement Meta, aucune relance retirée ni posée pour la personne.
    expect(envoyerMeta).not.toHaveBeenCalled();
    expect(retirer).not.toHaveBeenCalled();
  });

  it("double clic (trace déjà complète) : succès, aucune seconde notification", async () => {
    ligneParId = ficheConnue();
    completerRetour.mockResolvedValue("deja");
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: FICHE, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
    expect(notifier).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("jeton suspect ou étape 2 trop rapide : succès, rien d'écrit ni d'envoyé", async () => {
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: FICHE, suspect: true, maintenant: MAINTENANT }));
    vi.setSystemTime(MAINTENANT + 500);
    await completer(creerJeton({ lead: FICHE, maintenant: MAINTENANT }));
    expect(completerRetour).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("fiche effacée (art. 17) : la trace s'écrit, mais rien ne part", async () => {
    ligneParId = { ...ficheConnue(), contactEmail: "enc:x@erased.local" };
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: FICHE, maintenant: MAINTENANT }));
    expect(notifier).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("🔒 l'adresse d'AUTRUI : on ne lit rien, on n'écrase rien — on n'AJOUTE qu'une trace bornée", async () => {
    // Étape 1 avec l'adresse d'une personne déjà connue.
    lignesExistantes = [{ id: FICHE, details: { subType: "candidature-commerciale" } }];
    const r1 = await capturer({ prenom: "Intrus", email: "nadia@example.com" });
    if (!r1.ok) throw new Error("attendu : succès");
    // La réponse ne porte ni le prénom ni l'adresse de la fiche.
    expect(JSON.stringify(r1)).not.toMatch(/Nadia|nadia@/);
    expect(Buffer.from(r1.jeton.split(".")[0] as string, "base64url").toString()).not.toMatch(
      /nadia|connu|known/i,
    );
    expect(creer).not.toHaveBeenCalled();
    expect(majCible).not.toHaveBeenCalled();
    expect(ajouterRetour).toHaveBeenCalledTimes(1);

    // Étape 2 : le numéro de l'intrus va dans la TRACE, jamais sur la fiche.
    ligneParId = ficheConnue();
    vi.setSystemTime(MAINTENANT + 30_000);
    const r2 = await completer(r1.jeton, { telephone: "07 00 00 00 00" });
    if (!r2.ok) throw new Error("attendu : succès");
    expect(JSON.stringify(r2)).not.toMatch(/Nadia|nadia@|06 12/);
    expect(avancer).not.toHaveBeenCalled();
    expect(completerRetour.mock.calls[0]?.[0]).toMatchObject({
      telephoneChiffre: "enc:07 00 00 00 00",
    });
    // Aucun e-mail ne part vers l'adresse de la fiche.
    expect(jobsPoses().every((j) => j.a !== "nadia@example.com")).toBe(true);
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

describe("SubmitApplication vers Meta à l'étape 2 (2026-10-10)", () => {
  const FICHE_ACCEPTEE = {
    vsl: { etapeAtteinte: 1, version: "vsl-v1" },
    funnel: {
      utm: { utm_campaign: "apporteurs" },
      consentPub: { accepte: true, le: "2026-10-05T10:00:00.000Z" },
      fbp: "fb.1.1725000000000.123456",
      fbclidValeur: "IwAR0abcdefghijklmnop",
      fbcCreeLe: "2026-10-05T09:59:00.000Z",
    },
    candidature: { sourceConnaissance: "facebook" },
  };
  const appelsSubmit = () => envoyerMeta.mock.calls.filter((c) => c[0] === "SubmitApplication");

  it("part avec event_id `candidature:<id de la ligne>`, le téléphone en plus, le consentement LU SUR LA FICHE", async () => {
    ligneParId = ligneVsl({ details: FICHE_ACCEPTEE });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appelsSubmit()).toHaveLength(1);
    const [, evt, opts] = appelsSubmit()[0] as unknown as [
      string,
      Record<string, unknown>,
      { consentPub: string },
    ];
    expect(evt).toMatchObject({
      eventId: `candidature:${ID_LEAD}`,
      email: "nadia@example.com",
      prenom: "Nadia",
      telephone: "06 12 34 56 78",
      fbp: "fb.1.1725000000000.123456",
      fbclid: "IwAR0abcdefghijklmnop",
      sourceUrl: "https://axion-ia.com/fr/apporteur-affaires/video",
    });
    expect(evt["fbcCreeLe"]).toEqual(new Date("2026-10-05T09:59:00.000Z"));
    expect(opts.consentPub).toBe("accepted");
  });

  it("refus ou absence de réponse tracée : la réponse part TELLE QUELLE (la règle de refus de Meta s'applique), ni fbp ni fbclid", async () => {
    ligneParId = ligneVsl({
      details: { ...FICHE_ACCEPTEE, funnel: { consentPub: { accepte: false } } },
    });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    const [, evt, opts] = appelsSubmit()[0] as unknown as [
      string,
      Record<string, unknown>,
      { consentPub: string },
    ];
    expect(opts.consentPub).toBe("declined");
    expect(evt["fbp"]).toBeNull();
    expect(evt["fbclid"]).toBeNull();
  });

  it("un contact venu d'ailleurs (LinkedIn) n'est pas compté", async () => {
    ligneParId = ligneVsl({
      details: { ...FICHE_ACCEPTEE, candidature: { sourceConnaissance: "linkedin" } },
    });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appelsSubmit()).toHaveLength(0);
  });

  it("ligne suspecte, étape 2 trop rapide, double clic : rien ne part", async () => {
    ligneParId = ligneVsl({ details: { ...FICHE_ACCEPTEE, vsl: { suspect: true } } });
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    ligneParId = ligneVsl({ details: FICHE_ACCEPTEE });
    vi.setSystemTime(MAINTENANT + 500);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    avancer.mockResolvedValue("deja");
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(appelsSubmit()).toHaveLength(0);
  });

  it("une personne DÉJÀ CONNUE n'envoie rien à Meta", async () => {
    ligneParId = {
      ...ligneVsl(),
      details: {
        subType: "candidature-commerciale",
        candidature: { sourceConnaissance: "facebook" },
      },
    };
    vi.setSystemTime(MAINTENANT + 30_000);
    await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(envoyerMeta).not.toHaveBeenCalled();
  });

  it("une panne de Meta ne fait pas échouer l'étape 2", async () => {
    ligneParId = ligneVsl({ details: FICHE_ACCEPTEE });
    envoyerMeta.mockRejectedValueOnce(new Error("panne"));
    vi.setSystemTime(MAINTENANT + 30_000);
    const r = await completer(creerJeton({ lead: ID_LEAD, maintenant: MAINTENANT }));
    expect(r.ok).toBe(true);
  });
});
