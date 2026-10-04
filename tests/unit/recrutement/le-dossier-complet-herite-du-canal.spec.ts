// Le dossier complet garde le CANAL du premier contact (2026-09-29).
//
// L'annonce LinkedIn pointe vers `/apporteur-affaires?utm_source=linkedin` : le
// premier contact est attribué à LinkedIn, et le brouillon du dossier porte ce
// canal. Mais le dossier s'ouvre souvent depuis l'e-mail, sur un AUTRE appareil
// — sans brouillon, donc sans source. L'action reprend alors le canal du
// premier contact de la même personne, sinon l'`utm_source` connu du cookie.
// Une source déclarée dans le wizard prime toujours.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeUtmCookie } from "@/lib/utm";

const h = vi.hoisted(() => ({
  creer: vi.fn(async (_a: unknown) => ({
    id: "44444444-4444-4444-8444-444444444444",
    submittedAt: new Date("2026-09-29T10:00:00Z"),
  })),
  trouver: vi.fn(async (_a: unknown): Promise<unknown> => null),
  cookieUtm: undefined as string | undefined,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, panne: false }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.29" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      create: (a: unknown) => h.creer(a),
      count: async () => 1,
      findFirst: (a: unknown) => h.trouver(a),
    },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({
    get: (name: string) =>
      name === "axion_utm" && h.cookieUtm ? { value: h.cookieUtm } : undefined,
  }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/server/notifications", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => ({ enqueued: true }) }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: async () => 0,
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { commercialApplication: "commercial-tunnel" },
  recordConsentEvent: async () => true,
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `chiffre(${v})` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte-camille" }));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin" }));

const { submitCommercialApplicationAction } =
  await import("@/features/commercial-application/actions");

function dossier(extra: Record<string, unknown> = {}) {
  return {
    prenom: "Camille",
    nom: "Durand",
    email: "camille.durand@example.com",
    telephone: "0612345678",
    ville: "Grenoble",
    codePostal: "38000",
    b2bDejaVendu: true,
    b2bAnnees: "5-10",
    experiences: [
      {
        entreprise: "Exemple SAS",
        ville: "Grenoble",
        poste: "Chargée d'affaires",
        debut: "2019-03",
        posteActuel: true,
      },
    ],
    iaUtilise: false,
    informatiqueUtilise: false,
    zoneMobile: true,
    deplacement: "oui",
    pitch: "Je connais bien le tissu des PME de l'Isère et je sais les écouter. ".repeat(3),
    disponibilite: "2026-10",
    permisVehicule: true,
    consent: true,
    ...extra,
  };
}

async function envoyer(payload: Record<string, unknown>, champs: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  fd.set("locale", "fr");
  for (const [cle, valeur] of Object.entries(champs)) fd.set(cle, valeur);
  const r = await submitCommercialApplicationAction({ ok: false, error: "" }, fd);
  expect(r, "le dossier doit être écrit — contre-témoin").toMatchObject({ ok: true });
  const args = h.creer.mock.calls[0]?.[0] as {
    data: { details: { source: string; candidature: Record<string, unknown> } };
  };
  return args.data.details;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.trouver.mockResolvedValue(null);
  h.cookieUtm = undefined;
});

describe("attribution du dossier complet", () => {
  it("porte la source du dossier que lit l'invitation automatique", async () => {
    const d = await envoyer(dossier());
    expect(d.source).toBe("/devenir-commercial-ia/candidature");
  });

  it("sans source dans le wizard, reprend le canal du premier contact (LinkedIn)", async () => {
    h.trouver.mockResolvedValue({
      details: { candidature: { sourceConnaissance: "linkedin" } },
    });
    const d = await envoyer(dossier());
    expect(d.candidature.sourceConnaissance).toBe("linkedin");
  });

  it("sans premier contact, reprend l'utm_source connu du cookie d'arrivée", async () => {
    h.cookieUtm = serializeUtmCookie({
      utm_source: "linkedin",
      utm_campaign: "apporteurs-2026-10",
    });
    const d = await envoyer(dossier());
    expect(d.candidature.sourceConnaissance).toBe("linkedin");
  });

  it("n'invente rien : ni premier contact ni utm connu → pas de source", async () => {
    h.cookieUtm = serializeUtmCookie({ utm_source: "inconnu" });
    const d = await envoyer(dossier());
    expect(d.candidature).not.toHaveProperty("sourceConnaissance");
  });

  it("la source déclarée dans le wizard prime toujours", async () => {
    h.trouver.mockResolvedValue({
      details: { candidature: { sourceConnaissance: "linkedin" } },
    });
    const d = await envoyer(dossier({ sourceConnaissance: "indeed" }));
    expect(d.candidature.sourceConnaissance).toBe("indeed");
    // INT-T52-A : sans code dans le lien, le premier contact est lu UNE fois, pour son code de
    // parrainage (rattrapage 94) — jamais pour la source, que le wizard a déclarée.
    expect(h.trouver.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("source déclarée ET code dans le lien : le premier contact n'est jamais lu", async () => {
    h.trouver.mockResolvedValue({
      details: { candidature: { sourceConnaissance: "linkedin" }, parrainCode: "AX7Q3M5R" },
    });
    const d = (await envoyer(dossier({ sourceConnaissance: "indeed" }), {
      parrainCode: "AX4D2K9P",
    })) as { candidature: Record<string, unknown>; parrainCode?: string };
    expect(d.candidature.sourceConnaissance).toBe("indeed");
    expect(d.parrainCode).toBe("AX4D2K9P");
    expect(h.trouver).not.toHaveBeenCalled();
  });

  it("une lecture du premier contact en échec ne coûte que l'attribution", async () => {
    h.trouver.mockRejectedValue(new Error("base indisponible"));
    const d = await envoyer(dossier());
    expect(d.candidature).not.toHaveProperty("sourceConnaissance");
  });
});
