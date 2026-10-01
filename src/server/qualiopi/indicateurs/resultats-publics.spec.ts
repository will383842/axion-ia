/**
 * Résultats PUBLICS d'une formation (encadré « Nos résultats », indicateur 2).
 *
 * Ce qui doit rougir :
 *  - un encadré rendu SANS accord de publication (`indicateursPubliesAt`) ;
 *  - un encadré rendu sans session réalisée ou sans stagiaire (bloc vide) ;
 *  - une requête en base sous `stub.invalid` (contrat de build ADR 0026) ;
 *  - un arrondi qui embellit (4,96 → 5) ;
 *  - un échantillon faible présenté comme représentatif ;
 *  - une assiduité publiée alors qu'une présence n'est pas saisie.
 *
 * Le rendu de l'encadré est testé à côté du composant
 * (`src/components/formations/ResultatsFormation.spec.tsx`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    questionnaire: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

import { prisma } from "@/lib/prisma";
import {
  construireResultatsPublics,
  dateLongueFr,
  libelleEchantillon,
  libellePeriode,
  noteFr,
  tronquerAuDixieme,
  type DonneesResultatsFormation,
} from "./resultats-publics";
import { getResultatsPublicsFormation } from "./resultats-publics-service";

const db = prisma as unknown as {
  formation: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  questionnaire: { findMany: ReturnType<typeof vi.fn> };
};

// La réalité au 2026-10-01 : AXI-SESS-2026-001, 05/09/2026, 1 stagiaire, 5/5.
const SESSION_REELLE = {
  dateDebut: new Date("2026-09-05T07:00:00.000Z"),
  dateFin: new Date("2026-09-05T15:00:00.000Z"),
};
const MAINTENANT = new Date("2026-10-01T10:00:00.000Z");

function donnees(p: Partial<DonneesResultatsFormation> = {}): DonneesResultatsFormation {
  return {
    indicateursPubliesAt: new Date("2026-10-01T09:00:00.000Z"),
    sessions: [SESSION_REELLE],
    inscriptions: [{ tauxPresencePct: 100 }],
    notes: [5],
    seuilPresencePct: 80,
    calculeLe: MAINTENANT,
    ...p,
  };
}

describe("construireResultatsPublics — quand afficher", () => {
  it("rien sans accord de publication", () => {
    expect(construireResultatsPublics(donnees({ indicateursPubliesAt: null }))).toBeNull();
  });
  it("rien sans session réalisée", () => {
    expect(construireResultatsPublics(donnees({ sessions: [] }))).toBeNull();
  });
  it("rien sans stagiaire", () => {
    expect(construireResultatsPublics(donnees({ inscriptions: [] }))).toBeNull();
  });
  it("les premiers résultats réels : 1 session, 1 stagiaire, 5/5, échantillon faible", () => {
    const r = construireResultatsPublics(donnees());
    expect(r).toMatchObject({
      nbSessions: 1,
      nbStagiaires: 1,
      satisfaction: { moyenneSur5: 5, nbReponses: 1 },
      assiduite: { nbAssidus: 1, seuilPct: 80 },
      echantillonFaible: true,
    });
  });
});

describe("construireResultatsPublics — jamais embellir", () => {
  it("tronque la moyenne au dixième, vers le bas", () => {
    expect(tronquerAuDixieme(4.96)).toBe(4.9);
    expect(tronquerAuDixieme(4.3)).toBe(4.3);
    const r = construireResultatsPublics(
      donnees({ notes: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4] }),
    );
    expect(r?.satisfaction?.moyenneSur5).toBe(4.9); // 4,95 réel → 4,9, jamais 5
  });
  it("pas de satisfaction affichée sans réponse notée", () => {
    expect(construireResultatsPublics(donnees({ notes: [] }))?.satisfaction).toBeNull();
  });
  it("pas d'assiduité publiée si une présence n'est pas saisie", () => {
    const r = construireResultatsPublics(
      donnees({ inscriptions: [{ tauxPresencePct: 100 }, { tauxPresencePct: null }] }),
    );
    expect(r?.assiduite).toBeNull();
  });
  it("compte sous le seuil de présence comme non assidu", () => {
    const r = construireResultatsPublics(
      donnees({ inscriptions: [{ tauxPresencePct: 100 }, { tauxPresencePct: 50 }] }),
    );
    expect(r?.assiduite).toEqual({ nbAssidus: 1, seuilPct: 80 });
  });
  it("l'échantillon n'est plus « faible » à 5 stagiaires et 5 réponses", () => {
    const r = construireResultatsPublics(
      donnees({
        inscriptions: Array.from({ length: 5 }, () => ({ tauxPresencePct: 100 })),
        notes: [5, 4, 5, 4, 5],
      }),
    );
    expect(r?.echantillonFaible).toBe(false);
  });
});

describe("libellés de l'échantillon et de la période", () => {
  it("singulier et « premiers résultats » pour l'échantillon réel", () => {
    const r = construireResultatsPublics(donnees())!;
    expect(libelleEchantillon(r)).toBe(
      "Sur 1 session réalisée et 1 stagiaire — premiers résultats.",
    );
    expect(libellePeriode(r)).toBe("Session du 5 septembre 2026.");
  });
  it("pluriel et période étendue", () => {
    const r = construireResultatsPublics(
      donnees({
        sessions: [
          SESSION_REELLE,
          {
            dateDebut: new Date("2026-11-02T08:00:00.000Z"),
            dateFin: new Date("2026-11-02T16:00:00.000Z"),
          },
        ],
        inscriptions: Array.from({ length: 6 }, () => ({ tauxPresencePct: 100 })),
        notes: [5, 5, 4, 5, 4, 5],
      }),
    )!;
    expect(libelleEchantillon(r)).toBe("Sur 2 sessions réalisées et 6 stagiaires.");
    expect(libellePeriode(r)).toBe("Sessions du 5 septembre 2026 au 2 novembre 2026.");
  });
  it("dates et notes à la française", () => {
    expect(dateLongueFr(MAINTENANT)).toBe("1er octobre 2026");
    expect(noteFr(5)).toBe("5");
    expect(noteFr(4.9)).toBe("4,9");
  });
});

describe("getResultatsPublicsFormation — lecture en base", () => {
  const urlInitiale = process.env["DATABASE_URL"];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/axion";
    db.formation.findUnique.mockResolvedValue({
      id: "f-038",
      indicateursPubliesAt: new Date("2026-10-01T09:00:00.000Z"),
    });
    db.trainingSession.findMany.mockResolvedValue([SESSION_REELLE]);
    db.enrollment.findMany.mockResolvedValue([{ tauxPresencePct: 100 }]);
    db.questionnaire.findMany.mockResolvedValue([{ noteGlobale: 5 }]);
  });
  afterEach(() => {
    process.env["DATABASE_URL"] = urlInitiale;
  });

  it("rattache par le slug catalogue et ne lit que les sessions réalisées", async () => {
    const r = await getResultatsPublicsFormation("ia-pour-bien-commencer-journee", MAINTENANT);
    expect(r?.nbStagiaires).toBe(1);
    expect(db.formation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "ia-pour-bien-commencer-journee" } }),
    );
    expect(db.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { formationId: "f-038", statut: "realisee" } }),
    );
    expect(db.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          statut: { notIn: ["abandon", "exclu"] },
          session: { formationId: "f-038", statut: "realisee" },
        },
      }),
    );
  });

  it("absent sans publication — et ne lit même pas les sessions", async () => {
    db.formation.findUnique.mockResolvedValue({ id: "f-038", indicateursPubliesAt: null });
    expect(await getResultatsPublicsFormation("ia-pour-bien-commencer-journee")).toBeNull();
    expect(db.trainingSession.findMany).not.toHaveBeenCalled();
  });

  it("absent sans session réalisée", async () => {
    db.trainingSession.findMany.mockResolvedValue([]);
    expect(await getResultatsPublicsFormation("ia-pour-bien-commencer-journee")).toBeNull();
  });

  it("absent si la formation n'existe pas en base", async () => {
    db.formation.findUnique.mockResolvedValue(null);
    expect(await getResultatsPublicsFormation("slug-inconnu")).toBeNull();
  });

  it("absent sous stub.invalid, SANS aucune requête (build ADR 0026)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await getResultatsPublicsFormation("ia-pour-bien-commencer-journee")).toBeNull();
    expect(db.formation.findUnique).not.toHaveBeenCalled();
  });

  it("une base en panne ne casse pas la fiche : absent", async () => {
    db.formation.findUnique.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await getResultatsPublicsFormation("ia-pour-bien-commencer-journee")).toBeNull();
  });
});
