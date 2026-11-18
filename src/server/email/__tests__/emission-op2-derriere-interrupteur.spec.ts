// Émission `op2` derrière `OPPOSITION_JETON_V2` (plan « jeton op2 », J3).
// Éteint par défaut : le comportement d'aujourd'hui (op1) ne change pas.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  jetonOpposition,
  jetonOppositionOp2,
  lireJetonOpposition,
  normaliserAdresse,
  urlOpposition,
} from "../opposition-jeton";

const SECRET = "secret-dedie-op2-suffisamment-long-0123456789";
const ADRESSE = "Jean.Dupont@Client-Exemple.fr";

let logs: unknown[][];
beforeEach(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["OPPOSITION_JETON_SECRET"] = SECRET;
  delete process.env["OPPOSITION_JETON_V2"];
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
  logs = [];
  for (const m of ["log", "warn", "error", "info", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("interrupteur éteint (par défaut)", () => {
  it("jetonOpposition rend op1, comme aujourd'hui", () => {
    expect(jetonOpposition(ADRESSE).startsWith("op1.")).toBe(true);
  });

  it("seul la valeur exacte « true » allume (pas « 1 », « TRUE », « yes »)", () => {
    for (const v of ["1", "TRUE", "yes", " true", "true "]) {
      process.env["OPPOSITION_JETON_V2"] = v;
      expect(jetonOpposition(ADRESSE).startsWith("op1.")).toBe(true);
    }
  });
});

describe("interrupteur allumé", () => {
  beforeEach(() => {
    process.env["OPPOSITION_JETON_V2"] = "true";
  });

  it("🔴 avec le secret : op2, opaque, qui se relit", () => {
    const jeton = jetonOpposition(ADRESSE);
    expect(jeton.startsWith("op2.")).toBe(true);
    expect(jeton).toBe(jetonOppositionOp2(ADRESSE));
    expect(lireJetonOpposition(jeton)).toBe(normaliserAdresse(ADRESSE));
  });

  it("🔴 sans le secret : repli op1 (le lien existe toujours) + UN seul avertissement, sans valeur", async () => {
    vi.resetModules();
    const mod = await import("../opposition-jeton");
    delete process.env["OPPOSITION_JETON_SECRET"];
    const a = mod.jetonOpposition(ADRESSE);
    const b = mod.jetonOpposition("autre@client.fr");
    expect(a.startsWith("op1.")).toBe(true);
    expect(b.startsWith("op1.")).toBe(true);
    const avertissements = logs.filter((l) => String(l[0]).includes("opposition_jeton_repli_op1"));
    expect(avertissements).toHaveLength(1);
    const tout = JSON.stringify(logs);
    expect(tout).not.toContain("dupont");
    expect(tout.toLowerCase()).not.toContain("client-exemple");
    expect(tout).not.toContain(a);
  });

  it("l'URL du pied de page et l'en-tête List-Unsubscribe portent le même jeton", () => {
    const jeton = jetonOpposition(ADRESSE);
    expect(urlOpposition(ADRESSE)).toBe(
      `https://axion-ia.com/api/unsubscribe?token=${encodeURIComponent(jeton)}`,
    );
    // L'URL ne révèle pas l'adresse (c'était l'objet du lot).
    const url = decodeURIComponent(urlOpposition(ADRESSE)).toLowerCase();
    expect(url).not.toContain("dupont");
    expect(url).not.toContain(Buffer.from(normaliserAdresse(ADRESSE)).toString("base64url"));
  });

  it("un job mis en file AVANT l'allumage (op1) désigne toujours le bon destinataire", () => {
    delete process.env["OPPOSITION_JETON_V2"];
    const ancien = jetonOpposition(ADRESSE);
    process.env["OPPOSITION_JETON_V2"] = "true";
    expect(ancien.startsWith("op1.")).toBe(true);
    // Règle du worker (email-worker.ts) : le jeton de page doit désigner CE destinataire.
    expect(lireJetonOpposition(ancien)).toBe(normaliserAdresse(ADRESSE));
    expect(lireJetonOpposition(ancien)).not.toBe(normaliserAdresse("tiers@client.fr"));
  });

  it("aucune sortie console ne contient le jeton ni l'adresse", () => {
    jetonOpposition(ADRESSE);
    urlOpposition(ADRESSE);
    lireJetonOpposition(jetonOpposition(ADRESSE));
    expect(JSON.stringify(logs).toLowerCase()).not.toContain("dupont");
  });
});
