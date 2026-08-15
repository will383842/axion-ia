/**
 * Besoin d'adaptation — la déclaration est REÇUE, et le besoin est LISIBLE.
 *
 * ## Ce qui était cassé (2026-08-04)
 *
 * `declarerHandicapAction` écrivait en base et s'arrêtait là : aucune alerte,
 * aucun courriel, aucune pastille. Et le besoin, chiffré, n'était lisible
 * NULLE PART dans la console — la fiche stagiaire n'exposait que deux booléens,
 * pendant que le formulaire annonçait une « lecture réservée au référent
 * handicap » qu'aucun écran ne permettait.
 *
 * Quelqu'un pouvait donc écrire « j'ai besoin d'une salle accessible en
 * fauteuil » : personne n'était prévenu, et personne ne pouvait le lire. L'écran
 * promet pourtant « nous en tiendrons compte avant la formation ».
 *
 * ## 🔴 Ce que ces cas NE verrouillaient pas (vérification prod du 2026-08-04)
 *
 * Le cas « déclenche une alerte » n'observait que `sendTelegram`. Or Telegram
 * n'est PAS la console : mesuré en production, `alertes_systeme` restait vide
 * et /qualiopi/a-traiter — la première page ouverte le matin — ne montrait
 * rien. Le test passait au vert sur un défaut intact. Il observe désormais le
 * canal qui compte.
 *
 * ## Ce que ces cas verrouillent
 *
 * 1. une déclaration crée une ALERTE CONSOLE (pas seulement un Telegram) ;
 * 2. ni l'alerte ni le Telegram ne contiennent le besoin (donnée de santé) ;
 * 3. l'alerte cible la fiche du bénéficiaire, pour être actionnable ;
 * 4. la lecture est refusée à un admin ordinaire ;
 * 5. la lecture est journalisée AVANT d'être rendue.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const traineeUpdate = vi.fn();
const traineeFindUnique = vi.fn();
const sendTelegram = vi.fn(async (_msg: unknown) => true);
const creerOuDedup = vi.fn(async (_input: unknown) => null);
const logActivity = vi.fn(async (_input: unknown) => undefined);
const requireSuperAdmin = vi.fn();
const verifierToken = vi.fn();
const getPortailToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      update: (a: unknown) => traineeUpdate(a),
      findUnique: (a: unknown) => traineeFindUnique(a),
    },
    questionnaire: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (a: unknown) => sendTelegram(a) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (a: unknown) => creerOuDedup(a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireSuperAdmin: () => requireSuperAdmin(),
  logQualiopiActivity: (a: unknown) => logActivity(a),
}));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: () => getPortailToken(),
  setPortailCookie: vi.fn(),
  clearPortailCookie: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: (t: string) => verifierToken(t),
  creerAcces: vi.fn(),
  revoquerAcces: vi.fn(),
  demanderAccesParEmail: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({ creerDemandeRgpd: vi.fn() }));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  soumettreReponses: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
// Chiffrement réel non souhaité ici : on veut vérifier le FLUX, pas AES.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string | null) => (v == null ? null : String(v).replace(/^enc:/, "")),
}));

import { declarerHandicapAction, lireBesoinAdaptationAction } from "./portail";

const SESSION_ADMIN = { userId: "u1", email: "a@b.c", role: "super_admin" };
const UUID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  getPortailToken.mockResolvedValue("jeton");
  verifierToken.mockResolvedValue({ traineeId: UUID });
  traineeUpdate.mockResolvedValue({ id: UUID, prenom: "Simone", nom: "Blanc" });
  requireSuperAdmin.mockResolvedValue(SESSION_ADMIN);
});

describe("déclaration — quelqu'un est enfin prévenu", () => {
  it("🔴 crée une alerte DANS LA CONSOLE, pas seulement un message Telegram", async () => {
    // Le défaut trouvé en production : seul Telegram partait, `alertes_systeme`
    // restait vide, donc /qualiopi/a-traiter ne montrait rien.
    const r = await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    expect("data" in r).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("l'alerte est actionnable : code du catalogue, niveau visible, fiche ciblée", async () => {
    await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    const alerte = creerOuDedup.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alerte["code"]).toBe("besoin_adaptation_declare");
    // `info` serait filtré de /qualiopi/a-traiter, qui n'affiche que
    // critique + important : l'alerte n'y apparaîtrait jamais.
    expect(alerte["niveau"]).toBe("important");
    expect(alerte["cibleType"]).toBe("Trainee");
    expect(alerte["cibleId"]).toBe(UUID);
  });

  it("🔴 AUCUN des deux canaux ne contient le besoin — c'est une donnée de santé", async () => {
    await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    for (const emis of [
      JSON.stringify(creerOuDedup.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {}),
    ]) {
      expect(emis).not.toContain("fauteuil");
      // …mais chacun nomme la personne et dit où regarder, sinon il est inutile.
      expect(emis).toContain("Simone");
      expect(emis).toContain("chiffré");
    }
  });

  it("une panne d'alerte ne fait pas échouer la déclaration", async () => {
    // Le geste du bénéficiaire prime : sa déclaration doit être enregistrée
    // même si les canaux d'alerte sont indisponibles — les deux, pas un seul.
    creerOuDedup.mockRejectedValueOnce(new Error("db down"));
    sendTelegram.mockRejectedValueOnce(new Error("telegram down"));
    const r = await declarerHandicapAction({ besoin: "Besoin X" });
    expect("data" in r).toBe(true);
    expect(traineeUpdate).toHaveBeenCalledOnce();
  });
});

describe("lecture — réservée, et tracée", () => {
  it("rend le besoin déchiffré au super-administrateur", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Salle au rez-de-chaussée" });
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ data: { besoin: "Salle au rez-de-chaussée" } });
  });

  it("🔴 refuse un admin ordinaire", async () => {
    requireSuperAdmin.mockRejectedValueOnce(new Error("forbidden"));
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ error: "Réservé au super-administrateur" });
    // Et surtout : la base n'est même pas interrogée.
    expect(traineeFindUnique).not.toHaveBeenCalled();
  });

  it("journalise l'accès, sans y recopier la donnée", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Salle au rez-de-chaussée" });
    await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(logActivity).toHaveBeenCalledOnce();
    const trace = JSON.stringify(logActivity.mock.calls[0]?.[0] ?? {});
    expect(trace).toContain("besoin_adaptation.lu");
    expect(trace).not.toContain("rez-de-chaussée");
  });

  it("distingue « rien saisi » d'une erreur", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: null });
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ data: { besoin: null } });
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await lireBesoinAdaptationAction({ traineeId: "pas-un-uuid" });
    expect(r).toEqual({ error: "Données invalides" });
    expect(requireSuperAdmin).not.toHaveBeenCalled();
  });
});
