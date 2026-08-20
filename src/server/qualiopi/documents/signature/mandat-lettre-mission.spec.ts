/**
 * `D4-1-A` — le droit de LIRE sa lettre est exactement le droit de la signer.
 *
 * Cette règle vivait en variable locale dans
 * `signerLettreMissionFormateurAction`. Elle est extraite parce qu'une seconde
 * surface en a besoin : la route qui remet la pièce au formateur AVANT qu'il la
 * signe — sans quoi il scelle une mention qui affirme l'avoir lue.
 *
 * 🔑 Ce fichier garde l'EXTRACTION autant que la règle. Deux copies d'une règle
 * d'autorisation divergent au premier cas particulier, et la moitié qui diverge
 * est toujours celle qui autorise trop.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

import { estMandataireDeLaLettre } from "./mandat-lettre-mission";

describe("estMandataireDeLaLettre", () => {
  beforeEach(() => findUnique.mockReset());

  // ── L'ancre directe ────────────────────────────────────────────────────────

  it("l'ancre `trainerId` autorise le formateur qu'elle nomme", async () => {
    expect(await estMandataireDeLaLettre({ trainerId: "t-1", sessionId: null }, "t-1")).toBe(true);
    expect(findUnique, "l'ancre suffit : aucune lecture de session").not.toHaveBeenCalled();
  });

  it("🔴 l'ancre `trainerId` REFUSE un autre formateur", async () => {
    // 🔑 Le témoin discriminant. Sans lui, une règle qui rendrait toujours
    // `true` passerait le test précédent — et n'importe quel formateur
    // authentifié lirait la lettre nominative d'un confrère (rémunération,
    // périmètre, engagements de confidentialité).
    expect(await estMandataireDeLaLettre({ trainerId: "t-1", sessionId: null }, "t-2")).toBe(false);
  });

  it("🔴 l'ancre PRIME sur la session, même quand la session dirait oui", async () => {
    // Le cas qui distingue cette règle d'une règle « appartenance à la
    // session » : la lettre nomme UN formateur. Si l'ancre dit `t-1` et que la
    // session est portée par `t-2`, c'est `t-1` que la pièce mandate — la
    // session ne doit même pas être consultée.
    findUnique.mockResolvedValue({ formateurPrincipalId: "t-2", coFormateurs: [] });
    expect(await estMandataireDeLaLettre({ trainerId: "t-1", sessionId: "s-1" }, "t-2")).toBe(
      false,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  // ── Le repli par session (lettres legacy, sans ancre) ──────────────────────

  it("sans ancre, le formateur principal de la session est mandataire", async () => {
    findUnique.mockResolvedValue({ formateurPrincipalId: "t-9", coFormateurs: [] });
    expect(await estMandataireDeLaLettre({ trainerId: null, sessionId: "s-1" }, "t-9")).toBe(true);
  });

  it("🔴 sans ancre, un CO-formateur n'est pas mandataire", async () => {
    // La lettre nomme le formateur PRINCIPAL — c'est lui que le générateur a
    // imprimé. Autoriser un co-formateur reviendrait à laisser signer une pièce
    // qui porte le nom d'un autre.
    findUnique.mockResolvedValue({
      formateurPrincipalId: "t-9",
      coFormateurs: [{ trainerId: "t-8" }],
    });
    expect(await estMandataireDeLaLettre({ trainerId: null, sessionId: "s-1" }, "t-8")).toBe(false);
  });

  // ── Les refus qui protègent ────────────────────────────────────────────────

  it("🔴 ni ancre ni session (lettre-cadre orpheline) → REFUS", async () => {
    expect(await estMandataireDeLaLettre({ trainerId: null, sessionId: null }, "t-1")).toBe(false);
  });

  it("🔴 session introuvable → REFUS, jamais une autorisation par défaut", async () => {
    findUnique.mockResolvedValue(null);
    expect(await estMandataireDeLaLettre({ trainerId: null, sessionId: "s-x" }, "t-1")).toBe(false);
  });

  it("🔴 aucun formateur résolvable → REFUS pour TOUT LE MONDE", async () => {
    // ⚠️ Le cas le plus subtil, et il est voulu : quand la session ne résout
    // aucun formateur, le générateur a imprimé la raison sociale de l'organisme
    // à la place d'un nom. La pièce ne mandate personne d'identifiable — elle
    // doit être régénérée, ni lue à ce titre, ni signée.
    findUnique.mockResolvedValue({ formateurPrincipalId: null, coFormateurs: [] });
    expect(await estMandataireDeLaLettre({ trainerId: null, sessionId: "s-1" }, "t-1")).toBe(false);
  });
});

describe("`D4-1-A` — la règle n'existe qu'à UN endroit", () => {
  it("🔴 la Server Action de signature ne réimplémente pas le mandat", async () => {
    // 🔑 Ce que ce test garde n'est pas une valeur, c'est une ARCHITECTURE. Si
    // quelqu'un recopie la règle dans l'action « pour éviter un import », les
    // deux surfaces divergeront — et celle qui divergera est celle qui autorise
    // à lire, c'est-à-dire la plus exposée.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "actions", "qualiopi", "lettre-mission-signature.ts"),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // Elle IMPORTE la règle…
    expect(source).toMatch(/import \{ estMandataireDeLaLettre \}/);
    // …et ne la redéfinit pas.
    expect(source).not.toMatch(/function estMandataireDeLaLettre/);
    // Ni ne reconstruit le résolveur de session à la main.
    expect(
      source,
      "le résolveur de formateur principal appartient à la règle, pas à l'action",
    ).not.toMatch(/resolvePrincipalTrainerId/);
  });
});
