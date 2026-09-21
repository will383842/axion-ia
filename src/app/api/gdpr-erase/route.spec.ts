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
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: async () => ({}) } } }));
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
  eraseNewsletterForEmail: async () => ({ deleted: 0 }),
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

function requete(): NextRequest {
  return new NextRequest("https://axion-ia.com/api/gdpr-erase", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
