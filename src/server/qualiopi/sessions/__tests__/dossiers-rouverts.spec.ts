/**
 * Lot L4 (2026-09-30) — dossiers rouverts : la tâche « À traiter » (> 7 jours)
 * et l'encart du Mode auditeur, qui doit dire EXACTEMENT ce que dit le manifeste.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingSession: { findMany: vi.fn() },
    sessionDossierEvenement: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  candidatsRouvertsAnciens,
  lignesEcranReouvertures,
  listerDossiersRouvertsAnciens,
} from "../dossiers-rouverts";
import {
  lignesManifesteReouvertures,
  regrouperReouvertures,
  type ReouvertureSessionManifeste,
} from "../historique-dossier";

const MAINTENANT = new Date("2026-09-30T10:00:00.000Z");
const IL_Y_A = (j: number) => new Date(MAINTENANT.getTime() - j * 24 * 60 * 60 * 1000);

const MOTIF = "Nom du stagiaire mal orthographié sur l'attestation";

function evt(sessionId: string, type: "reouverture" | "reverrouillage", le: Date) {
  return {
    sessionId,
    type,
    createdAt: le,
    auteurNom: "Williams Jullin",
    motif: type === "reouverture" ? MOTIF : null,
    session: { numero: `AXI-SESS-2026-${sessionId}`, titreSession: `Session ${sessionId}` },
  };
}

/** Une session réalisée et complète : son état ne dépend que des événements. */
function ligneSession(id: string, statut = "realisee") {
  return {
    id,
    statut,
    transitions: [{ createdAt: IL_Y_A(40) }],
    enrollments: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("candidatsRouvertsAnciens (pur)", () => {
  const registre = regrouperReouvertures([
    evt("001", "reouverture", IL_Y_A(10)),
    evt("002", "reouverture", IL_Y_A(3)),
    evt("003", "reouverture", IL_Y_A(20)),
    evt("003", "reverrouillage", IL_Y_A(15)),
  ]);

  it("ne retient que les dossiers ENCORE rouverts depuis plus de 7 jours", () => {
    const c = candidatsRouvertsAnciens(registre, MAINTENANT);
    expect(c.map((s) => s.numero)).toEqual(["AXI-SESS-2026-001"]);
  });
});

describe("listerDossiersRouvertsAnciens — la tâche de « À traiter »", () => {
  it("rend le motif, l'auteur et l'ancienneté, confirmés par le verrou (ADR 0060)", async () => {
    const evenements = [evt("001", "reouverture", IL_Y_A(10)), evt("002", "reouverture", IL_Y_A(3))];
    prismaMock.sessionDossierEvenement.findMany.mockImplementation(
      async (args: { where?: { sessionId?: { in: string[] } } }) => {
        const ids = args.where?.sessionId?.in;
        return ids ? evenements.filter((e) => ids.includes(e.sessionId)) : evenements;
      },
    );
    prismaMock.trainingSession.findMany.mockResolvedValue([ligneSession("001")]);

    const r = await listerDossiersRouvertsAnciens(MAINTENANT);

    expect(r).toEqual([
      {
        sessionId: "001",
        numero: "AXI-SESS-2026-001",
        titre: "Session 001",
        depuis: IL_Y_A(10),
        par: "Williams Jullin",
        motif: MOTIF,
        jours: 10,
      },
    ]);
    // Une seule lecture groupée des états, pour les seuls candidats.
    expect(prismaMock.trainingSession.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.trainingSession.findMany.mock.calls[0]?.[0]?.where).toEqual({
      id: { in: ["001"] },
    });
  });

  it("une session annulée après réouverture n'est pas une tâche", async () => {
    const evenements = [evt("001", "reouverture", IL_Y_A(10))];
    prismaMock.sessionDossierEvenement.findMany.mockResolvedValue(evenements);
    prismaMock.trainingSession.findMany.mockResolvedValue([ligneSession("001", "annulee")]);
    expect(await listerDossiersRouvertsAnciens(MAINTENANT)).toEqual([]);
  });

  it("un registre illisible rend null — jamais « aucun dossier rouvert »", async () => {
    prismaMock.sessionDossierEvenement.findMany.mockRejectedValue(new Error("panne"));
    expect(await listerDossiersRouvertsAnciens(MAINTENANT)).toBeNull();
  });
});

describe("encart du Mode auditeur — même source, même texte que manifeste.json", () => {
  const registre: ReouvertureSessionManifeste[] = regrouperReouvertures([
    evt("001", "reouverture", IL_Y_A(10)),
    evt("004", "reouverture", IL_Y_A(30)),
    evt("004", "reverrouillage", IL_Y_A(29)),
  ]);

  it("chaque ligne de l'écran est une ligne du manifeste, sans sa syntaxe Markdown", () => {
    const ecran = lignesEcranReouvertures(registre);
    const manifeste = lignesManifesteReouvertures(registre).join("\n");
    expect(ecran.titre).toBe("Réouvertures de dossiers de session");
    expect(ecran.resume).toContain("2 sessions rouvertes");
    expect(manifeste).toContain(`**${ecran.resume.split(" après")[0]}**`);
    expect(ecran.details).toHaveLength(2);
    // Numéro + suite = la ligne du manifeste, à la puce près.
    for (const d of ecran.details) expect(manifeste).toContain(`- ${d.numero}${d.suite}`);
    expect(ecran.details.map((d) => d.sessionId)).toEqual(["001", "004"]);
    const texte = ecran.details.map((d) => d.suite).join("\n");
    expect(texte).toContain(MOTIF);
    expect(texte).not.toContain("**");
  });

  it("zéro réouverture : l'écran le dit comme le manifeste", () => {
    expect(lignesEcranReouvertures([]).resume).toBe(
      "0 session rouverte : aucun dossier clos n'a été rouvert.",
    );
  });

  it("registre illisible (manifeste `reouverturesRegistreLu: false`) : l'écran le dit, sans « 0 »", () => {
    const texte = lignesEcranReouvertures(null);
    expect(texte.resume).toContain("n'a pas pu être lu");
    expect(texte.resume).not.toContain("*");
  });
});
