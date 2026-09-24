/**
 * LA TRACE DU PIÈGE ANTI-ROBOT DOIT SURVIVRE À UN REDÉPLOIEMENT.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────
 * La trace existait depuis le 2026-09-01, et **elle ne se lisait pas**. Elle
 * partait sur la sortie standard du conteneur, remise à zéro à chaque
 * déploiement. Mesuré le 2026-09-24 : le conteneur applicatif tournait depuis
 * 05 h 48, portait **55 lignes** de journal en tout, et le décompte des
 * occurrences de `[honeypot]` rendait **0**.
 *
 * 🔴 Ce zéro ne disait pas « aucune perte ». Il disait « je ne peux pas
 *    savoir » — et les deux se ressemblent au point de se confondre. C'est
 *    exactement le défaut que la trace était censée réparer.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER :
 *
 *  1. **Le retour à la seule sortie conteneur.** Une ligne doit être écrite
 *     dans un registre qui survit au redémarrage.
 *  2. **La fuite de donnée personnelle.** On garde la FORME de la valeur, pas
 *     la valeur : un gestionnaire de mots de passe y verse ce qu'il croit être
 *     le site web de la personne, ce qui peut l'identifier.
 *  3. **Qu'une panne de registre casse un formulaire public.** Le piège doit
 *     rester invisible pour le visiteur, même quand la base est injoignable.
 *     Une exception ici transformerait un succès silencieux en erreur à
 *     l'écran — soit précisément ce qu'on ne veut jamais montrer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const creerMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: (...a: unknown[]) => creerMock(...a) } },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { ACTION_HONEYPOT, signalerHoneypot } from "../honeypot-observable";

beforeEach(() => {
  vi.clearAllMocks();
  creerMock.mockResolvedValue({});
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("la trace durable du piège", () => {
  it("🔴 écrit une ligne dans le registre, pas seulement sur la sortie du conteneur", async () => {
    await signalerHoneypot("newsletter", "https://spam.example/x");

    expect(creerMock).toHaveBeenCalledOnce();
    const data = (creerMock.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.action).toBe(ACTION_HONEYPOT);
    expect(data.ipAddress).toBe("203.0.113.7");
  });

  it("nomme le formulaire ET la forme — c'est ce qui sépare un robot d'un humain", async () => {
    await signalerHoneypot("guide-ia", "monsite.fr");

    const data = (creerMock.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } })
      .data;
    expect(data.changes.formulaire).toBe("guide-ia");
    // `domaine` et non `url` : un gestionnaire de mots de passe verse un nom de
    // domaine plausible là où un robot verse une adresse complète.
    expect(data.changes.forme).toBe("domaine");
  });

  it("🔴 ne range JAMAIS la valeur saisie dans le registre", async () => {
    const secret = "jean.dupont@entreprise-client.fr";
    await signalerHoneypot("contact", secret);

    expect(JSON.stringify(creerMock.mock.calls[0]?.[0])).not.toContain(secret);
    // La forme, elle, doit être là : sans elle la ligne n'apprend rien.
    const data = (creerMock.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } })
      .data;
    expect(data.changes.forme).toBe("email");
  });

  it("🔴 un registre en panne ne fait PAS échouer le formulaire public", async () => {
    creerMock.mockRejectedValue(new Error("base injoignable"));

    // Ne doit pas lever : le visiteur doit continuer à voir un succès.
    await expect(signalerHoneypot("avis", "x")).resolves.toBeUndefined();
    // Et la trace immédiate, elle, est déjà partie.
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("la sortie conteneur est écrite AVANT le registre — elle survit à sa panne", async () => {
    const ordre: string[] = [];
    vi.spyOn(console, "warn").mockImplementation(() => void ordre.push("console"));
    creerMock.mockImplementation(async () => void ordre.push("registre"));

    await signalerHoneypot("podcast", "x");

    expect(ordre).toEqual(["console", "registre"]);
  });
});
