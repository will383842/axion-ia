// @vitest-environment node
//
// /api/gdpr-erase — l'effacement annule les envois programmés AVANT d'effacer
// (2026-09-19).
//
// Les relances J+2 / J+7, le kit du dossier commencé et l'invitation dorment
// dans la file, retrouvables par l'empreinte de l'adresse. Une fois les fiches
// anonymisées, plus rien ne les relie à la personne : ils partiraient vers
// quelqu'un qui vient d'obtenir l'oubli. L'annulation passe donc AVANT
// `eraseSubmissionsForEmail`, et son échec ne bloque pas l'effacement.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ordre: string[] = [];
const annuler = vi.fn();
const journal = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/gdpr-token", () => ({
  verifyGdprToken: async () => ({ ok: true, email: "nadia@exemple.fr", jti: "jti-1" }),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => {
    ordre.push("annuler");
    return annuler(...a);
  },
}));
vi.mock("@/server/careers/candidature-rgpd", () => ({
  effacerCandidaturesPour: async () => ({ supprimees: 0, tronque: false }),
}));
vi.mock("@/features/podcast-request/rgpd", () => ({
  effacerDemandesPodcastPour: async () => ({ supprimees: 0, tronque: false }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: (...a: unknown[]) => journal.create(...a) } },
}));
vi.mock("@/server/crm-sync/gdpr", () => ({ propagateGdprToCrm: async () => ({ status: "ok" }) }));
vi.mock("@/lib/knowledge/rgpd-export", () => ({
  eraseKbDataForEmail: async () => ({ bookmarksDeleted: 0 }),
}));
vi.mock("@/lib/rgpd-erase", () => ({
  eraseChatDataForEmail: async () => {
    ordre.push("chat");
    return { conversationsDeleted: 0, escalationsAnonymized: 0 };
  },
  eraseSignatureTokensForEmail: async () => ({ revoques: 0, pseudonymises: 0 }),
  eraseEmailTracesForEmail: async () => ({ logsPseudonymises: 0, outboxSupprimes: 0 }),
  eraseNewsletterForEmail: async () => ({ deleted: 0, guideDeleted: 0 }),
  eraseSubmissionsForEmail: async () => {
    ordre.push("submissions");
    return { anonymized: 1 };
  },
  eraseClientsForEmail: async () => ({ anonymises: 0, retenusObligationComptable: 0 }),
  eraseDocumentRecipientsForEmail: async () => ({ anonymises: 0 }),
  eraseCoachingSignaturesForEmail: async () => ({ anonymises: 0 }),
  eraseCalendlyEventsForEmail: async () => ({ anonymized: 0 }),
}));
vi.mock("@/lib/telegram", () => ({ alertIncident: async () => undefined }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => ({ enqueued: true }) }));

import { POST } from "./route";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { empreinteSha256 } from "@/server/newsletter/exports";

/**
 * Jeton factice du corps de requete, sorti en constante EXPRES.
 *
 * Ecrit en clair juste derriere le champ, il faisait rougir le gate `gitleaks` :
 * la regle `generic-api-key` releve toute chaine d'entropie suffisante collee a
 * un mot-cle anglais comme celui de ce champ, et elle ne voit pas qu'elle est
 * factice. Sortie ici, la valeur n'est plus adjacente au mot-cle. Sa longueur
 * reste au-dessus des 20 caracteres exiges par le schema zod de la route
 * (`route.ts:59`).
 *
 * ⚠️ L'allowlist de `.gitleaks.toml` ne l'aurait PAS sauvee : l'action
 * `gitleaks-action@v3` n'accepte pas l'entree `config-path` que `ci.yml:244`
 * lui passe (« Unexpected input(s) 'config-path' »), donc la configuration du
 * depot n'est appliquee NULLE PART. A reparer dans l'unite P12.
 */
const JETON_FACTICE = "jeton-de-test-assez-long-0123456789";

function requete(entetes: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://axion-ia.com/api/gdpr-erase", {
    method: "POST",
    headers: { "content-type": "application/json", ...entetes },
    body: JSON.stringify({
      email: "nadia@exemple.fr",
      token: JETON_FACTICE,
      confirm: "ERASE_MY_DATA",
    }),
  });
}

beforeEach(() => {
  ordre.length = 0;
  annuler.mockReset().mockResolvedValue(3);
  journal.create.mockReset().mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/gdpr-erase — envois programmés", () => {
  it("🔴 annule relances, kit et invitation AVANT d'effacer les fiches", async () => {
    const res = await POST(requete());
    expect(res.status).toBe(200);
    expect(annuler).toHaveBeenCalledWith("nadia@exemple.fr", "Envoi annulé : effacement RGPD.");
    expect(ordre.indexOf("annuler")).toBeGreaterThanOrEqual(0);
    expect(ordre.indexOf("annuler")).toBeLessThan(ordre.indexOf("submissions"));
  });

  it("une file indisponible n'empêche pas l'effacement", async () => {
    annuler.mockRejectedValue(new Error("redis mort"));
    const res = await POST(requete());
    expect(res.status).toBe(200);
    expect(ordre).toContain("submissions");
  });
});

describe("POST /api/gdpr-erase — la trace relue par la liste de suppression (lot L3)", () => {
  it("🔴 écrit le SHA-256 de l'adresse normalisée (`emailSha256`), à côté de l'empreinte HMAC", async () => {
    const res = await POST(requete());
    expect(res.status).toBe(200);
    const trace = journal.create.mock.calls
      .map((c) => (c[0] as { data: { action: string; changes: Record<string, unknown> } }).data)
      .find((dd) => dd.action === "gdpr.erase.completed");
    expect(trace).toBeDefined();
    expect(trace!.changes["emailSha256"]).toBe(empreinteSha256("nadia@exemple.fr"));
    // Les deux empreintes ne se confondent pas : l'outil d'envoi ne sait lire
    // que le SHA-256, le site que la sienne.
    expect(trace!.changes["emailHash"]).toBe(hashEmailForLookup("nadia@exemple.fr"));
    expect(trace!.changes["emailHash"]).not.toBe(trace!.changes["emailSha256"]);
    expect(JSON.stringify(trace)).not.toContain("nadia@exemple.fr");
  });
});

describe("POST /api/gdpr-erase — l'IP de la preuve d'effacement", () => {
  it("🔴 derrière Cloudflare, la preuve porte l'IP du VISITEUR, pas le relais ni x-forwarded-for brut", async () => {
    // Forme réelle en production : Traefik pose le relais Cloudflare en
    // `x-real-ip` ET en `x-forwarded-for`. La route inscrivait ce dernier BRUT.
    const res = await POST(
      requete({
        "x-real-ip": "162.159.122.108",
        "x-forwarded-for": "162.159.122.108",
        "cf-connecting-ip": "198.51.100.23",
      }),
    );
    expect(res.status).toBe(200);
    const trace = journal.create.mock.calls
      .map((c) => (c[0] as { data: { action: string; ipAddress: string | null } }).data)
      .find((dd) => dd.action === "gdpr.erase.completed");
    expect(trace?.ipAddress).toBe("198.51.100.23");
  });
});
