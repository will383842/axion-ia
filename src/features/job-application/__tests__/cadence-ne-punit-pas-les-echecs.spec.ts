/**
 * 🔴 Le seul compteur du formulaire de candidature punissait les gens qui
 * échouaient déjà.
 *
 * `checkRateLimit(3 / 10 min)` était consommé à la PREMIÈRE ligne de l'action,
 * avant le captcha, avant la validation. Le candidat à qui Cloudflare sert un
 * défi interactif voit « Captcha échoué », réessaie deux fois — et au 4e essai
 * bascule sur « Trop de tentatives », un second message d'erreur qui ressemble
 * au premier et qui verrouille dix minutes. Deux personnes derrière la même box
 * partagent ce compteur : essayer depuis l'ordinateur d'un proche ne débloque
 * rien, et changer de navigateur non plus, parce que Cloudflare juge la
 * CONNEXION.
 *
 * C'est mot pour mot le récit d'un candidat le 2026-08-19 (« j'ai testé avec
 * différents navigateurs », « un proche a testé avec son ordinateur, même
 * problème »), pendant que la boîte répondait que tout fonctionnait — ce qui
 * était vrai pour qui passait le captcha du premier coup.
 *
 * 🔑 L'invariant qu'on verrouille ici n'est pas une valeur, c'est une FORME :
 * un compteur qu'un échec consomme doit être large, et le compteur serré doit
 * vivre APRÈS tous les refus. Un test qui se contenterait de lire « limit: 8 »
 * laisserait quelqu'un remettre 3 sur le compteur d'avant-captcha.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit";

const appelsCadence: Array<{ cle: string; config: RateLimitConfig }> = [];
let cadenceAutorise = true;
// Signature recopiée sur `verifyTurnstile` : un mock plus étroit que le vrai
// contrat passerait le test et mentirait sur l'appel réellement fait.
const verifierCaptcha = vi.fn(async (_token: string | undefined | null, _ip?: string) => true);
const creerCandidature = vi.fn(async (_a: unknown) => ({
  id: "app-1",
  submittedAt: new Date("2026-08-24T12:00:00Z"),
}));
const trouverOffre = vi.fn(async (_a: unknown) => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "charge-relations-presse",
  titleFr: "Chargé de relations presse",
  category: "communication",
  status: "published",
  filledAt: null,
  validThrough: null,
}));
const rangerFichier = vi.fn(async (_b: Buffer, _n: string) => "/var/data/cv/x/CV.pdf");

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string, config: RateLimitConfig): Promise<RateLimitResult> => {
    appelsCadence.push({ cle, config });
    return {
      allowed: cadenceAutorise,
      count: 1,
      remaining: cadenceAutorise ? config.limit - 1 : 0,
      resetAt: 0,
      // `panne` distingue « compté et refusé » de « compteur en panne ». Le
      // scénario testé est toujours un comptage réel.
      panne: false,
    };
  },
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: (t: string | null, ip?: string) => verifierCaptcha(t, ip),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findUnique: (a: unknown) => trouverOffre(a) },
    jobApplication: { create: (a: unknown) => creerCandidature(a) },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({
  storeCv: (b: Buffer, n: string) => rangerFichier(b, n),
  CV_MAX_BYTES: 8 * 1024 * 1024,
  CV_ALLOWED_EXTENSIONS: [".pdf", ".doc", ".docx"] as const,
  CV_ALLOWED_MIME: ["application/pdf"] as const,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  // 🔑 `cookies` est requis depuis le lot 5 : l'action lit le cookie de tunnel
  // pour en tirer la provenance. Le doublure rend un magasin VIDE — c'est le
  // cas réel majoritaire (navigation directe, cookie refusé, lien sans balise),
  // et celui qui doit laisser les quatre colonnes à `null`.
  //
  // ⚠️ Ce fichier n'éprouve PAS la provenance : il éprouve la cadence des
  // compteurs. La doublure doit donc être la plus neutre possible — lui faire
  // rendre un cookie garni ferait dépendre un test de cadence d'une valeur
  // d'attribution, et le rendrait faux pour une raison sans rapport.
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/server/notifications", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => undefined }));
vi.mock("@/server/crm-sync", () => ({ syncCandidateToCrm: async () => undefined }));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: async () => true,
  CONSENT_FORM_REFS: {
    jobApplication: "job-application-form",
    jobApplicationVivier: "job-application-vivier",
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin" }));

import { submitJobApplicationAction } from "../actions";

const OFFRE = "11111111-1111-4111-8111-111111111111";

function candidature(): FormData {
  const fd = new FormData();
  fd.set("offerId", OFFRE);
  fd.set("firstName", "Quentin");
  fd.set("lastName", "Martin");
  fd.set("email", "quentin@example.com");
  fd.set("phone", "0600000000");
  fd.set("city", "Vienne");
  fd.set("consent", "true");
  fd.set("locale", "fr");
  fd.set("cf-turnstile-response", "jeton");
  return fd;
}

/** Les clés consommées AVANT que le captcha ait rendu son verdict. */
function cadencesAvantCaptcha() {
  return appelsCadence.filter((a) => a.cle.includes(":attempt:"));
}
/** Les clés consommées seulement quand tout le reste a déjà passé. */
function cadencesApresCaptcha() {
  return appelsCadence.filter((a) => a.cle.includes(":accepted:"));
}

beforeEach(() => {
  appelsCadence.length = 0;
  cadenceAutorise = true;
  vi.clearAllMocks();
  verifierCaptcha.mockResolvedValue(true);
  creerCandidature.mockResolvedValue({
    id: "app-1",
    submittedAt: new Date("2026-08-24T12:00:00Z"),
  });
  trouverOffre.mockResolvedValue({
    id: OFFRE,
    slug: "charge-relations-presse",
    titleFr: "Chargé de relations presse",
    category: "communication",
    status: "published",
    filledAt: null,
    validThrough: null,
  });
});

describe("🔴 la cadence ne doit pas punir les échecs", () => {
  it("🔴 un captcha refusé ne consomme AUCUNE unité du compteur serré", async () => {
    verifierCaptcha.mockResolvedValue(false);

    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidature());

    expect(r.ok).toBe(false);
    // Le compteur large a bien vu passer l'essai — c'est son rôle.
    expect(cadencesAvantCaptcha()).toHaveLength(1);
    // Le compteur serré, lui, n'a pas été touché : c'est ce qui empêche
    // qu'échouer trois fois au captcha ferme la porte pour dix minutes.
    expect(cadencesApresCaptcha()).toHaveLength(0);
  });

  it("🔴 des champs invalides ne consomment pas non plus le compteur serré", async () => {
    const fd = candidature();
    fd.set("email", "pas-une-adresse");

    const r = await submitJobApplicationAction({ ok: false, error: "" }, fd);

    expect(r.ok).toBe(false);
    expect(cadencesApresCaptcha()).toHaveLength(0);
  });

  it("🔴 une offre fermée ne consomme pas non plus le compteur serré", async () => {
    trouverOffre.mockResolvedValue({
      id: OFFRE,
      slug: "charge-relations-presse",
      titleFr: "Chargé de relations presse",
      category: "communication",
      status: "archived",
      filledAt: null,
      validThrough: null,
    });

    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidature());

    expect(r.ok).toBe(false);
    expect(cadencesApresCaptcha()).toHaveLength(0);
  });

  it("un envoi qui aboutit consomme les DEUX compteurs, le serré en dernier", async () => {
    const r = await submitJobApplicationAction({ ok: false, error: "" }, candidature());

    expect(r.ok).toBe(true);
    expect(cadencesAvantCaptcha()).toHaveLength(1);
    expect(cadencesApresCaptcha()).toHaveLength(1);
    // L'ordre est l'invariant : le serré vient après, sinon il redevient un
    // compteur d'échecs.
    const iLarge = appelsCadence.findIndex((a) => a.cle.includes(":attempt:"));
    const iSerre = appelsCadence.findIndex((a) => a.cle.includes(":accepted:"));
    expect(iLarge).toBeLessThan(iSerre);
  });

  it("🔴 le compteur d'avant-captcha laisse de la place à un humain qui se trompe", async () => {
    await submitJobApplicationAction({ ok: false, error: "" }, candidature());

    const large = cadencesAvantCaptcha()[0];
    expect(large).toBeDefined();
    // Trois essais, c'était le réglage qui a produit la panne. Dix est le
    // plancher en dessous duquel un candidat qui bute sur un défi interactif
    // se retrouve enfermé avant d'avoir compris ce qu'on lui demandait.
    expect(large?.config.limit).toBeGreaterThanOrEqual(10);
  });

  it("🔴 un refus n'écrit AUCUN fichier sur le disque", async () => {
    // Un CV rangé hors web-root derrière un refus n'est référencé par aucune
    // ligne : plus rien ne peut le retrouver, donc plus rien ne peut l'effacer
    // au titre de l'article 17.
    verifierCaptcha.mockResolvedValue(false);
    const fd = candidature();
    fd.set("cv", new File([Buffer.from("%PDF-1.4 ...")], "cv.pdf", { type: "application/pdf" }));

    await submitJobApplicationAction({ ok: false, error: "" }, fd);

    expect(rangerFichier).not.toHaveBeenCalled();
  });
});
