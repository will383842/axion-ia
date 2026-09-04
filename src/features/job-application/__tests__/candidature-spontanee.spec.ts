/**
 * LA CANDIDATURE SPONTANÉE — ce que l'action doit accepter, et ce qu'elle doit
 * refuser.
 *
 * 🔴 CE QUI EXISTAIT AVANT, ET POURQUOI CE N'ÉTAIT PAS UNE CANDIDATURE.
 *
 * « Candidature spontanée » était écrite à trois endroits de `/carrieres` et
 * les trois pointaient vers `/contact`. Le geste produisait donc une
 * `Submission` : sans CV, sans photo, sans journal, sans entretien, sans
 * décision, sans motif, sans export — et **invisible** dans les écrans de
 * recrutement, qui ne fusionnent que les `JobApplication` et les submissions de
 * sous-type commercial. Le message Telegram annonçait pourtant « Candidature
 * spontanée », pour un dossier qui n'existait nulle part dans la console.
 *
 * 🔑 LES TROIS PROPRIÉTÉS QUE CE FICHIER VERROUILLE :
 *
 * 1. sans offre, la candidature est ACCEPTÉE, et `offerTitleSnap` porte le
 *    poste saisi — l'aval (console, e-mails, export) lit un titre, jamais une
 *    offre, et continue donc de fonctionner sans rien savoir de ce cas ;
 * 2. sans offre NI poste visé, elle est REFUSÉE **avant** la base. Sans ce
 *    refus, `offerTitleSnap` étant NOT NULL, l'insertion échouerait au fond de
 *    la pile sur un message Postgres que le candidat lirait « une erreur est
 *    survenue » ;
 * 3. elle n'est PAS émise vers le CRM (ADR 0047 §4, arbitrage 1, option C) —
 *    `candidateFamilyForOffer` produirait une valeur qui doit exister dans un
 *    `CHECK` SQL de l'autre dépôt, et une famille inconnue là-bas ferait
 *    refuser TOUTES les fiches qui la portent, pas seulement les nouvelles.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit";

const creerCandidature = vi.fn(async (_a: unknown) => ({
  id: "app-spontanee-1",
  submittedAt: new Date("2026-09-04T09:00:00Z"),
}));
const trouverOffre = vi.fn(async (_a: unknown) => null);
const emettreVersCrm = vi.fn(async (_a: unknown) => undefined);

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (_cle: string, config: RateLimitConfig): Promise<RateLimitResult> => ({
    allowed: true,
    count: 1,
    remaining: config.limit - 1,
    resetAt: 0,
    panne: false,
  }),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findUnique: (a: unknown) => trouverOffre(a) },
    jobApplication: { create: (a: unknown) => creerCandidature(a) },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({
  storeCv: async () => "/var/data/cv/x/CV.pdf",
  CV_MAX_BYTES: 8 * 1024 * 1024,
  CV_ALLOWED_EXTENSIONS: [".pdf", ".doc", ".docx"] as const,
  CV_ALLOWED_MIME: ["application/pdf"] as const,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/server/notifications", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => undefined }));
vi.mock("@/server/crm-sync", () => ({
  syncCandidateToCrm: (a: unknown) => emettreVersCrm(a),
}));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: async () => true,
  CONSENT_FORM_REFS: {
    jobApplication: "job-application-form",
    jobApplicationVivier: "job-application-vivier",
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin" }));

import { submitJobApplicationAction } from "../actions";

/** Le socle commun : tout sauf ce qui désigne le poste. */
function base(): FormData {
  const fd = new FormData();
  fd.set("firstName", "Camille");
  fd.set("lastName", "Roux");
  fd.set("email", "camille@example.com");
  fd.set("phone", "0600000001");
  fd.set("city", "Grenoble");
  fd.set("consent", "true");
  fd.set("locale", "fr");
  fd.set("cf-turnstile-response", "jeton");
  return fd;
}

/** Les données passées à `prisma.jobApplication.create`. */
function donneesEcrites(): Record<string, unknown> {
  const appel = creerCandidature.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
  return appel?.data ?? {};
}

describe("la candidature spontanée — sans offre, mais pas sans poste", () => {
  beforeEach(() => {
    creerCandidature.mockClear();
    trouverOffre.mockClear();
    emettreVersCrm.mockClear();
  });

  it("🔴 ACCEPTE une candidature sans offre, et écrit le poste visé", async () => {
    const fd = base();
    fd.set("posteVise", "Monteur vidéo");

    const r = await submitJobApplicationAction({ ok: false, error: "" }, fd);

    expect(r.ok, `refusée : ${"error" in r ? r.error : ""}`).toBe(true);
    const data = donneesEcrites();
    expect(data["offerId"], "une spontanée ne pointe sur aucune offre").toBeNull();
    expect(
      data["offerTitleSnap"],
      "le poste saisi doit alimenter l'instantané — c'est lui que la console, " +
        "les e-mails et l'export liront",
    ).toBe("Monteur vidéo");
  });

  it("🔑 ne CHERCHE même pas d'offre — une requête sur `undefined` ne lève pas, elle ne trouve rien", async () => {
    const fd = base();
    fd.set("posteVise", "Formateur");

    await submitJobApplicationAction({ ok: false, error: "" }, fd);

    // Si l'action interrogeait quand même la table, elle recevrait `null` et
    // refuserait avec « Cette offre n'est plus ouverte » — un motif qui ne
    // concerne pas ce candidat.
    expect(trouverOffre).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE sans offre ni poste visé — avant la base, pas au fond de la pile", async () => {
    const r = await submitJobApplicationAction({ ok: false, error: "" }, base());

    expect(r.ok).toBe(false);
    expect(
      "error" in r ? r.error : "",
      "le message doit dire quoi faire : `offerTitleSnap` est NOT NULL, et sans " +
        "ce refus l'insertion échouerait sur un message Postgres illisible",
    ).toMatch(/poste/i);
    expect(creerCandidature, "rien ne doit être écrit").not.toHaveBeenCalled();
  });

  it("🔴 n'émet RIEN vers le CRM — ADR 0047 §4, arbitrage 1, option C", async () => {
    const fd = base();
    fd.set("posteVise", "Chargé de communication");

    await submitJobApplicationAction({ ok: false, error: "" }, fd);

    // 🔑 `candidateFamilyForOffer` produirait une valeur qui doit exister dans
    // un `CHECK` SQL de l'AUTRE dépôt. Une famille inconnue là-bas fait refuser
    // toutes les fiches qui la portent — pas seulement les nouvelles.
    expect(
      emettreVersCrm,
      "une spontanée ne franchit pas la frontière tant que Will n'a pas tranché",
    ).not.toHaveBeenCalled();
  });

  it("🔑 le poste visé est BORNÉ à la largeur de la colonne", async () => {
    // `offer_title_snap` est un `VARCHAR(160)`. Au-delà, Postgres refuse
    // l'insertion au fond de la pile — le candidat verrait « une erreur est
    // survenue » pour un titre trop long, et n'y reviendrait pas.
    const fd = base();
    fd.set("posteVise", "x".repeat(200));

    const r = await submitJobApplicationAction({ ok: false, error: "" }, fd);

    expect(r.ok, "un poste de 200 caractères doit être refusé par le schéma").toBe(false);
    expect(creerCandidature).not.toHaveBeenCalled();
  });
});
