// @vitest-environment node
//
// Lot L3b — (a) la limite de débit par personne s'applique AUSSI aux charges v1 signées ;
// (b) clé HMAC absente en production : l'erreur n'est pas avalée (journal + alerte Sentry).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const etat = vi.hoisted(() => ({
  limites: [] as string[],
  refus: false,
  sentry: [] as unknown[],
  ecrit: 0,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string) => {
    etat.limites.push(cle);
    return { allowed: !etat.refus };
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => etat.sentry.push(a),
  captureMessage: () => undefined,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async () => {
      etat.ecrit++;
      return { creee: true, archivees: 0, total: 0 };
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/pii-redaction", () => ({ redactEmail: (e: string) => e }));
vi.mock("@/lib/consents", () => ({ recordConsentEvent: async () => true }));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => "oui" }));
vi.mock("@/server/guide-ia/envoi", () => ({ mettreEnFileGuide: async () => ({}) }));
vi.mock("@/server/guide-ia/lettre", () => ({ lettreDansLEmail: () => null }));

import { noterOrigineV3, traiterDemande } from "../traitement";
import { analyserCorps } from "../contrat";

const demande = (extra: Record<string, unknown> = {}) => {
  const r = analyserCorps(
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        cleIdempotence: "run_zernio_0001",
        email: "personne@exemple.test",
        mot: "guide",
        reseau: "instagram",
        guide: "guide-ia",
        accord: "non_demande",
        versionTexteM1: "m1-brouillon-v1",
        ...extra,
      }),
    ),
  );
  if (!r.ok || !r.demande) throw new Error("fixture invalide");
  return r.demande;
};

beforeEach(() => {
  etat.limites.length = 0;
  etat.sentry.length = 0;
  etat.refus = false;
  etat.ecrit = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("limite de débit des charges signées", () => {
  it("v1 : dépassement de la limite par personne = trop_de_requetes, rien d'écrit", async () => {
    etat.refus = true;
    const r = await traiterDemande(demande(), new Date());
    expect(r).toEqual({ ok: false, erreur: "trop_de_requetes" });
    expect(etat.limites).toHaveLength(1);
    expect(etat.limites[0]).toContain("guides-reseau:pers:");
    expect(etat.ecrit).toBe(0);
  });
});

describe("clé HMAC manquante en production", () => {
  it("n'est pas avalée : journal d'alerte + Sentry, sans donnée de personne", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = demande({
      schemaVersion: 3,
      post_ref: "post_ref_test_01",
      canal: "commentaire",
      commentaire_ref: "comm_ref_test_01",
    });
    await expect(noterOrigineV3(d, "k1", new Date())).resolves.toBeUndefined();
    expect(etat.sentry).toHaveLength(1);
    const journal = erreur.mock.calls.map((c) => String(c[0])).join("\n");
    expect(journal).toContain("guides_reseau_origine_cle_manquante");
    expect(journal).not.toContain("exemple.test");
    expect(journal).not.toContain("comm_ref_test_01");
    erreur.mockRestore();
  });
});
