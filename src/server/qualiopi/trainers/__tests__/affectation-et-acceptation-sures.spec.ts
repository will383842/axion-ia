/**
 * Lot S2 — affectation et acceptation sûres (plan formateurs, 08 §8 S2 ; T6, N1,
 * N2, N3, R4, S-UX-6).
 *
 * Tout est livré ÉTEINT derrière l'interrupteur `formateurs.affectation_sure` :
 * chaque cas est joué DEUX fois — ligne absente (le comportement d'avant S2,
 * à l'identique) et interrupteur allumé (le correctif).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    allume: false,
    mission: null as Record<string, unknown> | null,
    affectation: null as { id: string } | null,
    /** Simule un retrait passé entre la lecture et l'écriture. */
    retraitConcurrent: false,
  };
  const missionFormateur = {
    findUnique: vi.fn(async () => etat.mission),
    findFirst: vi.fn(async () => etat.mission),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: etat.retraitConcurrent ? 0 : 1 })),
    count: vi.fn(async () => 0),
  };
  const sessionFormateur = {
    findUnique: vi.fn(async () => etat.affectation),
    deleteMany: vi.fn(async () => ({ count: 1 })),
    count: vi.fn(async () => 0),
  };
  const trainingSession = { update: vi.fn(async () => ({})) };
  const setting = {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
      etat.allume && where.key === "formateurs.affectation_sure"
        ? { value: { actif: true } }
        : null,
    ),
  };
  const tx = { missionFormateur, sessionFormateur, trainingSession };
  const prisma = {
    missionFormateur,
    sessionFormateur,
    trainingSession,
    setting,
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { etat, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/affectation-retiree", () => ({
  lireAffectationsAvantRetrait: vi.fn(async () => []),
  archiverAffectationsRetirees: vi.fn(async () => undefined),
}));

import {
  INTERRUPTEURS_SIGNATURE,
  etatsSignatureParDefaut,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  PROPOSITION_CHANGEE,
  PROPOSITION_SUSPENDUE,
  STATUTS_ACCORD_DONNE,
  consignerAccordHorsOutil,
  missionsVisiblesIndependant,
  repondreMission,
  retirerMissionsOuvertes,
  statutsAccordConvocation,
  statutsMissionOuverte,
} from "@/server/qualiopi/trainers/mission-formateur";

const MISSION_ID = "e1e1e1e1-0000-4000-8000-000000000001";
const SESSION_ID = "a5a5a5a5-0000-4000-8000-00000000000a";
const TRAINER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-10-11T08:00:00Z");

function mission(trainer: { actif: boolean; statut: string }, statut = "en_attente") {
  return {
    id: MISSION_ID,
    trainerId: TRAINER_ID,
    sessionId: SESSION_ID,
    statut,
    echeanceReponseAt: null,
    session: {
      dateDebut: new Date("2026-11-04T08:00:00Z"),
      statut: "planifiee",
      formateurPrincipalId: TRAINER_ID,
    },
    trainer,
  };
}

/** Le premier argument du premier appel d'une doublure. */
function premierArg(fn: { mock: { calls: unknown[][] } }): unknown {
  return fn.mock.calls[0]?.[0];
}

const RACINE = process.cwd();
const lire = (p: string): string => readFileSync(join(RACINE, p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.allume = false;
  h.etat.mission = null;
  h.etat.affectation = null;
  h.etat.retraitConcurrent = false;
});

describe("l'interrupteur `formateurs.affectation_sure`", () => {
  it("existe, livré arrêté", () => {
    expect(INTERRUPTEURS_SIGNATURE.affectation_sure.cle).toBe("formateurs.affectation_sure");
    expect(etatsSignatureParDefaut().affectation_sure).toBe(false);
  });
});

describe("T6 — « J'accepte » recontrôle et écrit sous condition", () => {
  it("arrêté : une fiche inactive accepte encore, comme avant S2", async () => {
    h.etat.mission = mission({ actif: false, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "acceptee", now: NOW });
    expect(r.ok).toBe(true);
    expect(h.prisma.missionFormateur.update).toHaveBeenCalledTimes(1);
    expect(h.prisma.missionFormateur.updateMany).not.toHaveBeenCalled();
  });

  it("allumé : une fiche inactive reçoit une réponse neutre, rien n'est écrit", async () => {
    h.etat.allume = true;
    h.etat.mission = mission({ actif: false, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "acceptee", now: NOW });
    expect(r).toEqual({ ok: false, erreur: PROPOSITION_SUSPENDUE });
    expect(h.prisma.missionFormateur.update).not.toHaveBeenCalled();
    expect(h.prisma.missionFormateur.updateMany).not.toHaveBeenCalled();
  });

  it("allumé : une acceptation concurrente d'un retrait ne l'écrase pas", async () => {
    h.etat.allume = true;
    h.etat.retraitConcurrent = true;
    h.etat.mission = mission({ actif: true, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "acceptee", now: NOW });
    expect(r).toEqual({ ok: false, erreur: PROPOSITION_CHANGEE });
    const arg = premierArg(h.prisma.missionFormateur.updateMany) as unknown as {
      where: { id: string; statut: string };
    };
    expect(arg.where).toEqual({ id: MISSION_ID, statut: "en_attente" });
    expect(h.prisma.missionFormateur.update).not.toHaveBeenCalled();
  });

  it("allumé : un refus concurrent d'un retrait n'efface pas l'affectation", async () => {
    h.etat.allume = true;
    h.etat.retraitConcurrent = true;
    h.etat.mission = mission({ actif: true, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "refusee", now: NOW });
    expect(r).toEqual({ ok: false, erreur: PROPOSITION_CHANGEE });
    expect(h.prisma.sessionFormateur.deleteMany).not.toHaveBeenCalled();
  });
});

describe("S-UX-6 — refus d'un indépendant sans motif exigé", () => {
  it("arrêté : l'indépendant doit encore motiver, comme avant S2", async () => {
    h.etat.mission = mission({ actif: true, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "refusee", now: NOW });
    expect(r.ok).toBe(false);
  });

  it("allumé : indépendant, refus sans motif accepté", async () => {
    h.etat.allume = true;
    h.etat.mission = mission({ actif: true, statut: "sous_traitant" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "refusee", now: NOW });
    expect(r).toMatchObject({ ok: true, statut: "refusee" });
    const arg = premierArg(h.prisma.missionFormateur.updateMany) as unknown as {
      data: { motifRefus: string | null };
    };
    expect(arg.data.motifRefus).toBeNull();
  });

  it("allumé : un choix court suffit (« Trop loin »)", async () => {
    h.etat.allume = true;
    h.etat.mission = mission({ actif: true, statut: "sous_traitant" });
    const r = await repondreMission({
      missionId: MISSION_ID,
      reponse: "refusee",
      motif: "Trop loin",
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("allumé : un salarié doit encore motiver (inchangé)", async () => {
    h.etat.allume = true;
    h.etat.mission = mission({ actif: true, statut: "salarie" });
    const r = await repondreMission({ missionId: MISSION_ID, reponse: "refusee", now: NOW });
    expect(r.ok).toBe(false);
  });
});

describe("N3 / T7 — accord hors outil après un « sans réponse »", () => {
  const entree = {
    sessionId: SESSION_ID,
    trainerId: TRAINER_ID,
    motif: "Accord donné par téléphone le 10/10.",
    parAdminId: "adadadad-0000-4000-8000-000000000001",
  };

  it("arrêté : l'accord se pose encore sans affectation, comme avant S2", async () => {
    h.etat.mission = { id: MISSION_ID, statut: "sans_reponse" };
    const r = await consignerAccordHorsOutil(entree);
    expect(r.ok).toBe(true);
  });

  it("allumé : sans affectation, l'accord est refusé et rien n'est écrit", async () => {
    h.etat.allume = true;
    h.etat.mission = { id: MISSION_ID, statut: "sans_reponse" };
    h.etat.affectation = null;
    const r = await consignerAccordHorsOutil(entree);
    expect(r.ok).toBe(false);
    expect(h.prisma.missionFormateur.update).not.toHaveBeenCalled();
    expect(h.prisma.missionFormateur.updateMany).not.toHaveBeenCalled();
  });

  it("allumé : formateur affecté, l'accord est noté sous condition", async () => {
    h.etat.allume = true;
    h.etat.mission = { id: MISSION_ID, statut: "en_attente" };
    h.etat.affectation = { id: "sf-1" };
    const r = await consignerAccordHorsOutil(entree);
    expect(r).toEqual({ ok: true, missionId: MISSION_ID });
    const arg = premierArg(h.prisma.missionFormateur.updateMany) as unknown as {
      where: { id: string; statut: string };
    };
    expect(arg.where).toEqual({ id: MISSION_ID, statut: "en_attente" });
  });
});

describe("N1 / N2 — l'accord donné couvre l'accord hors outil", () => {
  it("convocation J-7 et rappel J-1 : `acceptee` et `accord_hors_outil` convoqués, `en_attente` jamais", () => {
    expect([...statutsAccordConvocation(true)].sort()).toEqual(["acceptee", "accord_hors_outil"]);
    expect(statutsAccordConvocation(true)).not.toContain("en_attente");
    // Arrêté : l'accord par le lien seul, comme avant S2.
    expect([...statutsAccordConvocation(false)]).toEqual(["acceptee"]);
  });

  it("le worker lit la liste par l'interrupteur, jamais un `acceptee` en dur", () => {
    const worker = lire("src/server/queue/workers/qualiopi-formation-crons-worker.ts");
    expect(worker).toContain(
      'statutsAccordConvocation(await interrupteurAllume("affectation_sure"))',
    );
    expect(worker).not.toMatch(/statut:\s*"acceptee"/);
  });

  it("au remplacement, l'accord hors outil de l'écarté est retiré (allumé seulement)", async () => {
    expect([...statutsMissionOuverte(false)]).toEqual(["en_attente", "acceptee"]);
    expect([...statutsMissionOuverte(true)].sort()).toEqual(
      ["accord_hors_outil", "acceptee", "en_attente"].sort(),
    );
    h.etat.allume = true;
    await retirerMissionsOuvertes(SESSION_ID, { saufTrainerId: TRAINER_ID });
    const arg = premierArg(h.prisma.missionFormateur.updateMany) as unknown as {
      where: { statut: { in: string[] } };
    };
    expect(arg.where.statut.in).toContain("accord_hors_outil");
  });

  it('T6 statique : aucune comparaison littérale à `"acceptee"` dans le serveur hors du module', () => {
    const fichiers = [
      "src/server/queue/workers/qualiopi-formation-crons-worker.ts",
      "src/server/qualiopi/alertes/evaluateur.ts",
      "src/server/actions/qualiopi/mission-formateur.ts",
      "src/server/actions/qualiopi/trainers.ts",
      "src/server/actions/qualiopi/sessions.ts",
      "src/server/actions/qualiopi/sessions-recurrentes.ts",
    ];
    for (const f of fichiers) {
      const code = lire(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
        // Les trois règles d'alerte portent déjà la paire complète : c'est la
        // même liste que `STATUTS_ACCORD_DONNE`, verrouillée par son propre test.
        .replace(/\["acceptee",\s*"accord_hors_outil"\]/g, "");
      expect(code, f).not.toContain('"acceptee"');
    }
    expect([...STATUTS_ACCORD_DONNE]).toEqual(["acceptee", "accord_hors_outil"]);
  });
});

describe("N5 / T7 — double emploi et co-formateurs dans les trois portes", () => {
  it("création, fiche et report passent par le même constat de double emploi", () => {
    for (const f of [
      "src/server/actions/qualiopi/trainers.ts",
      "src/server/actions/qualiopi/sessions.ts",
      "src/server/actions/qualiopi/sessions-recurrentes.ts",
    ]) {
      expect(lire(f), f).toContain("constaterDoubleEmploi(");
    }
  });

  it("le renvoi de proposition recontrôle et garde le vrai rôle", () => {
    const action = lire("src/server/actions/qualiopi/mission-formateur.ts");
    const depart = action.indexOf("export async function renvoyerPropositionMissionAction");
    const corps = action.slice(depart, action.indexOf("\n}\n", depart));
    expect(corps).toContain("refusRenvoi(");
    expect(corps).toContain("role = affecte.role");
  });
});

describe("R4 — refus et silences jamais comptés pour un indépendant", () => {
  it("ne lit que l'accord donné et les sessions réalisées", async () => {
    await missionsVisiblesIndependant(TRAINER_ID, NOW);
    const arg = premierArg(h.prisma.missionFormateur.count) as unknown as {
      where: { statut: { in: string[] } };
    };
    expect([...arg.where.statut.in].sort()).toEqual(["acceptee", "accord_hors_outil"]);
    for (const interdit of ["refusee", "sans_reponse", "desistee", "expiree"]) {
      expect(JSON.stringify(arg)).not.toContain(interdit);
    }
  });
});
