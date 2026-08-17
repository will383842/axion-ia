/**
 * Tests NÉGATIFS de la cohérence « type de client ».
 *
 * ## Ce que ces tests verrouillent
 *
 * Deux règles métier n'existaient QUE dans l'interface :
 *
 *   1. les champs d'employeur (SIRET, NAF, IDCC, taille, OPCO) sont masqués pour
 *      un particulier par `ClientEditForm` / `ClientBrancheForm` ;
 *   2. le dispositif de financement n'était croisé avec rien du tout.
 *
 * Or **masquer n'est pas interdire** : une Server Action est joignable
 * directement. C'est le défaut corrigé au Lot 10 sur les habilitations, appliqué
 * ici aux données — et il produit des dégâts plus discrets : un OPCO posé sur un
 * particulier ne se voit qu'au refus du financeur, des semaines plus tard, la
 * formation déjà tenue.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSessionFindUnique,
  mockSessionUpdate,
  mockClientCreate,
  mockClientFindFirst,
  mockClientFindMany,
} = vi.hoisted(() => ({
  mockSessionFindUnique: vi.fn(),
  mockSessionUpdate: vi.fn(),
  mockClientCreate: vi.fn(),
  mockClientFindFirst: vi.fn(),
  // `nextNumero` lit la série AXI-CLI pour en prendre la borne haute.
  mockClientFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: mockSessionFindUnique, update: mockSessionUpdate },
    client: {
      create: mockClientCreate,
      findFirst: mockClientFindFirst,
      findMany: mockClientFindMany,
      count: vi.fn(),
    },
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/qualiopi/_revalidate", () => ({
  revalidateQualiopi: vi.fn(),
  revalidateAdmin: vi.fn(),
}));

import { setFinancementSessionAction } from "@/server/actions/qualiopi/financements";
import { createClientAction } from "@/server/actions/qualiopi/clients";

const SESSION_ID = "33333333-3333-4333-8333-333333333333";

describe("type × dispositif de financement — refus SERVEUR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
  });

  it("🔴 REFUSE le CPF sur un client entreprise", async () => {
    // Le CPF est le compte d'une PERSONNE : une personne morale n'en a pas.
    mockSessionFindUnique.mockResolvedValue({ client: { type: "entreprise" } });

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "cpf" });

    expect("error" in r, "le CPF a été accepté sur une entreprise").toBe(true);
    expect((r as { error: string }).error).toContain("compte personnel");
    expect(mockSessionUpdate, "la session a été modifiée malgré le refus").not.toHaveBeenCalled();
  });

  it("🔴 REFUSE l'OPCO sur un client particulier", async () => {
    // Un OPCO finance l'obligation de formation d'un EMPLOYEUR.
    mockSessionFindUnique.mockResolvedValue({ client: { type: "particulier" } });

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain("employeur");
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("ACCEPTE les combinaisons légitimes — une garde trop large se fait contourner", async () => {
    mockSessionFindUnique.mockResolvedValue({ client: { type: "entreprise" } });
    await expect(
      setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" }),
    ).resolves.toEqual({ data: { id: SESSION_ID } });

    mockSessionFindUnique.mockResolvedValue({ client: { type: "particulier" } });
    await expect(
      setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "cpf" }),
    ).resolves.toEqual({ data: { id: SESSION_ID } });
  });

  it("France Travail n'est PAS restreint — un employeur peut monter une POEI", async () => {
    // Un demandeur d'emploi est un particulier, mais la POEI est un dispositif
    // d'employeur. Refuser l'un des deux cas serait un faux positif.
    for (const type of ["entreprise", "particulier"]) {
      mockSessionFindUnique.mockResolvedValue({ client: { type } });
      await expect(
        setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "france_travail" }),
      ).resolves.toEqual({ data: { id: SESSION_ID } });
    }
  });

  it("un client absent ne bloque rien : on ne refuse que sur une contradiction ÉTABLIE", async () => {
    mockSessionFindUnique.mockResolvedValue({ client: null });
    await expect(
      setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "cpf" }),
    ).resolves.toEqual({ data: { id: SESSION_ID } });
  });
});

describe("type × champs d'employeur — refus SERVEUR à la création du client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientFindFirst.mockResolvedValue(null);
    mockClientFindMany.mockResolvedValue([]);
    mockClientCreate.mockResolvedValue({ id: "c-1", numero: "AXI-CLI-001" });
  });

  it.each(["siret", "nafCode", "idcc", "opcoIdentifie"])(
    "🔴 REFUSE « %s » sur un particulier — masquer dans l'UI n'est pas interdire",
    async (champ) => {
      const valeurs: Record<string, string> = {
        siret: "55210055400013",
        nafCode: "8559A",
        idcc: "1486",
        opcoIdentifie: "atlas",
      };
      const r = await createClientAction({
        type: "particulier",
        raisonSociale: "Camille Durand",
        [champ]: valeurs[champ],
      } as never);

      expect("error" in r, `« ${champ} » a été accepté sur un particulier`).toBe(true);
      expect(mockClientCreate, "le client a été créé malgré le refus").not.toHaveBeenCalled();
    },
  );

  it("un particulier SANS champ d'employeur passe — la garde ne gêne pas le cas normal", async () => {
    const r = await createClientAction({
      type: "particulier",
      raisonSociale: "Camille Durand",
      contactEmail: "camille@example.test",
    } as never);

    expect("error" in r).toBe(false);
    expect(mockClientCreate).toHaveBeenCalled();
  });

  it("une entreprise garde tous ses champs — la garde ne mord que sur le type visé", async () => {
    const r = await createClientAction({
      type: "entreprise",
      raisonSociale: "ACME SAS",
      siret: "55210055400013",
      idcc: "1486",
      opcoIdentifie: "atlas",
    } as never);

    expect("error" in r).toBe(false);
    expect(mockClientCreate).toHaveBeenCalled();
  });
});
