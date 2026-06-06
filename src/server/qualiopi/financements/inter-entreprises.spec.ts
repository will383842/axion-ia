/**
 * Tests — inter-entreprises.ts (R-INTER, modules purs).
 */

import { describe, it, expect } from "vitest";
import {
  resolveEnrollmentFinancement,
  destinataireFacture,
  checkFactureParInscription,
} from "./inter-entreprises";

const SESSION_FALLBACK = {
  financementType: "direct" as const,
  clientId: "sess-client",
  numeroDossierOpco: null,
  edofVerifieAt: null,
  ftDispositif: null,
  montantHtCents: 100000,
};

function enr(overrides: Record<string, unknown> = {}) {
  return {
    financementType: null,
    clientId: null,
    numeroDossierOpco: null,
    edofVerifieAt: null,
    ftDispositif: null,
    montantHtCents: null,
    ...overrides,
  } as Parameters<typeof resolveEnrollmentFinancement>[0];
}

describe("resolveEnrollmentFinancement", () => {
  it("retombe sur le financement session si l'inscription n'a rien", () => {
    const r = resolveEnrollmentFinancement(enr(), SESSION_FALLBACK);
    expect(r.financementType).toBe("direct");
    expect(r.clientId).toBe("sess-client");
    expect(r.montantHtCents).toBe(100000);
  });

  it("l'override de l'inscription prime (financeur + payeur + prix de siège)", () => {
    const r = resolveEnrollmentFinancement(
      enr({ financementType: "opco", clientId: "emp-A", montantHtCents: 80000 }),
      SESSION_FALLBACK,
    );
    expect(r.financementType).toBe("opco");
    expect(r.clientId).toBe("emp-A");
    expect(r.montantHtCents).toBe(80000);
  });
});

describe("destinataireFacture", () => {
  it("mappe chaque financement au bon destinataire", () => {
    expect(destinataireFacture("opco")).toBe("opco");
    expect(destinataireFacture("cpf")).toBe("stagiaire");
    expect(destinataireFacture("france_travail")).toBe("france_travail");
    expect(destinataireFacture("direct")).toBe("entreprise");
    expect(destinataireFacture("mixte")).toBe("entreprise");
    expect(destinataireFacture(null)).toBe("entreprise");
  });
});

describe("checkFactureParInscription", () => {
  const base = {
    financementType: "direct" as const,
    clientId: "c",
    numeroDossierOpco: null,
    edofVerifieAt: null,
    ftDispositif: null,
    montantHtCents: 50000,
  };

  it("ok si prix de siège défini", () => {
    expect(checkFactureParInscription(base, { opcoSubrogation: false }).ok).toBe(true);
  });

  it("refuse sans prix de siège", () => {
    const r = checkFactureParInscription(
      { ...base, montantHtCents: 0 },
      { opcoSubrogation: false },
    );
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("Prix du siège");
  });

  it("refuse subrogation OPCO sans n° de dossier", () => {
    const r = checkFactureParInscription(
      { ...base, financementType: "opco", numeroDossierOpco: null },
      { opcoSubrogation: true },
    );
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("dossier");
  });

  it("refuse CPF sans EDOF", () => {
    const r = checkFactureParInscription(
      { ...base, financementType: "cpf", edofVerifieAt: null },
      { opcoSubrogation: false },
    );
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("EDOF");
  });

  it("ok CPF si EDOF vérifié", () => {
    const r = checkFactureParInscription(
      { ...base, financementType: "cpf", edofVerifieAt: new Date() },
      { opcoSubrogation: false },
    );
    expect(r.ok).toBe(true);
  });
});
