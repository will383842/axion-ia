// @req REQ-INT-062
/**
 * INT-T67-A — le dossier de financement ne se génère pas tant que l'IDCC n'est
 * pas confirmé.
 *
 * TÉMOINS de l'acceptance :
 *  - statut `probable` → refus nommé ;
 *  - `confirme` → génération ;
 *  - dossier CPF → jamais bloqué ;
 *  - inter-entreprises, deux employeurs dont un seul confirmé → refus nommant
 *    l'autre (et pas le confirmé) ;
 *  - dossier existant intact.
 *
 * `creerDossierDepuisSession` et `creerDossierFinancementAction` sont RÉELS ;
 * seule la base est doublée, en mémoire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatutIdcc } from "../../../../../prisma/generated/client";

// ─── Fausse base ───────────────────────────────────────────────────────────

interface ClientFaux {
  id: string;
  raisonSociale: string;
  idcc: string | null;
  opcoIdentifie: string | null;
  idccControle: { statut: StatutIdcc; idcc: string | null } | null;
}

const h = vi.hoisted(() => ({
  clients: new Map<string, unknown>(),
  session: null as unknown,
  dossierExistant: null as { id: string } | null,
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  clientFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUniqueOrThrow: async () => h.session,
    },
    dossierFinancement: {
      findFirst: async () => h.dossierExistant,
      create: (...a: unknown[]) => h.create(...a),
      update: (...a: unknown[]) => h.update(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
      deleteMany: (...a: unknown[]) => h.deleteMany(...a),
    },
    client: {
      findUnique: async (args: { where: { id: string } }) => h.clients.get(args.where.id) ?? null,
      findMany: (...a: unknown[]) => h.clientFindMany(...a),
    },
  },
}));
vi.mock("@/server/partners-sync/producteurs/facturation", () => ({
  emettreFinancementMisAJour: vi.fn(),
  transactionFaitFacturation: async (
    client: unknown,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn(client),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { creerDossierDepuisSession } from "../dossier-financement";
import { creerDossierFinancementAction } from "@/server/actions/qualiopi/facturation-hub";
import {
  deciderBlocageIdcc,
  employeursConcernes,
  GenerationDossierRefuseeIdcc,
  RAPPEL_DEPOT,
  statutIdccEffectif,
  type EmployeurIdccLu,
} from "../blocage-idcc";

// ─── Données ───────────────────────────────────────────────────────────────

const SESSION = "55555555-5555-4555-8555-555555555555";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function client(
  id: string,
  raisonSociale: string,
  statut: StatutIdcc | null,
  idcc: string | null = "1596",
): ClientFaux {
  return {
    id,
    raisonSociale,
    idcc,
    opcoIdentifie: "constructys",
    idccControle: statut === null ? null : { statut, idcc },
  };
}

function poser(...cs: ClientFaux[]) {
  for (const c of cs) h.clients.set(c.id, c);
}

interface Inscription {
  financementType: string | null;
  clientId: string | null;
}

function session(
  financementType: string,
  enrollments: Inscription[] = [],
  clientId: string | null = A,
) {
  const porteur = clientId === null ? null : (h.clients.get(clientId) as ClientFaux | undefined);
  h.session = {
    id: SESSION,
    clientId,
    dateDebut: new Date("2026-11-16T08:00:00.000Z"),
    montantHtCents: 300_000,
    financementType,
    opcoSubrogation: false,
    numeroDossierOpco: null,
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    nbParticipantsPrevus: 2,
    formation: { dureeHeures: 14 },
    edofVerifieAt: null,
    ftDispositif: null,
    client: porteur ?? null,
    enrollments: enrollments.map((e) => ({
      ...e,
      numeroDossierOpco: null,
      edofVerifieAt: null,
      ftDispositif: null,
      montantHtCents: 150_000,
      client: e.clientId === null ? null : (h.clients.get(e.clientId) ?? null),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.clients.clear();
  h.session = null;
  h.dossierExistant = null;
  h.create.mockResolvedValue({ id: "d-neuf" });
  h.clientFindMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
    args.where.id.in.flatMap((id) => {
      const c = h.clients.get(id) as ClientFaux | undefined;
      return c === undefined
        ? []
        : [
            {
              id: c.id,
              raisonSociale: c.raisonSociale,
              idcc: c.idcc,
              idccControle: c.idccControle,
            },
          ];
    }),
  );
});

async function refus(p: Promise<unknown>): Promise<GenerationDossierRefuseeIdcc> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, "la génération aurait dû être refusée").toBeInstanceOf(GenerationDossierRefuseeIdcc);
  return err as GenerationDossierRefuseeIdcc;
}

// ─── Témoins de l'acceptance ───────────────────────────────────────────────

describe("INT-T67-A — témoins", () => {
  it("statut `probable` → refus NOMMÉ, au vouvoiement, avec le rappel du dépôt", async () => {
    poser(client(A, "Bâtiments Durand", "probable"));
    session("opco");
    const err = await refus(creerDossierDepuisSession(SESSION));
    expect(err.message).toBe(
      "Le dossier de financement ne peut pas être généré : l'IDCC de l'entreprise " +
        "« Bâtiments Durand » (IDCC probable) n'est pas confirmé. Confirmez l'IDCC de ce " +
        "client par une preuve déclarative (attestation de l'entreprise, déclaration à " +
        "l'OPCO ou accord de prise en charge), depuis la fiche client, puis relancez la " +
        "génération. Rappel : la demande est à déposer avant le début de la formation, " +
        "prévu le 16/11/2026.",
    );
    expect(err.message).toContain(RAPPEL_DEPOT);
    expect(err.bloquants).toEqual([
      { id: A, raisonSociale: "Bâtiments Durand", statut: "probable", confirmationPerimee: false },
    ]);
    expect(h.create, "un dossier a été créé malgré le refus").not.toHaveBeenCalled();
  });

  it("statut `confirme` → génération", async () => {
    poser(client(A, "Bâtiments Durand", "confirme"));
    session("opco");
    await expect(creerDossierDepuisSession(SESSION)).resolves.toEqual({ id: "d-neuf" });
    expect(h.create).toHaveBeenCalledTimes(1);
    const data = (h.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["type"]).toBe("opco");
  });

  it("dossier CPF → jamais bloqué, et l'IDCC n'est même pas lu", async () => {
    poser(client(A, "Bâtiments Durand", "anomalie"));
    session("cpf");
    await expect(creerDossierDepuisSession(SESSION)).resolves.toEqual({ id: "d-neuf" });
    expect(h.clientFindMany).not.toHaveBeenCalled();
  });

  it("dossiers France Travail et CPF libres → jamais bloqués", async () => {
    poser(client(A, "Bâtiments Durand", null));
    for (const type of ["cpf", "france_travail"] as const) {
      const r = await creerDossierFinancementAction({ clientId: A, type });
      expect(r).toEqual({ data: { dossierId: "d-neuf" } });
    }
    expect(h.clientFindMany).not.toHaveBeenCalled();
  });

  it("inter-entreprises, deux employeurs dont un seul confirmé → refus nommant l'AUTRE", async () => {
    poser(client(A, "Bâtiments Durand", "confirme"), client(B, "Charpentes Martin", "concordant"));
    session("opco", [
      { financementType: null, clientId: A },
      { financementType: null, clientId: B },
    ]);
    const err = await refus(creerDossierDepuisSession(SESSION));
    expect(err.message).toContain("« Charpentes Martin » (IDCC concordant)");
    expect(err.message, "l'employeur confirmé ne doit pas être nommé").not.toContain(
      "Bâtiments Durand",
    );
    expect(err.bloquants.map((b) => b.id)).toEqual([B]);
    // Le contrôle est PAR EMPLOYEUR : les deux ont été lus.
    const lus = (h.clientFindMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } }).where
      .id.in;
    expect(lus).toEqual([A, B]);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("dossier EXISTANT intact : rendu tel quel, ni lu pour l'IDCC, ni modifié, ni supprimé", async () => {
    poser(client(A, "Bâtiments Durand", "anomalie"));
    session("opco");
    h.dossierExistant = { id: "d-existant" };
    await expect(creerDossierDepuisSession(SESSION)).resolves.toEqual({ id: "d-existant" });
    expect(h.clientFindMany).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── Périmètre ─────────────────────────────────────────────────────────────

describe("INT-T67-A — seuls les dossiers opco et mixte sont bloqués", () => {
  it("dossier mixte non confirmé → refus", async () => {
    poser(client(A, "Bâtiments Durand", "concordant"));
    session("mixte");
    await refus(creerDossierDepuisSession(SESSION));
  });

  it("pas de ligne de contrôle = `non_renseigne` → refus nommé", async () => {
    poser(client(A, "Bâtiments Durand", null));
    session("opco");
    const err = await refus(creerDossierDepuisSession(SESSION));
    expect(err.message).toContain("« Bâtiments Durand » (IDCC non renseigné)");
  });

  it("inter-entreprises : le siège CPF d'une session OPCO ne rend pas son employeur concerné", async () => {
    poser(client(A, "Bâtiments Durand", "confirme"), client(C, "Plomberie Leroy", null));
    session("opco", [
      { financementType: null, clientId: A },
      { financementType: "cpf", clientId: C },
    ]);
    await expect(creerDossierDepuisSession(SESSION)).resolves.toEqual({ id: "d-neuf" });
  });

  it("inter-entreprises : un siège sans employeur retombe sur le client de la session", () => {
    expect(
      employeursConcernes({
        financementType: "opco",
        clientId: A,
        enrollments: [
          { financementType: null, clientId: null },
          { financementType: "opco", clientId: B },
          { financementType: "direct", clientId: C },
          { financementType: null, clientId: B },
        ],
      }),
    ).toEqual([A, B]);
  });

  it("un siège OPCO sans aucune entreprise rattachée → refus qui le dit", async () => {
    session("opco", [{ financementType: null, clientId: null }], null);
    const err = await refus(creerDossierDepuisSession(SESSION));
    expect(err.message).toContain("une inscription sans entreprise rattachée");
    expect(err.message).toContain("Rattachez chaque inscription");
  });

  it("dossier libre OPCO depuis le hub : refus nommé rendu à l'écran, rien de créé", async () => {
    poser(client(A, "Bâtiments Durand", "probable"));
    const r = await creerDossierFinancementAction({ clientId: A, type: "opco" });
    expect("error" in r && r.error).toContain("« Bâtiments Durand » (IDCC probable)");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("dossier libre OPCO depuis le hub, IDCC confirmé → créé", async () => {
    poser(client(A, "Bâtiments Durand", "confirme"));
    const r = await creerDossierFinancementAction({ clientId: A, type: "opco" });
    expect(r).toEqual({ data: { dossierId: "d-neuf" } });
  });
});

// ─── Statut effectif ───────────────────────────────────────────────────────

describe("INT-T67-A — un `confirme` ne vaut que pour l'IDCC de la fiche", () => {
  const lu = (saisi: string | null, controle: EmployeurIdccLu["controle"]): EmployeurIdccLu => ({
    id: A,
    raisonSociale: "Bâtiments Durand",
    idccSaisi: saisi,
    controle,
  });

  it("confirmé pour l'IDCC saisi (même écrit autrement) → confirmé", () => {
    expect(statutIdccEffectif(lu(" 1596 ", { statut: "confirme", idcc: "1596" }))).toEqual({
      statut: "confirme",
      confirmationPerimee: false,
    });
  });

  it("confirmé pour un AUTRE IDCC que celui de la fiche → refus qui le dit", () => {
    const d = deciderBlocageIdcc({
      typeDossier: "opco",
      employeurs: [A],
      lus: [lu("1597", { statut: "confirme", idcc: "1596" })],
      dateDebut: null,
    });
    expect(d.bloque).toBe(true);
    expect(d.bloque && d.message).toContain(
      "« Bâtiments Durand » (confirmation portant sur un autre IDCC que celui de la fiche)",
    );
    expect(d.bloque && d.message).toContain(
      "Rappel : la demande est à déposer avant le début de la formation.",
    );
  });

  it("aucun des quatre autres statuts ne laisse passer", () => {
    for (const statut of ["non_renseigne", "probable", "concordant", "anomalie"] as const) {
      const d = deciderBlocageIdcc({
        typeDossier: "opco",
        employeurs: [A],
        lus: [lu("1596", { statut, idcc: "1596" })],
        dateDebut: null,
      });
      expect(d.bloque, statut).toBe(true);
    }
  });

  it("un employeur concerné introuvable en base bloque comme `non_renseigne`", () => {
    const d = deciderBlocageIdcc({
      typeDossier: "mixte",
      employeurs: [B],
      lus: [],
      dateDebut: null,
    });
    expect(d.bloque && d.bloquants[0]?.statut).toBe("non_renseigne");
  });
});
