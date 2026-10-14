/**
 * Lot 8B — décision du dirigeant (a) : une ALERTE prévient quand le certificat de
 * réalisation d'un stagiaire manque, une fois l'émission automatique passée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  debut: null as Date | null,
  panne: false,
  inscrits: vi.fn(),
  pieces: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: h.inscrits },
    documentGenere: { findMany: h.pieces },
  },
}));
vi.mock("@/server/qualiopi/documents/certificat-auto-allumage", () => ({
  DELAI_CERTIFICAT_AUTO_JOURS: 2,
  FENETRE_CERTIFICAT_AUTO_JOURS: 90,
  lireDebutCertificatAutoOuLever: async () => {
    if (h.panne) throw new Error("délai dépassé");
    return h.debut;
  },
}));

import { ALERTE_CATALOGUE } from "./catalogue";
import {
  DELAI_ALERTE_CERTIFICAT_JOURS,
  regleCertificatRealisationManquant,
} from "./regle-certificat-realisation-manquant";

const NOW = new Date("2026-11-20T07:00:00Z");
const E1 = "11111111-1111-4111-8111-111111111111";
const E2 = "22222222-2222-4222-8222-222222222222";

function inscrit(id: string, traineeId: string) {
  return {
    id,
    traineeId,
    sessionId: "s1",
    trainee: { prenom: "Ana", nom: "Lune" },
    session: { numero: "AXI-SESS-2026-042" },
  };
}

beforeEach(() => {
  h.debut = new Date("2026-11-09T23:00:00Z");
  h.panne = false;
  h.inscrits.mockReset().mockResolvedValue([inscrit(E1, "t1"), inscrit(E2, "t2")]);
  h.pieces.mockReset().mockResolvedValue([]);
});

describe("certificat_realisation_manquant", () => {
  it("interrupteur éteint : aucune alerte, rien n'est lu (comportement d'avant)", async () => {
    h.debut = null;
    expect(await regleCertificatRealisationManquant(NOW)).toEqual([]);
    expect(h.inscrits).not.toHaveBeenCalled();
  });

  it("une alerte par stagiaire actif sans certificat VIVANT, J+3 après la fin", async () => {
    // t1 a un certificat vivant ; t2 n'en a pas (ou seulement un annulé, exclu par le filtre).
    h.pieces.mockResolvedValue([{ sessionId: "s1", traineeId: "t1" }]);
    const a = await regleCertificatRealisationManquant(NOW);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      code: "certificat_realisation_manquant",
      cibleType: "Enrollment",
      cibleId: E2,
      niveau: ALERTE_CATALOGUE["certificat_realisation_manquant"]!.niveau,
      titre: ALERTE_CATALOGUE["certificat_realisation_manquant"]!.titre,
    });
    expect(a[0]!.message).toMatch(/AXI-SESS-2026-042/);
    const where = h.inscrits.mock.calls[0]![0].where;
    expect(where.statut).toEqual({ notIn: ["abandon", "exclu"] });
    expect(where.session.statut).toBe("realisee");
    expect(where.session.dateFin.lte).toEqual(
      new Date(NOW.getTime() - DELAI_ALERTE_CERTIFICAT_JOURS * 86_400_000),
    );
    // Jamais rétroactif : bornée à l'allumage.
    expect(where.session.dateFin.gte).toEqual(h.debut);
    expect(h.pieces.mock.calls[0]![0].where).toMatchObject({
      type: "certificat_realisation",
      annuleeAt: null,
    });
  });

  it("délai : laisse passer deux émissions automatiques (J+2, J+3) avant d'alerter", () => {
    expect(DELAI_ALERTE_CERTIFICAT_JOURS).toBe(4);
  });

  it("réglage illisible : la règle LÈVE (compte en échec), elle ne referme pas les alertes", async () => {
    h.panne = true;
    await expect(regleCertificatRealisationManquant(NOW)).rejects.toThrow();
  });

  it("le message dit quand l'alerte se referme seule", async () => {
    const a = await regleCertificatRealisationManquant(NOW);
    expect(a[0]!.message).toMatch(/au plus tard 90 jours après la fin/);
    expect(a[0]!.message).not.toMatch(/exige/);
  });

  it("se referme seule quand le certificat existe (résolution automatique)", () => {
    expect(ALERTE_CATALOGUE["certificat_realisation_manquant"]!.resolutionAuto).toBe(true);
  });
});
