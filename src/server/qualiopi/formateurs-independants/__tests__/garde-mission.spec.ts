/**
 * Lot L3 — garde de mission : le verdict (pur), le mode, la lecture des
 * interrupteurs, et l'inventaire des portes (T4).
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    trainer: null as Record<string, unknown> | null,
    contrat: null as Record<string, unknown> | null,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    trainer: { findUnique: vi.fn(async () => etat.trainer) },
    documentGenere: { findFirst: vi.fn(async () => etat.contrat) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import {
  MANQUES_MISSION,
  appliquerGarde,
  modeGardeMission,
  peutRecevoirMission,
  type FaitsGardeMission,
} from "../garde-mission";
import { controlerGardeMission } from "../garde-mission-portes";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");

const vigilance = (dateEmission: Date) => ({
  type: "attestation_vigilance_urssaf",
  statutValidation: "valide",
  fichierUrl: "r2://x",
  dateEmission,
  dateExpiration: null,
});

const faits = (over: Partial<FaitsGardeMission> = {}): FaitsGardeMission => ({
  statut: "sous_traitant",
  actif: true,
  finCollaborationAt: null,
  activationValideeSource: "controle",
  sousTraitantVerifieAt: new Date("2026-10-01T10:00:00Z"),
  sousTraitantNda: "84380000000",
  sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
  contratCadreVersion: 3,
  pieces: [vigilance(new Date("2026-09-01T00:00:00Z"))] as never,
  ...over,
});

describe("peutRecevoirMission (pur)", () => {
  it("tout en ordre : oui ; un salarié : toujours oui", () => {
    expect(peutRecevoirMission(faits(), 3, MAINTENANT)).toEqual({ ok: true });
    expect(peutRecevoirMission(faits({ statut: "salarie", actif: false }), 3, MAINTENANT)).toEqual({
      ok: true,
    });
  });

  it.each([
    ["fiche inactive", { actif: false }, MANQUES_MISSION.inactif],
    ["collaboration finie", { finCollaborationAt: new Date() }, MANQUES_MISSION.finCollaboration],
    ["contrat d'une version antérieure", { contratCadreVersion: 2 }, MANQUES_MISSION.contrat],
    ["contrat jamais signé", { sousTraitantContratSigneAt: null }, MANQUES_MISSION.contrat],
    [
      "registre relu il y a plus d'un mois",
      { sousTraitantVerifieAt: new Date("2026-09-01T10:00:00Z") },
      MANQUES_MISSION.registre,
    ],
    ["numéro absent", { sousTraitantNda: " " }, MANQUES_MISSION.nda],
    [
      "attestation échue aujourd'hui",
      { pieces: [vigilance(new Date("2026-03-01T00:00:00Z"))] as never },
      MANQUES_MISSION.vigilance,
    ],
  ])("refuse : %s", (_q, over, manque) => {
    const v = peutRecevoirMission(faits(over as Partial<FaitsGardeMission>), 3, MAINTENANT);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.manques).toContain(manque);
  });
});

describe("le mode", () => {
  it("portes coupées : « coupee », quel que soit le niveau", () => {
    expect(modeGardeMission(false, "refuser", "controle")).toBe("coupee");
    expect(appliquerGarde("coupee", { ok: false, manques: ["x"] })).toEqual({
      refus: [],
      avertissements: [],
    });
  });
  it("« avertir » ne vaut que pour l'ancien stock ; un nouveau formateur est refusé", () => {
    expect(modeGardeMission(true, "avertir", "anterieure_au_controle")).toBe("avertir");
    expect(modeGardeMission(true, "avertir", "controle")).toBe("refuser");
    expect(modeGardeMission(true, "avertir", null)).toBe("refuser");
  });
});

describe("controlerGardeMission (lecture des interrupteurs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.etat.settings.clear();
    h.etat.contrat = {
      metadata: { renderData: { gabaritVersion: 2 } },
      signatures: [{ signeAt: new Date("2026-09-01T10:00:00Z") }],
    };
    h.etat.trainer = {
      ...faits(),
      documents: [vigilance(new Date("2026-03-01T00:00:00Z"))],
    };
  });

  it("ligne absente : coupée, et RIEN n'est lu du formateur (comportement d'avant)", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r).toEqual({ mode: "coupee", refus: [], avertissements: [] });
    expect(h.prisma.trainer.findUnique).not.toHaveBeenCalled();
  });

  it("allumée, niveau absent : refuser", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.mode).toBe("refuser");
    expect(r.refus).toContain(MANQUES_MISSION.vigilance);
  });

  it("allumée, `Setting` illisible : refuser", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    h.etat.settings.set("formateurs.garde_mission", { valeur: "n'importe" });
    expect((await controlerGardeMission("t-1", MAINTENANT)).mode).toBe("refuser");
  });

  it("nouveau formateur en « avertir » avec attestation échue : refus", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toContain(MANQUES_MISSION.vigilance);
  });

  it("ancien stock en « avertir » : averti, jamais bloqué", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    h.etat.trainer = { ...h.etat.trainer!, activationValideeSource: "anterieure_au_controle" };
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r).toMatchObject({ mode: "avertir", refus: [] });
    expect(r.avertissements).toContain(MANQUES_MISSION.vigilance);
  });

  it("lecture de l'interrupteur lui-même en échec : refus, jamais « coupée »", async () => {
    h.prisma.setting.findUnique.mockRejectedValueOnce(new Error("panne"));
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toEqual([MANQUES_MISSION.erreur]);
  });

  it("allumée, lecture en échec : refus (garde fermée)", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    h.prisma.trainer.findUnique.mockRejectedValueOnce(new Error("panne"));
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toEqual([MANQUES_MISSION.erreur]);
  });
});

describe("T4 — tout écrivain d'affectation passe par la garde", () => {
  const RACINE = process.cwd();
  const PORTES = [
    "src/server/actions/qualiopi/trainers.ts",
    "src/server/actions/qualiopi/sessions.ts",
    "src/server/actions/qualiopi/sessions-recurrentes.ts",
    // Lot L11h — le moteur du rang suivant affecte le choix suivant (évaluation
    // complète, garde relue avant l'écriture, dossier ouvert, place conditionnelle).
    "src/server/qualiopi/formateurs-independants/choix-formateur-service.ts",
  ];
  const ECRITURE = /\bsessionFormateur\.(create|createMany|upsert)\s*\(/;

  it("les portes écrivent une affectation et appellent la garde", () => {
    for (const f of PORTES) {
      const src = readFileSync(join(RACINE, f), "utf8");
      expect(src, f).toMatch(ECRITURE);
      expect(src, f).toContain("controlerGardeMission(");
    }
  });

  it("aucun autre fichier n'écrit une affectation", () => {
    const trouves = execSync(
      String.raw`git grep -lE "sessionFormateur\.(create|createMany|upsert)\s*\(" -- src`,
      { cwd: RACINE, encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l !== "" && !/\.(spec|test)\.|__tests__/.test(l));
    expect(trouves.sort()).toEqual([...PORTES].sort());
  });

  it("toute écriture d'un formateur principal se fait dans une porte gardée", () => {
    // Les LECTURES (`where`, `OR: [...]`) sont écartées : seule une écriture compte.
    const ecrivains = execSync(
      String.raw`git grep -nE "formateurPrincipalId: (trainerId|v\.trainerId|formateurRetenuId)\b" -- src`,
      { cwd: RACINE, encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l !== "" && !/OR:|where|\.(spec|test)\.|__tests__/.test(l))
      .map((l) => l.split(":")[0]!);
    for (const f of ecrivains) expect(PORTES, f).toContain(f);
  });

  it("proposition, acceptation, renvoi et accord hors outil relisent la garde", () => {
    const service = readFileSync(
      join(RACINE, "src/server/qualiopi/trainers/mission-formateur.ts"),
      "utf8",
    );
    expect(service.match(/controlerGardeMission\(/g)?.length).toBeGreaterThanOrEqual(3);
    const action = readFileSync(
      join(RACINE, "src/server/actions/qualiopi/mission-formateur.ts"),
      "utf8",
    );
    expect(action).toContain("controlerGardeMission(");
  });
});
