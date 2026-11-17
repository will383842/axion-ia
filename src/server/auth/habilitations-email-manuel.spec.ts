// @vitest-environment node

/**
 * Acte `ecrire_email_manuel` et interrupteur des e-mails écrits à la main (lot I4, F5).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { HABILITATIONS, MOTIF_REFUS, peutEngager } from "./habilitations";

const TOUS_LES_ROLES = [
  "super_admin",
  "admin",
  "responsable_qualite",
  "secretaire",
  "editor",
  "reader",
];

describe("acte ecrire_email_manuel : matrice des rôles", () => {
  it.each(TOUS_LES_ROLES)("rôle « %s »", (role) => {
    const attendu = role === "super_admin" || role === "admin";
    expect(peutEngager(role, "ecrire_email_manuel")).toBe(attendu);
  });

  it("la matrice liste exactement super_admin et admin", () => {
    expect([...HABILITATIONS.ecrire_email_manuel].sort()).toEqual(["admin", "super_admin"]);
  });

  it("rôle inconnu, vide ou absent : refusé", () => {
    for (const r of [undefined, null, "", "Admin", "root"]) {
      expect(peutEngager(r, "ecrire_email_manuel")).toBe(false);
    }
  });

  it("un motif de refus lisible existe", () => {
    expect(MOTIF_REFUS.ecrire_email_manuel.trim().length).toBeGreaterThan(30);
  });
});

describe("variables EMAIL_MANUEL_* : éteint et valeurs par défaut", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function lireEnv(valeurs: Record<string, string | undefined>) {
    vi.resetModules();
    for (const cle of [
      "EMAIL_MANUEL_ACTIF",
      "EMAIL_MANUEL_NOM_EXPEDITEUR",
      "EMAIL_MANUEL_SIGNATURE",
    ]) {
      vi.stubEnv(cle, valeurs[cle] ?? "");
    }
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    return (await import("../../env")).env;
  }

  it("absent = éteint, nom et signature par défaut", async () => {
    const env = await lireEnv({});
    expect(env.EMAIL_MANUEL_ACTIF).toBeUndefined();
    expect(env.EMAIL_MANUEL_ACTIF === "true").toBe(false);
    expect(env.EMAIL_MANUEL_NOM_EXPEDITEUR).toBe("Axion-IA");
    expect(env.EMAIL_MANUEL_SIGNATURE).toBe("L'équipe Axion-IA");
  });

  it("« false » reste éteint ; « true » allume", async () => {
    expect((await lireEnv({ EMAIL_MANUEL_ACTIF: "false" })).EMAIL_MANUEL_ACTIF).toBe("false");
    expect((await lireEnv({ EMAIL_MANUEL_ACTIF: "true" })).EMAIL_MANUEL_ACTIF).toBe("true");
  });

  it("les valeurs posées remplacent les défauts", async () => {
    const env = await lireEnv({
      EMAIL_MANUEL_NOM_EXPEDITEUR: "Nom posé",
      EMAIL_MANUEL_SIGNATURE: "Signature posée",
    });
    expect(env.EMAIL_MANUEL_NOM_EXPEDITEUR).toBe("Nom posé");
    expect(env.EMAIL_MANUEL_SIGNATURE).toBe("Signature posée");
  });
});
