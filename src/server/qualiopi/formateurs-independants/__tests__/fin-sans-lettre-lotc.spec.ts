/**
 * Lot C (M11, hors argent) — une mission ACCEPTÉE qui n'a jamais reçu de lettre, puis
 * retirée ou dont la session est annulée, reçoit son e-mail (F30 / F31, variante « sans
 * lettre » : aucune lettre à annuler, aucune indemnité annoncée). Une seule fois.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const MISSION = "00000000-0000-4000-8000-000000000021";
const TRAINER = "00000000-0000-4000-8000-000000000011";
const AUTRE = "00000000-0000-4000-8000-000000000012";

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
import { MOTIF_FERMEE_SANS_LETTRE, reevaluerMission } from "../moteur-mission";

const MAINTENANT = new Date("2026-10-12T09:00:00Z");

function mission(o: {
  reponduAt?: Date | null;
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
    lettreMissionId: null,
    reponduAt: o.reponduAt === undefined ? new Date("2026-10-01T08:00:00Z") : o.reponduAt,
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
    lettreMission: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.allume = true;
  h.etat.annulees = 0;
});

describe("fin de mission SANS lettre (M11)", () => {
  it("formateur remplacé : F30 variante « sans lettre », marqueur posé, aucune lettre touchée, alerte sans nom", async () => {
    h.etat.mission = mission({});
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("mission_fermee");
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-mission-retiree",
        jobId: `formateur-mission-retiree-${MISSION}`,
        payload: expect.objectContaining({ etape: 3 }),
      }),
    );
    expect(h.etat.mission!.lettreBlocageMotif).toBe(MOTIF_FERMEE_SANS_LETTRE);
    expect(h.prisma.documentGenere.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|IA pour managers|€/);
  });

  it("session annulée : F31 ; session reportée : aucun e-mail, marqueur posé", async () => {
    h.etat.mission = mission({ sessionStatut: "annulee", principal: TRAINER });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-formation-annulee" }),
    );
    h.envoyer.mockClear();
    h.etat.mission = mission({ sessionStatut: "reportee", principal: TRAINER });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.etat.mission!.lettreBlocageMotif).toBe(MOTIF_FERMEE_SANS_LETTRE);
  });

  it("mission RETIRÉE après un accord : F30 ; retirée sans jamais avoir répondu : rien", async () => {
    h.etat.mission = mission({ statut: "retiree" });
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    h.envoyer.mockClear();
    h.etat.mission = mission({ statut: "retiree", reponduAt: null });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("une seule fois : le marqueur déjà posé (ou perdu à la course) n'envoie rien", async () => {
    h.etat.mission = mission({});
    h.prisma.missionFormateur.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("session déjà commencée : pas d'e-mail, Will décide", async () => {
    h.etat.mission = mission({});
    const debut = h.etat.mission.session as { dateDebut: Date };
    debut.dateDebut = new Date("2026-10-10T08:00:00Z");
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalled();
  });

  it("interrupteurs coupés : rien n'est lu", async () => {
    h.etat.allume = false;
    h.etat.mission = mission({});
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("coupe");
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("les variantes « sans lettre » n'annoncent aucune indemnité et n'emploient aucun mot interdit", () => {
    const interdits =
      /poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble|expert-comptable/i;
    for (const g of ["formateur-mission-retiree", "formateur-formation-annulee"] as const) {
      const v = TEXTES_FORMATEUR[g].variantes[2]!;
      expect(v.etape).toBe("sans lettre");
      const texte = [v.objet, ...v.paragraphes].join(" ");
      expect(texte).not.toMatch(/honoraires|indemnit|réglée|annulée\.$/i);
      expect(texte).not.toMatch(interdits);
      expect(texte).not.toMatch(/n'aviez pas encore signée/);
    }
  });
});
