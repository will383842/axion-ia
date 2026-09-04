/**
 * Action serveur du premier contact Facebook — ce qu'elle écrit, et dans quel ordre.
 *
 * Les garanties testées :
 *   1. la ligne est en base AVANT toute notification, avec la source posée
 *      automatiquement (`facebook`), l'étape « premier-contact », et les UTM
 *      du cookie fusionnées à celles de la requête d'arrivée ;
 *   2. le robot (honeypot) reçoit un succès silencieux et rien n'est écrit ;
 *   3. un consentement absent est refusé au parsing — jamais enregistré ;
 *   4. les deux relances sont posées avec les bons délais et des jobId sans « : » ;
 *   5. l'API Conversions n'est appelée qu'avec la réponse à la bannière transmise
 *      telle quelle (c'est elle qui décide, pas l'action) ;
 *   6. un échec d'écriture rend `ok: false` et n'envoie rien.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { serializeUtmCookie } from "@/lib/utm";

const creer = vi.fn(async (a: unknown) => ({
  id: "11111111-1111-4111-8111-111111111111",
  submittedAt: new Date("2026-09-03T10:00:00Z"),
  _args: a,
}));
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const notifier = vi.fn(async (_a: unknown) => ({ ok: true }));
const envoyerMeta = vi.fn(async (_i: unknown, _o: unknown) => ({ envoye: true as const }));
const consentement = vi.fn(async (_a: unknown) => true);
const honeypot = vi.fn();
let cookieUtm: string | undefined;

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1, remaining: 9, resetAt: 0, panne: false }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { create: (a: unknown) => creer(a) } },
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
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h-${e.replace(/[^a-z]/g, "")}`,
}));
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
  emailsQueue: null,
}));
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
  envoyerLeadMeta: (i: unknown, o: unknown) => envoyerMeta(i, o),
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CALENDLY_APPORTEUR_URL: "https://calendly.com/axion/apporteur" },
}));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/console/${p}` }));

import { submitLeadApporteurAction } from "../lead-actions";

function formulaire(payload: unknown, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  fd.set("locale", "fr");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const valide = {
  prenom: "Nadia",
  email: "nadia@example.com",
  telephone: "06 12 34 56 78",
  ville: "Grenoble",
  statut: "salarie",
  consent: true,
  contexte: {
    query: "?utm_source=facebook&utm_content=video-b&fbclid=IwAR0abcdefghijklmnop",
    consentPub: "accepted",
    fbp: "fb.1.1725000000000.123456",
  },
};

type CreateArgs = { data: { details: Record<string, unknown>; contactName: string } };

beforeEach(() => {
  creer.mockClear();
  enfiler.mockClear();
  notifier.mockClear();
  envoyerMeta.mockClear();
  consentement.mockClear();
  honeypot.mockClear();
  cookieUtm = undefined;
});

describe("submitLeadApporteurAction", () => {
  it("écrit la ligne avec la source facebook, l'étape premier-contact, et les UTM (cookie prioritaire)", async () => {
    cookieUtm = serializeUtmCookie({ utm_source: "facebook", utm_campaign: "apporteurs-sept" });
    const r = await submitLeadApporteurAction({ ok: false, error: "" }, formulaire(valide));
    expect(r).toEqual({ ok: true, submissionId: "11111111-1111-4111-8111-111111111111" });

    expect(creer).toHaveBeenCalledTimes(1);
    const args = creer.mock.calls[0]?.[0] as CreateArgs;
    const d = args.data.details;
    expect(args.data.contactName).toBe("enc:Nadia");
    expect(d.unifiedType).toBe("recrutement");
    expect(d.subType).toBe("candidature-commerciale");
    expect(d.etape).toBe("premier-contact");
    // Le CHEMIN de la landing (renommé le 2026-09-04). Valeur littérale et non
    // `TUNNEL_FACEBOOK_PATH` : recopier la constante ne testerait rien, alors
    // que ce littéral verrouille ce qui part réellement en base.
    expect(d.source).toBe("/apporteur-affaires");
    const candidature = d.candidature as Record<string, unknown>;
    // Le CANAL, lui, reste `facebook` : c'est de là que vient la personne.
    // Renommer l'URL ne doit PAS casser l'attribution de la campagne — c'est
    // l'invariant que ces deux lignes gardent ensemble.
    expect(candidature.sourceConnaissance).toBe("facebook");
    expect(candidature.experiences).toEqual([]);
    expect(candidature.statut).toBe("salarie");
    // Cookie (campagne) + requête (contenu) fusionnés, le cookie prime sur la source.
    const funnel = d.funnel as { utm: Record<string, string>; fbclid?: boolean };
    expect(funnel.utm).toEqual({
      utm_source: "facebook",
      utm_campaign: "apporteurs-sept",
      utm_content: "video-b",
    });
    expect(funnel.fbclid).toBe(true);
    // Aucune donnée personnelle en clair dans details.
    expect(JSON.stringify(d)).not.toContain("nadia@");
    expect(JSON.stringify(d)).not.toContain("06 12");
  });

  it("notifie, envoie l'e-mail candidat avec dossier + créneau, le récap interne, et deux relances", async () => {
    await submitLeadApporteurAction({ ok: false, error: "" }, formulaire(valide));
    expect(notifier).toHaveBeenCalledTimes(1);

    const gabarits = enfiler.mock.calls.map((c) => c[0]);
    expect(gabarits).toEqual([
      "lead-apporteur-recu",
      "candidature-commercial-recap",
      "lead-apporteur-relance",
      "lead-apporteur-relance",
    ]);

    const recu = enfiler.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(recu[1]).toBe("nadia@example.com");
    expect(recu[3].dossierUrl).toBe("https://axion-ia.com/fr/devenir-commercial-ia/candidature");
    expect(recu[3].creneauUrl).toBe("https://calendly.com/axion/apporteur");

    const relances = enfiler.mock.calls.slice(2) as unknown as Array<
      [string, string, string, Record<string, unknown>, { delayMs: number; jobId: string }]
    >;
    expect(relances[0]?.[3].etape).toBe("j2");
    expect(relances[0]?.[4].delayMs).toBe(2 * 24 * 3600 * 1000);
    expect(relances[1]?.[3].etape).toBe("j7");
    expect(relances[1]?.[4].delayMs).toBe(7 * 24 * 3600 * 1000);
    for (const r of relances) {
      expect(r[4].jobId).not.toContain(":");
      expect(r[4].jobId).not.toContain("@");
    }
  });

  it("transmet à l'API Conversions la réponse à la bannière telle quelle — c'est elle qui décide", async () => {
    await submitLeadApporteurAction({ ok: false, error: "" }, formulaire(valide));
    expect(envoyerMeta).toHaveBeenCalledTimes(1);
    const [input, options] = envoyerMeta.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { consentPub: string },
    ];
    expect(options.consentPub).toBe("accepted");
    expect(input.submissionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(input.fbp).toBe("fb.1.1725000000000.123456");
    expect(input.fbclid).toBe("IwAR0abcdefghijklmnop");

    envoyerMeta.mockClear();
    await submitLeadApporteurAction(
      { ok: false, error: "" },
      formulaire({ ...valide, contexte: { consentPub: "declined" } }),
    );
    const [, o2] = envoyerMeta.mock.calls[0] as unknown as [unknown, { consentPub: string }];
    expect(o2.consentPub).toBe("declined");
  });

  it("robot (honeypot) : succès silencieux, rien n'est écrit ni envoyé", async () => {
    const r = await submitLeadApporteurAction(
      { ok: false, error: "" },
      formulaire(valide, { website: "http://spam.example" }),
    );
    expect(r).toEqual({ ok: true, submissionId: "" });
    expect(honeypot).toHaveBeenCalledTimes(1);
    expect(creer).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("consentement absent ou payload illisible : refusé avant toute écriture", async () => {
    const r1 = await submitLeadApporteurAction(
      { ok: false, error: "" },
      formulaire({ ...valide, consent: false }),
    );
    expect(r1.ok).toBe(false);
    const fd = new FormData();
    fd.set("payload", "{pas du json");
    const r2 = await submitLeadApporteurAction({ ok: false, error: "" }, fd);
    expect(r2.ok).toBe(false);
    expect(creer).not.toHaveBeenCalled();
  });

  it("un échec d'écriture rend ok:false et n'envoie rien", async () => {
    creer.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const r = await submitLeadApporteurAction({ ok: false, error: "" }, formulaire(valide));
    expect(r.ok).toBe(false);
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
    expect(envoyerMeta).not.toHaveBeenCalled();
  });
});
