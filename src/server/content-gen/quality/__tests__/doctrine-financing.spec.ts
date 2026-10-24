/**
 * Tests — garde-fous FINANCEMENT du doctrine-check (anti-fabrication).
 *
 * Axion-IA peut mentionner OPCO + France Travail (jamais Qualiopi), mais le
 * contenu généré ne doit JAMAIS : citer le CPF, sur-promettre un financement
 * « 100 % / automatique / gratuit / intégral », ni exposer un numéro légal.
 * On mocke `bannedPhrase.findMany` → [] pour isoler ces règles.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bannedPhrase: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { checkDoctrine } from "../doctrine-check";

const isBlocked = (r: Awaited<ReturnType<typeof checkDoctrine>>) =>
  !r.passed && r.blockingViolations.some((v) => v.pattern === "financement-interdit");

describe("doctrine-check — financement interdit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("BLOQUE toute mention de Qualiopi (label non obtenu, zéro trace publique)", async () => {
    for (const t of [
      "Notre organisme est certifié Qualiopi.",
      "Une formation éligible grâce à Qualiopi.",
      "Le référentiel QUALIOPI impose un questionnaire.",
      "indicateur Qualiopi 8",
    ]) {
      expect(isBlocked(await checkDoctrine(t)), t).toBe(true);
    }
  });

  it("BLOQUE un numéro de certificat Qualiopi exposé", async () => {
    expect(
      isBlocked(await checkDoctrine("Organisme certifié Qualiopi, certificat n° 12345.")),
    ).toBe(true);
  });

  it("BLOQUE OPCO / France Travail tant que la divulgation publique n'est pas activée", async () => {
    vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "false");
    const r = await checkDoctrine(
      "Nos formations sont éligibles à une prise en charge par votre OPCO ; " +
        "selon votre situation, un financement France Travail est possible.",
    );
    expect(isBlocked(r)).toBe(true);
  });

  it("AUTORISE une formulation conforme OPCO / France Travail quand la divulgation est activée", async () => {
    vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "true");
    const r = await checkDoctrine(
      "Nos formations sont éligibles à une prise en charge par votre OPCO ; " +
        "selon votre situation, un financement France Travail est possible.",
    );
    expect(r.blockingViolations.some((v) => v.pattern === "financement-interdit")).toBe(false);
  });

  it("garde le nom historique CPF-non-autorise", async () => {
    const r = await checkDoctrine("Cette formation est éligible au CPF.");
    expect(r.blockingViolations.some((v) => v.pattern === "CPF-non-autorise")).toBe(true);
  });

  // Non-régression : les motifs accentués ne trouvaient jamais le mot après une
  // espace (`` ne voit pas « é » comme une lettre de mot).
  it("trouve « étude interne » et « évaluations 2025 » (regex accentuées corrigées)", async () => {
    const r = await checkDoctrine("Selon notre étude interne, les évaluations 2025 le confirment.");
    expect(r.blockingViolations.some((v) => v.pattern === "stat-fabriquée-Axion-IA")).toBe(true);
  });

  it("trouve « instantané » dans les phrases de la base (texte normalisé)", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.bannedPhrase.findMany).mockResolvedValueOnce([
      { pattern: "instantané", reason: "Promesse temporelle", severity: "warn" },
    ] as never);
    const r = await checkDoctrine("Un résultat instantané pour votre équipe.");
    expect(r.warnings.some((v) => v.pattern === "instantané")).toBe(true);
  });
});
