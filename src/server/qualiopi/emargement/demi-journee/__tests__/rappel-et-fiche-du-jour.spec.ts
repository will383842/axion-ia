/**
 * QNC L06 — le rappel au début de chaque demi-journée, et la fiche du jour J.
 *
 *   - le rappel part pour la demi-journée qui commence (ou en cours), une fois :
 *     le journal des relances fait foi ;
 *   - un envoi qui échoue n'écrit rien au journal : il se retente ;
 *   - éteint, rien n'est lu ni envoyé ;
 *   - la fiche du jour écrit une ligne nominative par inscrit et par case, sans
 *     doublon.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    trainingSession: { findMany: vi.fn(), findUnique: vi.fn() },
    relanceJournal: { create: vi.fn() },
    enrollment: { findMany: vi.fn() },
    remiseRetour: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));
vi.mock("../../envoi-liens", () => ({ envoyerLiensPourSession: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { envoyerLiensPourSession } from "../../envoi-liens";
import { envoyerRappelsDemiJournee } from "../rappel";
import { cocherFicheJour, objetCase } from "../fiche-jour";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  setting: { findUnique: Fn };
  trainingSession: { findMany: Fn; findUnique: Fn };
  relanceJournal: { create: Fn };
  enrollment: { findMany: Fn };
  remiseRetour: { findMany: Fn; createMany: Fn };
};
const envoyer = envoyerLiensPourSession as unknown as Fn;

const JOUR_DATE = new Date("2026-10-15T00:00:00.000Z");
/** 08:05 Paris : le matin (09:00) commence dans l'heure. */
const PASSAGE_8H05 = new Date("2026-10-15T06:05:00.000Z");

function sessionDuJour(relances: Array<{ objet: string }> = []) {
  db.trainingSession.findUnique.mockResolvedValue({
    numero: "AXI-SESS-TEST",
    jours: [{ date: JOUR_DATE, heureDebut: "09:00", heureFin: "17:00" }],
    enrollments: [
      {
        id: "enr-1",
        presences: [
          { id: "c-m", date: JOUR_DATE, demiJournee: "matin" },
          { id: "c-a", date: JOUR_DATE, demiJournee: "apres_midi" },
        ],
        relancesJournal: relances,
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.setting.findUnique.mockResolvedValue({ value: { etat: "actif" } });
  db.trainingSession.findMany.mockResolvedValue([{ id: "ses-1", estTestInterne: false }]);
  db.relanceJournal.create.mockResolvedValue({});
  envoyer.mockResolvedValue({ ok: true, envoyes: 1, echecs: [] });
  sessionDuJour();
});

describe("envoyerRappelsDemiJournee", () => {
  it("envoie le lien du matin et l'inscrit au journal des relances", async () => {
    const bilan = await envoyerRappelsDemiJournee(PASSAGE_8H05);
    expect(bilan.envoyes).toBe(1);
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "ses-1", enrollmentId: "enr-1", cible: "tous" }),
    );
    expect(db.relanceJournal.create.mock.calls[0]?.[0].data).toMatchObject({
      sessionId: "ses-1",
      enrollmentId: "enr-1",
      objet: "emargement_demi_journee:2026-10-15:matin",
      destinataire: "stagiaire",
      canal: "email",
      rang: 1,
      automatique: true,
    });
  });

  it("une seule fois par demi-journée", async () => {
    sessionDuJour([{ objet: "emargement_demi_journee:2026-10-15:matin" }]);
    const bilan = await envoyerRappelsDemiJournee(PASSAGE_8H05);
    expect(bilan.envoyes).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("un envoi qui échoue n'écrit rien : il se retentera", async () => {
    envoyer.mockResolvedValue({ ok: false, motif: "File indisponible" });
    const bilan = await envoyerRappelsDemiJournee(PASSAGE_8H05);
    expect(bilan.echecs).toHaveLength(1);
    expect(db.relanceJournal.create).not.toHaveBeenCalled();
  });

  it("ÉTEINT (clé absente) : rien n'est lu, rien ne part", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    const bilan = await envoyerRappelsDemiJournee(PASSAGE_8H05);
    expect(bilan).toEqual({ sessions: 0, envoyes: 0, echecs: [] });
    expect(db.trainingSession.findMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("cocherFicheJour", () => {
  it("une ligne par inscrit et par case, sans doublon", async () => {
    db.enrollment.findMany.mockResolvedValue([{ id: "enr-1" }, { id: "enr-2" }]);
    db.remiseRetour.findMany.mockResolvedValue([
      { enrollmentId: "enr-1", objet: objetCase("rappel_cadre", "2026-10-15") },
    ]);
    db.remiseRetour.createMany.mockImplementation(async (a: { data: unknown[] }) => ({
      count: a.data.length,
    }));
    const n = await cocherFicheJour({
      sessionId: "ses-1",
      jour: "2026-10-15",
      cases: ["rappel_cadre", "supports_remis"],
      canalSupports: "papier",
      adminUserId: "adm-1",
    });
    expect(n).toBe(3);
    const lignes = db.remiseRetour.createMany.mock.calls[0]?.[0].data as Array<
      Record<string, unknown>
    >;
    expect(lignes.map((l) => `${String(l["enrollmentId"])}|${String(l["objet"])}`)).toEqual([
      "enr-2|emargement_rappel_cadre:2026-10-15",
      "enr-1|emargement_supports_remis:2026-10-15",
      "enr-2|emargement_supports_remis:2026-10-15",
    ]);
    expect(lignes.every((l) => l["nature"] === "remise" && l["destinataire"] === "stagiaire")).toBe(
      true,
    );
  });
});
