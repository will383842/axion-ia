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
      updateMany: vi.fn(async () => ({ count: 1 })),
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

  it("session annulée : F31, variante sans indemnité ; session reportée : F30", async () => {
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
