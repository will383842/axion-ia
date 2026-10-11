// @vitest-environment node
// Incidents : l'alerte Telegram de déclaration (fail-soft, sans contenu saisi) et
// les rappels du délai CNIL (48 h, 24 h, 6 h, dépassé), une fois chacun.
// Données FICTIVES.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  create: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { incidentDonnees: { create: (...a: unknown[]) => h.create(...a) } },
}));
vi.mock("@/server/journal/journaliser", async (orig) => ({
  ...(await orig<typeof import("@/server/journal/journaliser")>()),
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => h.notify(...a) }));

import { declarerIncident } from "../actions-incidents";
import { ACTION_RAPPEL, palierDu, passerRappelsIncidents } from "../incidents-alertes";

const HEURE = 3600_000;
const DECOUVERT = new Date("2026-10-01T08:00:00Z");
const apres = (n: number) => new Date(DECOUVERT.getTime() + n * HEURE);
const ENVOYE = { ok: true, channels: { telegram: "sent" } };
const ECHEC = { ok: false, channels: { telegram: "failed" } };

function formulaire(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

describe("Alerte à la déclaration", () => {
  beforeEach(() => {
    h.session = { user: { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", role: "admin" } };
    h.create
      .mockReset()
      .mockResolvedValue({ id: "0b1c2d3e-4f50-4a6b-8c7d-8e9fa0b1c2d3", numero: 7 });
    h.notify.mockReset().mockResolvedValue(ENVOYE);
  });

  it("part dans la catégorie des incidents, sans aucun texte saisi", async () => {
    const r = await declarerIncident(
      formulaire({
        decouvertLe: "2026-10-11T10:00",
        description: "Description fictive",
        donneesConcernees: "Données fictives",
        consequences: "Conséquences fictives",
        nombrePersonnes: "12",
      }),
    );
    expect(r).toEqual({ ok: true, numero: 7 });
    expect(h.notify).toHaveBeenCalledTimes(1);
    const appel = h.notify.mock.calls[0]?.[0] as { category: string; payload: object };
    expect(appel.category).toBe("DATA_INCIDENT_ALERT");
    expect(Object.keys(appel.payload).sort()).toEqual(["echeance", "numero", "palier"]);
    expect(appel.payload).toMatchObject({ numero: 7, palier: "declare" });
    const brut = JSON.stringify(appel);
    for (const saisi of ["fictive", "fictives", "Données", "12"]) {
      expect(brut).not.toContain(saisi);
    }
  });

  it("la déclaration réussit même si Telegram échoue", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    h.notify.mockResolvedValue(ECHEC);
    expect(
      await declarerIncident(formulaire({ decouvertLe: "2026-10-11T10:00", description: "x" })),
    ).toEqual({ ok: true, numero: 7 });
    h.notify.mockRejectedValue(new Error("réseau"));
    expect(
      await declarerIncident(formulaire({ decouvertLe: "2026-10-11T10:00", description: "x" })),
    ).toEqual({ ok: true, numero: 7 });
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });
});

describe("Palier de rappel dû", () => {
  const declareTot = { decouvertLe: DECOUVERT, creeLe: apres(1) };

  it("rien avant 48 h restantes, puis 48 h / 24 h / 6 h / dépassé", () => {
    expect(palierDu(declareTot, apres(23))).toBeNull();
    expect(palierDu(declareTot, apres(24))).toBe("48h");
    expect(palierDu(declareTot, apres(47))).toBe("48h");
    expect(palierDu(declareTot, apres(48))).toBe("24h");
    expect(palierDu(declareTot, apres(66))).toBe("6h");
    expect(palierDu(declareTot, apres(72))).toBe("depasse");
    expect(palierDu(declareTot, apres(200))).toBe("depasse");
  });

  it("un palier déjà franchi à la déclaration n'est pas rappelé", () => {
    const declareTard = { decouvertLe: DECOUVERT, creeLe: apres(30) };
    expect(palierDu(declareTard, apres(31))).toBeNull();
    expect(palierDu(declareTard, apres(48))).toBe("24h");
    expect(palierDu({ decouvertLe: DECOUVERT, creeLe: apres(80) }, apres(81))).toBeNull();
  });
});

describe("Passage horaire des rappels", () => {
  type Ligne = {
    id: string;
    numero: number;
    decouvertLe: Date;
    creeLe: Date;
    declareCnil: boolean | null;
    motifNonDeclaration: string | null;
    statut: "ouvert" | "clos";
  };
  let incidents: Ligne[];
  let journal: Array<{ action: string; targetId: string | null }>;

  // Une base en mémoire qui applique le filtre du passage (statut, découverte).
  const client = {
    incidentDonnees: {
      findMany: async (a: { where: { decouvertLe: { lte: Date } } }) =>
        incidents.filter(
          (i) =>
            i.statut === "ouvert" &&
            i.declareCnil !== true &&
            i.decouvertLe.getTime() <= a.where.decouvertLe.lte.getTime(),
        ),
    },
    activityLog: {
      findFirst: async (a: { where: { action: string; targetId: string } }) =>
        journal.find((j) => j.action === a.where.action && j.targetId === a.where.targetId) ?? null,
      create: async (a: { data: { action: string; targetId: string | null } }) => {
        journal.push(a.data);
        return a.data;
      },
    },
  } as unknown as Parameters<typeof passerRappelsIncidents>[1];

  const ID = "0b1c2d3e-4f50-4a6b-8c7d-8e9fa0b1c2d3";
  const passer = (n: number) => passerRappelsIncidents(apres(n), client);
  const paliersEnvoyes = () =>
    h.notify.mock.calls.map((c) => (c[0] as { payload: { palier: string } }).payload.palier);

  beforeEach(() => {
    h.notify.mockReset().mockResolvedValue(ENVOYE);
    journal = [];
    incidents = [
      {
        id: ID,
        numero: 3,
        decouvertLe: DECOUVERT,
        creeLe: apres(1),
        declareCnil: null,
        motifNonDeclaration: null,
        statut: "ouvert",
      },
    ];
  });

  it("chaque palier part une seule fois, quel que soit le nombre de passages", async () => {
    for (let n = 1; n <= 100; n += 1) await passer(n);
    expect(paliersEnvoyes()).toEqual(["48h", "24h", "6h", "depasse"]);
    expect(journal.map((j) => j.action)).toEqual(
      ["48h", "24h", "6h", "depasse"].map((p) => `${ACTION_RAPPEL}.${p}`),
    );
  });

  it("le rappel ne porte que le numéro, le palier et l'échéance", async () => {
    await passer(25);
    const appel = h.notify.mock.calls[0]?.[0] as { category: string; payload: object };
    expect(appel.category).toBe("DATA_INCIDENT_ALERT");
    expect(appel.payload).toEqual({
      numero: 3,
      palier: "48h",
      echeance: apres(72).toISOString(),
    });
  });

  it("s'arrête dès que la décision CNIL est renseignée (oui)", async () => {
    await passer(25);
    incidents[0]!.declareCnil = true;
    for (let n = 26; n <= 100; n += 1) await passer(n);
    expect(paliersEnvoyes()).toEqual(["48h"]);
  });

  it("s'arrête dès que la décision CNIL est renseignée (non, avec son motif)", async () => {
    await passer(25);
    incidents[0]!.declareCnil = false;
    incidents[0]!.motifNonDeclaration = "enc:v1:motif-fictif";
    for (let n = 26; n <= 100; n += 1) await passer(n);
    expect(paliersEnvoyes()).toEqual(["48h"]);
  });

  it("« non » SANS motif n'est pas une décision : les rappels continuent", async () => {
    incidents[0]!.declareCnil = false;
    await passer(50);
    expect(paliersEnvoyes()).toEqual(["24h"]);
  });

  it("s'arrête dès que l'incident est clos", async () => {
    await passer(25);
    incidents[0]!.statut = "clos";
    for (let n = 26; n <= 100; n += 1) await passer(n);
    expect(paliersEnvoyes()).toEqual(["48h"]);
  });

  it("un envoi échoué n'est pas noté : il repart au passage suivant", async () => {
    h.notify.mockResolvedValueOnce(ECHEC);
    const b = await passer(25);
    expect(b).toMatchObject({ envoyes: 0, echecs: 1 });
    expect(journal).toEqual([]);
    await passer(26);
    await passer(27);
    expect(paliersEnvoyes()).toEqual(["48h", "48h"]);
    expect(journal).toHaveLength(1);
  });

  it("après une panne, seul le palier le plus urgent part", async () => {
    await passer(67);
    expect(paliersEnvoyes()).toEqual(["6h"]);
  });
});
