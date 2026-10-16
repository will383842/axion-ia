// @vitest-environment node

/**
 * Qualiopi ind. 27 — la règle d'alerte du registre des sous-traitants indépendants.
 *
 *   · interrupteur coupé : rien n'est lu au-delà du réglage, aucune alerte ;
 *   · allumé : les candidates viennent de la MÊME lecture que l'écran et l'export ;
 *   · chaque code émis est au catalogue (niveau, guichet, résolution automatique) ;
 *   · la règle est inscrite au moteur.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "11111111-1111-4111-8111-111111111111";
const m = vi.hoisted(() => ({ allume: vi.fn(), lire: vi.fn() }));

vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: m.allume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/registre-sous-traitants/lecture", () => ({
  lireRegistre: m.lire,
}));

import { ALERTE_CATALOGUE } from "./catalogue";
import { regleRegistreSousTraitants } from "./regle-registre-sous-traitants";

const MAINTENANT = new Date("2026-10-16T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.lire.mockResolvedValue([
    {
      trainerId: T1,
      raisonSociale: "Anne Martin",
      statut: "actif",
      pieces: [
        {
          code: "kbis_sirene",
          libelle: "KBIS ou avis SIRENE",
          exigee: true,
          etat: "expiree",
          echeance: new Date("2026-10-01T00:00:00Z"),
          alertesAilleurs: false,
        },
      ],
      controles: [
        {
          code: "revue_annuelle",
          libelle: "Revue annuelle",
          dernierAt: null,
          echeance: new Date("2026-09-01T00:00:00Z"),
          enRetard: true,
        },
      ],
    },
  ]);
});

describe("règle « registre des sous-traitants »", () => {
  it("coupée : aucune alerte, le registre n'est pas lu", async () => {
    m.allume.mockResolvedValue(false);
    expect(await regleRegistreSousTraitants(MAINTENANT)).toEqual([]);
    expect(m.allume).toHaveBeenCalledWith("alertes_registre_sous_traitants");
    expect(m.lire).not.toHaveBeenCalled();
  });

  it("allumée : pièce expirée et contrôle en retard, sur le formateur", async () => {
    const a = await regleRegistreSousTraitants(MAINTENANT);
    expect(m.lire).toHaveBeenCalledWith(MAINTENANT);
    expect(a.map((x) => x.code).sort()).toEqual([
      "sous_traitant_registre_controle_en_retard",
      "sous_traitant_registre_piece_expiree",
    ]);
    for (const x of a) {
      expect(x).toMatchObject({ cibleType: "Trainer", cibleId: T1 });
      expect(ALERTE_CATALOGUE[x.code]).toMatchObject({ niveau: x.niveau, resolutionAuto: true });
    }
  });

  it("est inscrite au moteur d'alertes", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
      "utf8",
    );
    expect(src).toMatch(/nom: "registre_sous_traitants", fn: regleRegistreSousTraitants/);
  });
});
