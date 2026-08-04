/**
 * Tests — trainers/fiabilite-service.ts (art. 7 et 8 sous-traitance, 2026-08-03).
 *
 * Ce qui est vérifié ici n'est pas « la fonction rend un objet » mais les trois
 * décisions métier qu'elle encode, et qu'une régression effacerait sans bruit :
 *
 *  1. le dénominateur passe par la JOINTURE, pas par le cache `formateurPrincipalId` ;
 *  2. seuls l'annulation tardive et le désistement pèsent ;
 *  3. le niveau reste un signal, jamais une interdiction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sessionFormateur: { count: vi.fn() },
    incident: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { fiabiliteFormateur, fiabiliteSousTraitant } from "./fiabilite-service";

const mp = prisma as unknown as {
  sessionFormateur: { count: ReturnType<typeof vi.fn> };
  incident: { count: ReturnType<typeof vi.fn> };
};

/**
 * `Promise.all` résout dans l'ordre des appels : missions, incidents totaux,
 * incidents bloquants. Les mocks positionnels suivent ce même ordre.
 */
function donner(missions: number, total: number, bloquants: number) {
  mp.sessionFormateur.count.mockResolvedValue(missions);
  mp.incident.count.mockResolvedValueOnce(total).mockResolvedValueOnce(bloquants);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fiabiliteFormateur — le dénominateur", () => {
  it("compte les missions par la JOINTURE, pas par le cache formateurPrincipalId", async () => {
    donner(4, 0, 0);
    await fiabiliteFormateur("tr-1");

    // 🔴 Le cœur du test. `TrainingSession.formateurPrincipalId` est un cache
    // dénormalisé qui ignore les co-animations : l'utiliser gonflerait le taux
    // d'incidents d'un formateur souvent co-animateur.
    expect(mp.sessionFormateur.count).toHaveBeenCalledTimes(1);
    const arg = mp.sessionFormateur.count.mock.calls[0]?.[0] as {
      where: { trainerId: string; session: { statut: string } };
    };
    expect(arg.where.trainerId).toBe("tr-1");
    expect(arg.where.session.statut).toBe("realisee");
  });

  it("ne compte QUE les sessions réalisées — une session annulée n'est pas une mission", async () => {
    donner(0, 0, 0);
    await fiabiliteFormateur("tr-1");
    const arg = mp.sessionFormateur.count.mock.calls[0]?.[0] as {
      where: { session: { statut: string } };
    };
    // Sinon un désistement gonflerait le dénominateur qu'il est censé dégrader.
    expect(arg.where.session.statut).toBe("realisee");
  });
});

describe("fiabiliteFormateur — quels faits pèsent", () => {
  it("ne retient que l'annulation tardive et le désistement", async () => {
    donner(10, 3, 1);
    await fiabiliteFormateur("tr-1");
    const argBloquants = mp.incident.count.mock.calls[1]?.[0] as {
      where: { faitIntervenant: { in: string[] } };
    };
    // Un retard ou une preuve manquante se rattrapent : ils comptent dans le
    // total, jamais dans les faits qui déclenchent la vigilance.
    expect(argBloquants.where.faitIntervenant.in).toStrictEqual([
      "annulation_tardive",
      "desistement",
    ]);
  });

  it("le total inclut TOUS les incidents visant le formateur", async () => {
    donner(10, 3, 1);
    const f = await fiabiliteFormateur("tr-1");
    expect(f.incidentsTotal).toBe(3);
    expect(f.incidentsBloquants).toBe(1);
  });
});

describe("fiabiliteFormateur — le niveau de vigilance", () => {
  it("aucun incident bloquant → aucune vigilance", async () => {
    donner(5, 2, 0);
    expect((await fiabiliteFormateur("tr-1")).niveauVigilance).toBe("aucune");
  });

  it("un incident bloquant → surveiller", async () => {
    donner(5, 1, 1);
    expect((await fiabiliteFormateur("tr-1")).niveauVigilance).toBe("surveiller");
  });

  it("deux incidents bloquants → vigilance forte, et RIEN de plus", async () => {
    donner(5, 2, 2);
    const f = await fiabiliteFormateur("tr-1");
    expect(f.niveauVigilance).toBe("vigilance_forte");
    // 🔴 Le niveau le plus élevé reste un signal d'affichage. Aucun état ne
    // signifie « inaffectable » : la décision revient à Will (cf. RC pro).
    expect(["aucune", "surveiller", "vigilance_forte"]).toContain(f.niveauVigilance);
  });

  it("le niveau suit les incidents bloquants, PAS le taux", async () => {
    // Deux formateurs au même taux (50 %), à volumes opposés.
    donner(2, 1, 1);
    const petit = await fiabiliteFormateur("tr-petit");
    vi.clearAllMocks();
    donner(8, 4, 4);
    const gros = await fiabiliteFormateur("tr-gros");

    expect(petit.tauxIncidentsBloquants).toBe(50);
    expect(gros.tauxIncidentsBloquants).toBe(50);
    // Un désistement sur deux missions ne dit rien ; quatre sur huit, si.
    expect(petit.niveauVigilance).toBe("surveiller");
    expect(gros.niveauVigilance).toBe("vigilance_forte");
  });
});

describe("fiabiliteFormateur — le taux", () => {
  it("reste null sans aucune mission — pas de division par zéro déguisée en 0 %", async () => {
    donner(0, 1, 1);
    const f = await fiabiliteFormateur("tr-1");
    // 0 % affirmerait « aucun problème » ; null dit « on ne peut pas savoir ».
    expect(f.tauxIncidentsBloquants).toBeNull();
  });

  it("s'arrondit à l'entier", async () => {
    donner(3, 1, 1);
    expect((await fiabiliteFormateur("tr-1")).tauxIncidentsBloquants).toBe(33);
  });
});

describe("fiabiliteFormateur — le résumé", () => {
  it("dit l'absence d'historique plutôt qu'un bilan vide flatteur", async () => {
    donner(0, 0, 0);
    expect((await fiabiliteFormateur("tr-1")).resume).toContain("Aucune mission");
  });

  it("nomme les faits qui ont fait tomber une session", async () => {
    donner(5, 3, 2);
    const r = (await fiabiliteFormateur("tr-1")).resume;
    expect(r).toContain("5 missions");
    expect(r).toContain("3 incidents");
    expect(r).toContain("2 ayant fait tomber une session");
  });

  it("ne parle pas de sessions tombées quand aucune ne l'est", async () => {
    donner(5, 2, 0);
    expect((await fiabiliteFormateur("tr-1")).resume).not.toContain("fait tomber");
  });
});

describe("fiabiliteSousTraitant", () => {
  it("expose les incidents SANS taux — le dénominateur n'existe pas", async () => {
    mp.incident.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const f = await fiabiliteSousTraitant("st-1");

    // Aucune relation ne rattache une session à un organisme sous-traitant.
    // Inventer un ratio serait une donnée fausse présentée comme un fait.
    expect(f.tauxIncidentsBloquants).toBeNull();
    expect(f.incidentsTotal).toBe(3);
    expect(f.incidentsBloquants).toBe(2);
    expect(f.niveauVigilance).toBe("vigilance_forte");
    expect(mp.sessionFormateur.count).not.toHaveBeenCalled();
  });

  it("cible bien l'organisme, jamais un formateur", async () => {
    mp.incident.count.mockResolvedValue(0);
    await fiabiliteSousTraitant("st-1");
    const arg = mp.incident.count.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where["sousTraitantId"]).toBe("st-1");
    expect(arg.where["trainerId"]).toBeUndefined();
  });
});

describe("stub-aware", () => {
  it("ne lit RIEN au build et rend un état neutre explicite", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    const f = await fiabiliteFormateur("tr-1");
    const s = await fiabiliteSousTraitant("st-1");

    expect(f.niveauVigilance).toBe("aucune");
    expect(s.niveauVigilance).toBe("aucune");
    // Le proxy stub rendrait 0 partout : un « aucun incident » trompeur. On sort
    // avant, et le résumé dit l'absence d'historique plutôt qu'un bilan vierge.
    expect(f.resume).toContain("Aucune mission");
    expect(mp.incident.count).not.toHaveBeenCalled();
    expect(mp.sessionFormateur.count).not.toHaveBeenCalled();

    process.env["DATABASE_URL"] = orig;
  });
});
