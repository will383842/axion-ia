/**
 * Tests — garde-fous FINANCEMENT du doctrine-check (anti-fabrication).
 *
 * Axion-IA (certifié Qualiopi) peut mentionner OPCO + France Travail, mais le
 * contenu généré ne doit JAMAIS : citer le CPF, sur-promettre un financement
 * « 100 % / automatique / gratuit / intégral », ni exposer un numéro légal.
 * On mocke `bannedPhrase.findMany` → [] pour isoler ces règles.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bannedPhrase: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { checkDoctrine } from "../doctrine-check";

const isBlocked = (r: Awaited<ReturnType<typeof checkDoctrine>>) =>
  !r.passed && r.blockingViolations.some((v) => v.pattern === "financement-interdit");

describe("doctrine-check — financement interdit", () => {
  it("BLOQUE une mention CPF", async () => {
    expect(isBlocked(await checkDoctrine("Cette formation est éligible au CPF."))).toBe(true);
  });

  it("BLOQUE « Mon Compte Formation »", async () => {
    expect(
      isBlocked(await checkDoctrine("Réservez via Mon Compte Formation dès aujourd'hui.")),
    ).toBe(true);
  });

  it("BLOQUE une sur-promesse « financé à 100 % »", async () => {
    expect(isBlocked(await checkDoctrine("Formation financée à 100 % par votre OPCO."))).toBe(true);
  });

  it("BLOQUE « financement automatique »", async () => {
    expect(isBlocked(await checkDoctrine("Bénéficiez d'un financement automatique."))).toBe(true);
  });

  it("BLOQUE une promesse de gratuité", async () => {
    expect(isBlocked(await checkDoctrine("Une formation gratuite grâce à votre OPCO."))).toBe(true);
  });

  it("BLOQUE un numéro de certificat Qualiopi exposé", async () => {
    expect(
      isBlocked(await checkDoctrine("Organisme certifié Qualiopi, certificat n° 12345.")),
    ).toBe(true);
  });

  it("AUTORISE une formulation conforme OPCO / France Travail", async () => {
    const r = await checkDoctrine(
      "Nos formations sont éligibles à une prise en charge par votre OPCO ; " +
        "selon votre situation, un financement France Travail est possible.",
    );
    expect(r.blockingViolations.some((v) => v.pattern === "financement-interdit")).toBe(false);
  });
});
