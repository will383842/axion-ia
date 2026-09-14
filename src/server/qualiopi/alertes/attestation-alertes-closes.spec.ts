/**
 * 🔴 4e relecture A09 (audit initial 2026-09-14) — les deux alertes
 * d'attestation se ferment SEULES quand la situation disparaît en base, et se
 * RELÈVENT d'elles-mêmes quand elle revient.
 *
 * La 3e relecture les avait passées en fermeture manuelle « avec motif ». Le
 * modèle `AlerteSysteme` ne porte aucun motif, et le geste prescrit en console
 * (générer la pièce, la régénérer) ne fermait plus l'alerte : un cas réglé
 * restait affiché ouvert. Retour à `resolutionAuto: true`.
 *
 * Le catalogue est RÉEL ici (contrairement à `alertes-service.spec.ts`) : c'est
 * précisément sa valeur qui décide.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("./evaluateur", () => ({
  evaluerAlertes: vi.fn(async () => []),
  evaluerAlertesDetaille: vi.fn(async () => ({
    candidates: [],
    reglesEnEchec: [],
    reglesTronquees: [],
  })),
}));

import { prisma } from "@/lib/prisma";
import { creerOuDedup } from "./alertes-service";
import { ALERTE_CATALOGUE } from "./catalogue";

const mp = prisma as unknown as {
  alerteSysteme: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const CODES = [
  "attestation_non_emise_automatiquement",
  "attestation_sans_evaluation_evaluee_depuis",
] as const;

describe("🔴 alertes d'attestation : fermeture automatique, et une situation qui revient se relève", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.create.mockResolvedValue({ id: "nouvelle" });
  });

  it.each(CODES)("%s — se ferme seule quand la situation disparaît, sans « motif »", (code) => {
    const entree = ALERTE_CATALOGUE[code];
    expect(entree?.resolutionAuto).toBe(true);
    // Le modèle ne porte aucun motif de fermeture : le catalogue n'en annonce pas.
    expect(entree !== undefined && "motifSansResolutionAuto" in entree).toBe(false);
  });

  it.each(CODES)(
    "%s — 0 h → > 0 → 0 h : fermée d'elle-même, elle est RECRÉÉE quand la situation revient",
    async (code) => {
      // La première fermeture est automatique (candidat disparu) ; le même
      // message revient : c'est la même situation, de nouveau vraie.
      mp.alerteSysteme.findFirst.mockImplementation(
        async (args: { where: { resolue: boolean } }) =>
          args.where.resolue ? { id: "fermee-automatiquement" } : null,
      );

      await creerOuDedup({
        code,
        niveau: "important",
        titre: "Attestation",
        message: "Même message qu'avant la fermeture",
        cibleType: "Enrollment",
        cibleId: "enr-1",
      });

      expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
    },
  );

  it.each(CODES)(
    "%s — contre-témoin : une alerte encore OUVERTE n'est pas doublée",
    async (code) => {
      mp.alerteSysteme.findFirst.mockImplementation(
        async (args: { where: { resolue: boolean } }) =>
          args.where.resolue ? null : { id: "ouverte" },
      );

      const r = await creerOuDedup({
        code,
        niveau: "important",
        titre: "Attestation",
        message: "Situation toujours vraie",
        cibleType: "Enrollment",
        cibleId: "enr-2",
      });

      expect(r).toBeNull();
      expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
    },
  );
});
