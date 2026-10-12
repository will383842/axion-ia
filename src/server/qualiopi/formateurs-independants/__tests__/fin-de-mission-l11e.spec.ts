/**
 * Lot L11e (fin) — une mission dont l'accord était donné ne tient plus
 * (formateur remplacé ou retiré, session annulée ou reportée) : la lettre NON
 * signée est annulée par le système, avec son motif fermé, F30 ou F31 sans
 * indemnité ; une lettre SIGNÉE est gardée et Will est prévenu une seule fois.
 * Interrupteurs coupés : rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const MISSION = "00000000-0000-4000-8000-000000000021";
const TRAINER = "00000000-0000-4000-8000-000000000011";
const AUTRE = "00000000-0000-4000-8000-000000000012";
const LETTRE = "00000000-0000-4000-8000-000000000031";

const h = vi.hoisted(() => {
  const etat = {
    allume: true,
    mission: null as Record<string, unknown> | null,
    annulees: 0,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.allume && ["formateurs.lettre_auto", "formateurs.lettre_v2"].includes(where.key)
          ? { value: { actif: true } }
          : null,
      ),
    },
    missionFormateur: {
      findUnique: vi.fn(async () => structuredClone(etat.mission)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(etat.mission!, data);
        return {};
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(etat.mission!, data);
        return { count: 1 };
      }),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    documentGenere: {
      count: vi.fn(async () => 1),
      findUnique: vi.fn(async () => ({ metadata: {} })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => {
        etat.annulees += 1;
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (f: ((tx: unknown) => unknown) | Promise<unknown>[]) =>
      Array.isArray(f) ? Promise.all(f) : f({ $executeRaw: vi.fn() }),
    ),
  };
  return {
    etat,
    prisma,
    generer: vi.fn(),
    envoyer: vi.fn(async () => "envoye"),
    telegram: vi.fn(async () => true),
    journaliser: vi.fn(async () => true),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journaliser }));
vi.mock("@/server/qualiopi/documents/lettre-mission-v2-generation", () => ({
  genererLettreMissionV2: h.generer,
  MOTIF_CHANGEMENT_FORMATEUR: "Formateur remplacé sur cette session",
}));
vi.mock("../envois", () => ({ envoyer: h.envoyer }));
vi.mock("../garde-mission-portes", () => ({
  controlerGardeMission: vi.fn(async () => ({ mode: "coupee", refus: [], avertissements: [] })),
}));

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import {
  MOTIF_FERMEE_LETTRE_SIGNEE,
  MOTIF_FERMETURE,
  causeFermeture,
  reevaluerMission,
} from "../moteur-mission";

const MAINTENANT = new Date("2026-10-12T09:00:00Z");

function mission(o: {
  signee?: boolean;
  sessionStatut?: string;
  principal?: string | null;
  statut?: string;
}) {
  return {
    id: MISSION,
    statut: o.statut ?? "acceptee",
    role: "principal",
    trainerId: TRAINER,
    sessionId: "s-1",
    lettreMissionId: LETTRE,
    lettreBlocageMotif: null,
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 0,
    regimeTvaFige: "franchise_293b",
    trainer: {
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      regimeTvaHonoraires: "franchise_293b",
      prenom: "Marie",
      nom: "Dupont",
      email: "marie@example.test",
    },
    session: {
      numero: "AXI-SESS-TEST",
      titreSession: "IA pour managers",
      statut: o.sessionStatut ?? "planifiee",
      dateDebut: new Date("2026-11-04T08:00:00Z"),
      dateFin: new Date("2026-11-05T16:00:00Z"),
      formateurPrincipalId: o.principal === undefined ? AUTRE : o.principal,
      lieuType: "sur_site",
      lieuAdresse: "12 rue Exemple",
      lieuCodePostal: "69003",
      lieuVille: "Lyon",
      jours: [{ date: new Date("2026-11-04T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" }],
    },
    lettreMission: {
      annuleeAt: null,
      metadata: {},
      signatures: o.signee ? [{ partie: "formateur" }] : [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.allume = true;
  h.etat.annulees = 0;
});

describe("fin de mission — cause", () => {
  it("annulée, reportée, formateur remplacé ; sinon aucune", () => {
    expect(causeFermeture({ sessionStatut: "annulee", affecte: true })).toBe("session_annulee");
    expect(causeFermeture({ sessionStatut: "reportee", affecte: true })).toBe("session_reportee");
    expect(causeFermeture({ sessionStatut: "planifiee", affecte: false })).toBe(
      "changement_formateur",
    );
    expect(causeFermeture({ sessionStatut: "planifiee", affecte: true })).toBeNull();
  });
});

describe("fin de mission — lettre NON signée", () => {
  it("formateur remplacé : lettre annulée (motif fermé), F30 sans indemnité, alerte sans nom", async () => {
    h.etat.mission = mission({});
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("lettre_annulee");
    expect(h.prisma.documentGenere.updateMany).toHaveBeenCalledWith({
      where: {
        id: LETTRE,
        annuleeAt: null,
        signatures: { none: { revokedAt: null, partie: "formateur" } },
      },
      data: expect.objectContaining({
        annuleeMotif: MOTIF_FERMETURE.changement_formateur,
        annuleePar: "system",
      }),
    });
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-mission-retiree",
        payload: expect.objectContaining({ etape: 2 }),
      }),
    );
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|IA pour managers|€/);
    // Rien n'est supprimé.
    expect(JSON.stringify(h.prisma)).not.toContain("deleteMany");
  });

  it("session annulée : F31, variante sans indemnité ; session reportée : motif session_reportee", async () => {
    h.etat.mission = mission({ sessionStatut: "annulee", principal: TRAINER });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).toHaveBeenLastCalledWith(
      expect.objectContaining({ gabarit: "formateur-formation-annulee" }),
    );
    h.etat.mission = mission({ sessionStatut: "reportee", principal: TRAINER });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.prisma.documentGenere.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annuleeMotif: MOTIF_FERMETURE.session_reportee }),
      }),
    );
  });

  it("les variantes envoyées n'annoncent aucune indemnité et n'emploient aucun mot interdit", () => {
    const interdits =
      /poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i;
    for (const g of ["formateur-mission-retiree", "formateur-formation-annulee"] as const) {
      const v = TEXTES_FORMATEUR[g].variantes[1]!;
      const texte = [v.objet, ...v.paragraphes].join(" ");
      expect(texte).not.toMatch(/honoraires|indemnit|réglée/i);
      expect(texte).not.toMatch(interdits);
    }
  });
});

describe("correctifs de relecture", () => {
  it("mission RETIRÉE par l'équipe (cas réel du remplacement) : lettre non signée annulée, F30", async () => {
    h.etat.mission = mission({ statut: "retiree" });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("lettre_annulee");
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-mission-retiree" }),
    );
  });

  it("retirée mais encore affectée (même personne réaffectée) : rien", async () => {
    h.etat.mission = mission({ statut: "retiree", principal: TRAINER });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
  });

  it("session COMMENCÉE : la lettre des journées animées n'est jamais annulée, Will décide", async () => {
    h.etat.mission = mission({ sessionStatut: "annulee", principal: TRAINER });
    const pendant = new Date("2026-11-04T12:00:00Z");
    await reevaluerMission(MISSION, "passage", pendant);
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledTimes(1);
  });

  it("le motif de changement de formateur est celui du générateur (une seule écriture)", () => {
    expect(MOTIF_FERMETURE.changement_formateur).toBe("Formateur remplacé sur cette session");
  });
});

describe("fin de mission — lettre SIGNÉE", () => {
  it("gardée au registre, Will prévenu UNE fois, aucun e-mail au formateur", async () => {
    h.etat.mission = mission({ signee: true });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledTimes(1);
    expect(h.etat.mission!.lettreBlocageMotif).toBe(MOTIF_FERMEE_LETTRE_SIGNEE);
  });
});

describe("fin de mission — rien à faire", () => {
  it("interrupteurs coupés : rien n'est lu ni écrit", async () => {
    h.etat.allume = false;
    h.etat.mission = mission({});
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("coupe");
    expect(h.prisma.missionFormateur.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
  });

  it("mission refusée, ou lettre déjà annulée : rien", async () => {
    h.etat.mission = mission({ statut: "refusee" });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    h.etat.mission = {
      ...mission({}),
      lettreMission: { annuleeAt: MAINTENANT, metadata: {}, signatures: [] },
    };
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
  });
});

describe("correctifs du 1er tour de relecture de #1507 — report", () => {
  it("report, formateur reconduit : lettre non signée annulée (session_reportee), AUCUN F30, Will prévenu sans nom", async () => {
    h.etat.mission = mission({ sessionStatut: "reportee", principal: TRAINER });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("lettre_annulee");
    expect(h.prisma.documentGenere.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annuleeMotif: MOTIF_FERMETURE.session_reportee }),
      }),
    );
    // 08b §3.4 : nouvelle lettre quand l'accord sur les nouvelles dates est donné ;
    // rien ne dit au formateur que la mission « ne lui est plus confiée ».
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.telegram.mock.calls)).toMatch(/report/i);
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|IA pour managers|€/);
  });

  it("report, lettre SIGNÉE : gardée, Will prévenu une fois, aucun e-mail", async () => {
    h.etat.mission = mission({ sessionStatut: "reportee", principal: TRAINER, signee: true });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledTimes(1);
  });

  it("mission RETIRÉE puis session ANNULÉE : la cause est l'annulation (F31), pas le changement de formateur", async () => {
    h.etat.mission = mission({ statut: "retiree", sessionStatut: "annulee" });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-formation-annulee" }),
    );
    expect(h.prisma.documentGenere.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annuleeMotif: MOTIF_FERMETURE.session_annulee }),
      }),
    );
  });

  it("course : la lettre a été signée entre la lecture et l'écriture (count ≠ 1) → rien, aucun e-mail", async () => {
    h.etat.mission = mission({});
    h.prisma.documentGenere.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("lettre signée : le marqueur s'écrit sous condition — déjà posé par un passage concurrent, aucun second Telegram", async () => {
    h.etat.mission = mission({ signee: true });
    h.prisma.missionFormateur.updateMany.mockResolvedValueOnce({ count: 0 });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.telegram).not.toHaveBeenCalled();
  });
});

describe("correctifs du 1er tour de relecture de #1507 — session commencée, chemin d'émission", () => {
  const ECARTE = "00000000-0000-4000-8000-000000000022";
  const LETTRE_ECARTE = "00000000-0000-4000-8000-000000000032";

  it("remplacement en cours de session : la lettre non signée de l'écarté est GARDÉE et le générateur ne l'annule pas", async () => {
    // Le nouveau formateur (TRAINER) a donné son accord : sa lettre est due.
    h.etat.mission = {
      ...mission({ principal: TRAINER, statut: "accord_hors_outil" }),
      accordHorsOutilAt: new Date("2026-11-04T10:00:00Z"),
      lettreMissionId: null,
      lettreMission: null,
    };
    // L'écarté (AUTRE) garde une lettre non signée sur la session déjà commencée.
    const ecarte = {
      ...mission({ principal: TRAINER }),
      id: ECARTE,
      trainerId: AUTRE,
      lettreMissionId: LETTRE_ECARTE,
    };
    h.prisma.missionFormateur.findMany.mockResolvedValueOnce([ecarte] as never);
    h.generer.mockResolvedValueOnce({ ok: false, erreur: "arrêt du test" });
    // Client engagé, aucune condition OPCO en attente : la lettre est due.
    h.prisma.documentGenere.count.mockImplementation((async (a: { where: object }) =>
      "conditionSuspensiveOpco" in a.where ? 0 : 1) as never);
    const pendant = new Date("2026-11-04T12:00:00Z");
    await reevaluerMission(MISSION, "accord_hors_outil", pendant);
    // La lettre de l'écarté n'est pas annulée par le moteur…
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
    // …ni par le générateur : le moteur lui dit de la garder.
    expect(h.generer).toHaveBeenCalledWith(
      expect.objectContaining({ lettresAGarder: [LETTRE_ECARTE] }),
    );
    h.prisma.documentGenere.count.mockImplementation(async () => 1);
  });
});

describe("correctifs du 1er tour de relecture de #1507 — passage", () => {
  it("retirée puis réaffectée à la même personne : jamais relue à chaque passage", async () => {
    const { passerMoteurMissions } = await import("../moteur-mission");
    const reaffectee = { ...mission({ statut: "retiree", principal: TRAINER }) };
    h.prisma.missionFormateur.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([reaffectee] as never);
    const bilan = await passerMoteurMissions(MAINTENANT);
    expect(bilan.reevaluees).toBe(0);
    expect(h.prisma.missionFormateur.findUnique).not.toHaveBeenCalled();
  });
});

describe("réserves du relecteur (#1507)", () => {
  it("mission RETIRÉE puis session REPORTÉE : le retiré n'est pas reconduit, F30 lui est envoyé", async () => {
    h.etat.mission = mission({ statut: "retiree", sessionStatut: "reportee" });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-mission-retiree" }),
    );
  });

  it("retirée puis réaffectée, session annulée : jamais relue à chaque passage", async () => {
    const { passerMoteurMissions } = await import("../moteur-mission");
    const reaffectee = mission({ statut: "retiree", principal: TRAINER, sessionStatut: "annulee" });
    h.prisma.missionFormateur.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([reaffectee] as never);
    expect((await passerMoteurMissions(MAINTENANT)).reevaluees).toBe(0);
  });
});
