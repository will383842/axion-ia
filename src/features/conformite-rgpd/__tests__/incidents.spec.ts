// @vitest-environment node
// Incidents : compte à rebours de 72 h (seuils), textes CHIFFRÉS en base, gestes
// réservés aux administrateurs. Données FICTIVES.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  create: vi.fn(),
  journal: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    incidentDonnees: {
      create: (...a: unknown[]) => h.create(...a),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => h.journal(...a),
}));

import { cloreIncident, declarerIncident } from "../actions-incidents";
import {
  CHAMPS_CHIFFRES,
  decisionCnilPrise,
  lireFormulaireIncident,
  pastilleCnil,
} from "../incidents";
import { creerIncident, lireIncident } from "../incidents-base";

const HEURE = 3600_000;
const DECOUVERT = new Date("2000-01-01T00:00:00Z");
const apres = (h: number) => new Date(DECOUVERT.getTime() + h * HEURE);
const sansDecision = { decouvertLe: DECOUVERT, declareCnil: null, motifNonDeclaration: null };

describe("Compte à rebours CNIL (72 h depuis la découverte)", () => {
  it("neutre au départ, avec les heures restantes", () => {
    expect(pastilleCnil(sansDecision, apres(1))).toEqual({
      libelle: "71 h pour prévenir la CNIL",
      ton: "neutral",
      enCours: true,
    });
  });

  it("encore neutre à 24 h pile restantes, orange en dessous", () => {
    expect(pastilleCnil(sansDecision, apres(48)).ton).toBe("neutral");
    expect(pastilleCnil(sansDecision, apres(48.5))).toMatchObject({ ton: "warning" });
    expect(pastilleCnil(sansDecision, apres(71.9))).toMatchObject({
      libelle: "1 h pour prévenir la CNIL",
      ton: "warning",
    });
  });

  it("rouge à 72 h et au-delà", () => {
    expect(pastilleCnil(sansDecision, apres(72))).toMatchObject({ ton: "destructive" });
    expect(pastilleCnil(sansDecision, apres(75.5))).toMatchObject({
      libelle: "Délai CNIL dépassé de 3 h",
      ton: "destructive",
    });
  });

  it("s'arrête quand la CNIL est prévenue, ou « non » AVEC un motif", () => {
    expect(pastilleCnil({ ...sansDecision, declareCnil: true }, apres(100))).toMatchObject({
      ton: "success",
      enCours: false,
    });
    expect(
      pastilleCnil(
        { ...sansDecision, declareCnil: false, motifNonDeclaration: "Motif fictif" },
        apres(100),
      ),
    ).toMatchObject({ ton: "neutral", enCours: false });
  });

  it("« non » SANS motif ne compte pas comme une décision : le délai court", () => {
    const i = { ...sansDecision, declareCnil: false, motifNonDeclaration: "  " };
    expect(decisionCnilPrise(i)).toBe(false);
    expect(pastilleCnil(i, apres(80)).ton).toBe("destructive");
  });
});

function formulaire(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

describe("Formulaire d'incident", () => {
  it("exige la date de découverte et la description", () => {
    expect(lireFormulaireIncident(formulaire({ description: "x" })).ok).toBe(false);
    expect(lireFormulaireIncident(formulaire({ decouvertLe: "2000-01-01T10:00" })).ok).toBe(false);
  });

  it("« non » sans motif est refusé, et le message ne reprend pas la saisie", () => {
    const r = lireFormulaireIncident(
      formulaire({
        decouvertLe: "2000-01-01T10:00",
        description: "Texte saisi fictif",
        declareCnil: "non",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).toContain("Pourquoi pas la CNIL");
      expect(r.erreur).not.toContain("Texte saisi fictif");
    }
  });

  it("lit la date en heure de Paris", () => {
    const r = lireFormulaireIncident(
      formulaire({ decouvertLe: "2000-01-15T10:00", description: "x" }),
    );
    expect(r.ok && r.saisie.decouvertLe.toISOString()).toBe("2000-01-15T09:00:00.000Z");
  });
});

describe("Textes libres chiffrés au repos", () => {
  const avant = process.env["PII_ENCRYPTION_KEY"];
  beforeAll(() => {
    process.env["PII_ENCRYPTION_KEY"] = "a".repeat(64);
  });
  afterAll(() => {
    if (avant === undefined) delete process.env["PII_ENCRYPTION_KEY"];
    else process.env["PII_ENCRYPTION_KEY"] = avant;
  });

  it("la valeur stockée n'est PAS la valeur saisie, et se relit à l'identique", async () => {
    const saisie = lireFormulaireIncident(
      formulaire({
        decouvertLe: "2000-01-01T10:00",
        description: "Description fictive",
        donneesConcernees: "Données fictives",
        categoriesPersonnes: "Personnes fictives",
        consequences: "Conséquences fictives",
        mesuresPrises: "Mesures fictives",
        declareCnil: "non",
        motifNonDeclaration: "Motif fictif",
        personnesPrevenues: "non",
        motifNonInformation: "Autre motif fictif",
        nombrePersonnes: "12",
      }),
    );
    if (!saisie.ok) throw new Error(saisie.erreur);

    let stocke: Record<string, unknown> = {};
    const client = {
      incidentDonnees: {
        create: async (a: { data: Record<string, unknown> }) => {
          stocke = { ...a.data, id: "i", numero: 1 };
          return { id: "i", numero: 1 };
        },
        findUnique: async () => stocke,
      },
    } as unknown as Parameters<typeof creerIncident>[2];

    await creerIncident(saisie.saisie, { id: "u", nom: "Admin Exemple" }, client);
    for (const champ of CHAMPS_CHIFFRES) {
      const v = stocke[champ];
      expect(typeof v).toBe("string");
      expect(v).not.toBe(saisie.saisie[champ]);
      expect(String(v).startsWith("enc:v1:")).toBe(true);
    }
    expect(JSON.stringify(stocke)).not.toContain("fictive");
    expect(stocke["nombrePersonnes"]).toBe(12);

    const relu = await lireIncident(1, client);
    expect(relu?.description).toBe("Description fictive");
    expect(relu?.motifNonDeclaration).toBe("Motif fictif");
  });
});

describe("Gestes sur les incidents", () => {
  beforeEach(() => {
    h.create.mockReset().mockResolvedValue({ id: "i", numero: 1 });
    h.journal.mockReset();
  });

  it.each(["responsable_qualite", "secretaire", "reader"])(
    "refuse le rôle %s : ni déclaration, ni clôture",
    async (role) => {
      h.session = { user: { id: "u", role } };
      const f = formulaire({ decouvertLe: "2000-01-01T10:00", description: "x" });
      expect(await declarerIncident(f)).toEqual({
        ok: false,
        erreur: "Réservé aux administrateurs.",
      });
      expect(
        await cloreIncident(formulaire({ incidentId: "0b1c2d3e-4f50-4a6b-8c7d-8e9fa0b1c2d3" })),
      ).toEqual({ ok: false, erreur: "Réservé aux administrateurs." });
      expect(h.create).not.toHaveBeenCalled();
    },
  );

  it("un administrateur déclare ; la trace porte le numéro, pas le texte", async () => {
    h.session = { user: { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", role: "admin" } };
    const r = await declarerIncident(
      formulaire({ decouvertLe: "2000-01-01T10:00", description: "Description fictive" }),
    );
    expect(r).toEqual({ ok: true, numero: 1 });
    const trace = JSON.stringify(h.journal.mock.calls[0]);
    expect(trace).toContain("conformite.incident.declare");
    expect(trace).not.toContain("Description fictive");
  });
});
