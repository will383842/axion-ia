/**
 * Indicateur 22 ⭐ — renvoi vers la fiche de l'intervenant concerné, et lecture
 * de l'intitulé pour un organisme sans salarié.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { findMany: vi.fn(), count: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  ANCRE_DEVELOPPEMENT_COMPETENCES,
  lirePopulationIndicateur22,
  ouVerifierIndicateur22,
  repereIntituleIndicateur22,
} from "./intervenants-indicateur-22";
import { REGISTRES_PAR_INDICATEUR } from "./registres-par-indicateur";

const mockTrainer = prisma.trainer as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
};

describe("indicateur 22 — où vérifier", () => {
  it("un seul intervenant concerné → sa fiche, à la section du développement des compétences", () => {
    const liens = ouVerifierIndicateur22({
      intervenantsInternes: [{ id: "t-1", nom: "Williams Jullin" }],
      nbSalariesActifs: 0,
    });
    expect(liens).toEqual([
      {
        chemin: `/qualiopi/formateurs/t-1#${ANCRE_DEVELOPPEMENT_COMPETENCES}`,
        libelle: "Actions de développement des compétences, datées — fiche de Williams Jullin",
      },
    ]);
  });

  it("plusieurs (ou aucun) → la liste, comme avant", () => {
    const deux = ouVerifierIndicateur22({
      intervenantsInternes: [
        { id: "a", nom: "A" },
        { id: "b", nom: "B" },
      ],
      nbSalariesActifs: 1,
    });
    expect(deux).toEqual(REGISTRES_PAR_INDICATEUR[22]);
    expect(ouVerifierIndicateur22({ intervenantsInternes: [], nbSalariesActifs: 0 })).toEqual(
      REGISTRES_PAR_INDICATEUR[22],
    );
    expect(ouVerifierIndicateur22(null)).toEqual(REGISTRES_PAR_INDICATEUR[22]);
  });

  it("l'ancre existe sur la fiche formateur", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/page.tsx",
      ),
      "utf8",
    );
    expect(page).toContain("id={ANCRE_DEVELOPPEMENT_COMPETENCES}");
  });
});

describe("indicateur 22 — intitulé lu pour un organisme sans salarié", () => {
  it("sans salarié → « intervenants (salariés, dirigeant-formateur) »", () => {
    expect(repereIntituleIndicateur22({ intervenantsInternes: [], nbSalariesActifs: 0 })).toMatch(
      /intervenants \(salariés, dirigeant-formateur\)/,
    );
  });

  it("avec salarié, ou base illisible → rien (le libellé officiel suffit, rien n'est affirmé)", () => {
    expect(
      repereIntituleIndicateur22({ intervenantsInternes: [], nbSalariesActifs: 2 }),
    ).toBeNull();
    expect(repereIntituleIndicateur22(null)).toBeNull();
  });
});

describe("lirePopulationIndicateur22", () => {
  it("lit les intervenants internes qui animent (salariés et dirigeant), et compte les salariés", async () => {
    mockTrainer.findMany.mockResolvedValue([{ id: "t-1", nom: "Jullin", prenom: "Williams" }]);
    mockTrainer.count.mockResolvedValue(0);
    const population = await lirePopulationIndicateur22();
    expect(population).toEqual({
      intervenantsInternes: [{ id: "t-1", nom: "Williams Jullin" }],
      nbSalariesActifs: 0,
    });
    expect(mockTrainer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actif: true, estFormateur: true, statut: { in: ["salarie", "dirigeant"] } },
      }),
    );
  });

  it("base illisible → null, jamais une population vide", async () => {
    mockTrainer.findMany.mockRejectedValue(new Error("connexion perdue"));
    expect(await lirePopulationIndicateur22()).toBeNull();
  });
});
