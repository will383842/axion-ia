// @vitest-environment node
//
// /api/gdpr-erase — décision de Williams du 11/11/2026 : la demande d'effacement MET À L'ÉCART,
// elle ne supprime plus rien.
//
// Ce qui est gardé ici :
//   - la route passe par `ecarterPourDemandeEffacement` et n'appelle AUCUN effaceur ;
//   - aucune alerte Telegram (push) : la cloche seulement (dans le module d'écart) ;
//   - aucun e-mail « vos données ont été effacées » (il serait faux) ;
//   - la preuve porte l'IP du VISITEUR et l'identifiant du jeton ;
//   - la réponse dit honnêtement ce qui a été fait.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ecarter = vi.fn();
const telegram = vi.fn();
const enfiler = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/gdpr-token", () => ({
  verifyGdprToken: async () => ({ ok: true, email: "nadia@exemple.fr", jti: "jti-1" }),
}));
vi.mock("@/server/rgpd/ecarter-au-lieu-d-effacer", () => ({
  ecarterPourDemandeEffacement: (...a: unknown[]) => ecarter(...a),
}));
vi.mock("@/lib/telegram", () => ({ alertIncident: (...a: unknown[]) => telegram(...a) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enfiler(...a) }));

import { POST } from "./route";

/** Jeton factice, sorti en constante pour ne pas déclencher `gitleaks` (cf. historique). */
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
  ecarter.mockReset().mockResolvedValue({
    opposition: "ok",
    marque: "ok",
    abonnesEcartes: 1,
    contactsGuideEcartes: 0,
    rapportsEcartes: 0,
    journalId: "log-1",
    etapesEnEchec: [],
  });
  telegram.mockReset();
  enfiler.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/gdpr-erase — mise à l'écart, jamais de suppression (11/11/2026)", () => {
  it("🔴 écarte la personne par le module d'écart, avec l'origine libre-service", async () => {
    const res = await POST(requete());
    expect(res.status).toBe(200);
    expect(ecarter).toHaveBeenCalledTimes(1);
    expect(ecarter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nadia@exemple.fr",
        origine: "libre-service",
        jti: "jti-1",
      }),
    );
  });

  it("🔴 la route n'importe plus AUCUN effaceur", () => {
    const source = readFileSync(join(__dirname, "route.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const interdit of [
      "@/lib/rgpd-erase",
      "candidature-rgpd",
      "podcast-request/rgpd",
      "tour-de-france/rgpd",
      "eraseKbDataForEmail",
      "deleteMany",
      "@/lib/telegram",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("aucune alerte Telegram, aucun e-mail « vos données ont été effacées »", async () => {
    await POST(requete());
    expect(telegram).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("la réponse dit ce qui a été fait : mise à l'écart, rien de supprimé, traitement à la main", async () => {
    const res = await POST(requete());
    const corps = (await res.json()) as {
      ok: boolean;
      statut: string;
      notice: { explanation: string };
    };
    expect(corps.ok).toBe(true);
    expect(corps.statut).toBe("demande_recue_mise_a_l_ecart");
    expect(corps.notice.explanation).toMatch(/cessé tout envoi automatique/);
    expect(corps.notice.explanation).toMatch(/Rien n'est effacé automatiquement/);
    expect(corps.notice.explanation).toMatch(/sous un mois/);
    expect(corps.notice.explanation).not.toMatch(/ont été effacées/);
    expect(JSON.stringify(corps)).not.toContain("nadia@exemple.fr");
  });

  it("🔴 derrière Cloudflare, la preuve porte l'IP du VISITEUR, pas le relais", async () => {
    const res = await POST(
      requete({
        "x-real-ip": "162.159.122.108",
        "x-forwarded-for": "162.159.122.108",
        "cf-connecting-ip": "198.51.100.23",
      }),
    );
    expect(res.status).toBe(200);
    expect(ecarter).toHaveBeenCalledWith(expect.objectContaining({ ip: "198.51.100.23" }));
  });

  it("marque non posée : on n'affirme PAS l'arrêt des envois, la demande sera traitée à la main", async () => {
    ecarter.mockResolvedValue({
      opposition: "echec",
      marque: "echec",
      abonnesEcartes: 0,
      contactsGuideEcartes: 0,
      rapportsEcartes: 0,
      journalId: null,
      etapesEnEchec: ["opposition", "marque"],
    });
    const res = await POST(requete());
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean; notice: { explanation: string } };
    expect(corps.ok).toBe(true);
    expect(corps.notice.explanation).toMatch(/traitée à la main/);
    expect(corps.notice.explanation).not.toMatch(/cessé tout envoi/);
  });

  it("le module d'écart lève (clé d'empreinte absente…) : 503 propre, pas de 500 brut", async () => {
    ecarter.mockRejectedValue(new Error("[rgpd] empreinte d'adresse indisponible"));
    const res = await POST(requete());
    expect(res.status).toBe(503);
    const corps = (await res.json()) as { ok: boolean; error: string };
    expect(corps.ok).toBe(false);
    expect(corps.error).toBe("service_indisponible");
  });
});
