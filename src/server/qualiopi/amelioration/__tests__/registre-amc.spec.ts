/**
 * Chantier QNC, lot L10 — le registre AXI-AMC, sans base :
 *   - le numéro (borne NUMÉRIQUE de l'année + 1, préfixe AXI-AMC) ;
 *   - la vie d'une action : mise en œuvre (responsable ET échéance), réalisée
 *     après mise en œuvre, efficacité après réalisation, motif d'abandon,
 *     close = notes seulement ;
 *   - la lecture pour off.32 (`versActionPlan`) et la règle du prédicat unique
 *     quand le registre est allumé (auteur humain exigé) ;
 *   - les écritures : ligne + trace dans UNE transaction, millésime de Paris.
 */

import { describe, expect, it, vi } from "vitest";
import { formatNumeroAmc, prochainNumeroAmc } from "../numero-amc";
import {
  composerMiseEnOeuvre,
  lireMiseEnOeuvre,
  refusEtape,
  versActionPlan,
  type ActionAmcLue,
  type EtapeLue,
} from "../etapes-amc";
import {
  ajouterEtapeAmelioration,
  ouvrirActionAmelioration,
  RefusAmelioration,
} from "../registre-amc";
import { revueAvecRegistre } from "../off32-registre";
import { evaluerCouvertureOff32 } from "@/server/qualiopi/revues/plan-actions";

const t = (iso: string) => new Date(iso);
const etape = (
  e: EtapeLue["etape"],
  commentaire = "",
  creeLe = "2026-10-02T10:00:00Z",
): EtapeLue => ({
  etape: e,
  commentaire,
  auteurId: "will",
  creeLe: t(creeLe),
});

describe("le numéro AXI-AMC", () => {
  it("borne numérique + 1, jamais lexicographique", async () => {
    const tx = {
      actionAmelioration: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { numero: "AXI-AMC-2026-999" },
            { numero: "AXI-AMC-2026-1000" },
            { numero: "AXI-AMC-2026-DEMO-1" },
          ]),
      },
    };
    expect(await prochainNumeroAmc(tx, 2026)).toBe("AXI-AMC-2026-1001");
    expect(tx.actionAmelioration.findMany).toHaveBeenCalledWith({
      where: { numero: { startsWith: "AXI-AMC-2026-" } },
      select: { numero: true },
    });
    expect(formatNumeroAmc(2027, 1)).toBe("AXI-AMC-2027-001");
  });
});

describe("la vie d'une action", () => {
  it("la mise en œuvre exige un responsable ET une échéance valide", () => {
    expect(refusEtape([], { etape: "mise_en_oeuvre", commentaire: "" })).toMatch(/responsable/);
    expect(
      refusEtape([], {
        etape: "mise_en_oeuvre",
        commentaire: "",
        responsable: "Will",
        echeance: "2026-02-30",
      }),
    ).toMatch(/échéance/);
    expect(
      refusEtape([], {
        etape: "mise_en_oeuvre",
        commentaire: "",
        responsable: "Will",
        echeance: "2026-12-01",
      }),
    ).toBeNull();
  });

  it("réalisée seulement après une mise en œuvre ; efficacité seulement après réalisation", () => {
    expect(refusEtape([], { etape: "realisee", commentaire: "Programme v4 publié" })).toMatch(
      /d'abord être mise en œuvre/,
    );
    const meo = [
      etape(
        "mise_en_oeuvre",
        composerMiseEnOeuvre({ responsable: "Will", echeance: "2026-12-01" }),
      ),
    ];
    expect(
      refusEtape(meo, { etape: "efficacite_verifiee", commentaire: "Questionnaires à froid" }),
    ).toMatch(/d'abord être réalisée/);
    expect(refusEtape(meo, { etape: "realisee", commentaire: "Programme v4 publié" })).toBeNull();
  });

  it("l'abandon exige son motif ; une action close ne reçoit plus que des notes", () => {
    expect(refusEtape([], { etape: "abandonnee", commentaire: "non" })).toMatch(
      /motif est obligatoire/,
    );
    const close = [etape("abandonnee", "Sans objet : formation retirée du catalogue")];
    expect(
      refusEtape(close, {
        etape: "mise_en_oeuvre",
        commentaire: "",
        responsable: "W",
        echeance: "2026-12-01",
      }),
    ).toMatch(/close/);
    expect(refusEtape(close, { etape: "note", commentaire: "Archivé au dossier" })).toBeNull();
  });

  it("le commentaire de mise en œuvre se relit exactement", () => {
    const c = composerMiseEnOeuvre({
      responsable: "  Will   Jullin ",
      echeance: "2026-12-01",
      commentaire: "Revoir le livret",
    });
    expect(c).toBe("Responsable : Will Jullin · Échéance : 2026-12-01 — Revoir le livret");
    expect(lireMiseEnOeuvre(c)).toEqual({
      responsable: "Will Jullin",
      echeance: "2026-12-01",
      commentaire: "Revoir le livret",
    });
    expect(lireMiseEnOeuvre("texte libre")).toBeNull();
  });
});

const ACTION: ActionAmcLue = {
  id: "a1",
  numero: "AXI-AMC-2026-001",
  origine: "veille",
  constat: "Décret 2026-728",
  action: "Mettre à jour la procédure P04",
  auteurId: "will",
  auteurNom: "Will",
  creeLe: t("2026-10-01T08:00:00Z"),
  etapes: [],
};

describe("off.32 lit le registre quand il est allumé", () => {
  it("une action ouverte sans mise en œuvre est une intention : rouge", () => {
    const revue = {
      annee: 2026,
      participants: ["Will"],
      decisions: ["Suivre le décret"],
      planActions: [],
    };
    const lu = revueAvecRegistre(revue, [ACTION]);
    const v = evaluerCouvertureOff32(lu.revue, t("2026-10-17T10:00:00Z"), {
      exigeAnalyseRisques: false,
      registreAmc: lu.registreAmc,
    });
    expect(v.couvert).toBe(false);
    expect(v.manques.join(" ")).toMatch(/sans responsable/);
  });

  it("mise en œuvre puis réalisée : vert, l'efficacité restant à vérifier est signalée", () => {
    const action: ActionAmcLue = {
      ...ACTION,
      etapes: [
        etape(
          "mise_en_oeuvre",
          composerMiseEnOeuvre({ responsable: "Will", echeance: "2026-12-01" }),
          "2026-10-02T08:00:00Z",
        ),
        etape("realisee", "Procédure P04 v3 publiée", "2026-10-16T23:30:00Z"),
      ],
    };
    expect(versActionPlan(action)).toMatchObject({
      statut: "faite",
      responsable: "Will",
      echeance: "2026-12-01",
      clotureAt: "2026-10-17",
    });
    const lu = revueAvecRegistre(
      { annee: 2026, participants: ["Will"], decisions: ["D"], planActions: ["Ancienne action"] },
      [action],
    );
    // L'historique est RELU (normalisé), jamais réécrit : l'ancienne entrée sans responsable rougit encore.
    const v = evaluerCouvertureOff32(lu.revue, t("2026-10-17T10:00:00Z"), {
      exigeAnalyseRisques: false,
      registreAmc: lu.registreAmc,
    });
    expect(v.resume.total).toBe(2);
    expect(v.preuves.join(" ")).toMatch(/efficacité reste à vérifier/);
  });

  it("une action sans auteur humain bloque le vert", () => {
    const action: ActionAmcLue = {
      ...ACTION,
      auteurId: null,
      etapes: [
        etape(
          "mise_en_oeuvre",
          composerMiseEnOeuvre({ responsable: "Will", echeance: "2026-12-01" }),
        ),
      ],
    };
    const lu = revueAvecRegistre(
      { annee: 2026, participants: ["Will"], decisions: ["D"], planActions: [] },
      [action],
    );
    const v = evaluerCouvertureOff32(lu.revue, t("2026-10-17T10:00:00Z"), {
      exigeAnalyseRisques: false,
      registreAmc: lu.registreAmc,
    });
    expect(v.couvert).toBe(false);
    expect(v.manques.join(" ")).toMatch(/sans auteur humain/);
  });
});

// ─── Écritures ──────────────────────────────────────────────────────────────

const A1 = "00000000-0000-4000-8000-0000000000a1";

function fauxClient(etapes: EtapeLue[] = []) {
  const ecrits: Array<{ table: string; data: Record<string, unknown> }> = [];
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    actionAmelioration: {
      findMany: vi.fn().mockResolvedValue([{ numero: "AXI-AMC-2027-004" }]),
      findUnique: vi.fn().mockResolvedValue({ id: A1, numero: "AXI-AMC-2027-004", etapes }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ecrits.push({ table: "actions_amelioration", data });
        return { id: A1, numero: data["numero"] };
      }),
    },
    actionAmeliorationEtape: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ecrits.push({ table: "actions_amelioration_etapes", data });
        return { id: "00000000-0000-4000-8000-0000000000e1" };
      }),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ecrits.push({ table: "activity_logs", data });
        return {};
      }),
    },
  };
  const db = { $transaction: vi.fn(async (fn: (x: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { db: db as never, tx, ecrits };
}

describe("les écritures du registre", () => {
  it("ouvrir : numéro du millésime de PARIS, ligne et trace dans la même transaction", async () => {
    const c = fauxClient();
    const r = await ouvrirActionAmelioration(
      c.db,
      {
        origine: "veille",
        constat: "Décret 2026-728",
        action: "Mettre à jour P04",
        auteurId: "will",
        auteurNom: "Will",
      },
      { maintenant: t("2026-12-31T23:30:00Z") }, // déjà le 1er janvier 2027 à Paris
    );
    expect(r.numero).toBe("AXI-AMC-2027-005");
    expect(c.ecrits.map((e) => e.table)).toEqual(["actions_amelioration", "activity_logs"]);
    expect(c.ecrits[0]?.data).not.toHaveProperty("creeLe"); // date du serveur de base
  });

  it("une étape refusée n'écrit rien, une étape reçue écrit la ligne et sa trace", async () => {
    const c = fauxClient();
    await expect(
      ajouterEtapeAmelioration(c.db, {
        actionId: A1,
        etape: "abandonnee",
        commentaire: "non",
        auteurId: "w",
        auteurNom: "W",
      }),
    ).rejects.toBeInstanceOf(RefusAmelioration);
    expect(c.ecrits).toEqual([]);
    await ajouterEtapeAmelioration(c.db, {
      actionId: A1,
      etape: "mise_en_oeuvre",
      commentaire: "",
      responsable: "Will",
      echeance: "2027-03-01",
      auteurId: "will",
      auteurNom: "Will",
    });
    expect(c.ecrits.map((e) => e.table)).toEqual(["actions_amelioration_etapes", "activity_logs"]);
    expect(c.ecrits[0]?.data["commentaire"]).toBe("Responsable : Will · Échéance : 2027-03-01");
  });
});
