/**
 * Tests — `constat-financeur-session.ts`, le trait d'union règle ↔ mesure.
 *
 * Ce module ne calcule rien lui-même : il lit le financement au dossier,
 * rejoue `bilanContresignature` — LA mesure du dépôt — et rend le constat.
 * Ce qui se teste ici est donc le CÂBLAGE, et trois pièges de câblage :
 *
 * · une session introuvable, annulée ou reportée ne doit RIEN afficher ;
 * · le build SSG (`stub.invalid`) ne doit rien pré-rendre — un « rien à
 *   contresigner » figé dans la page serait une affirmation fausse ;
 * · ⛔ et rien, jamais, ne doit lever : la page d'émargement s'ouvre même si ce
 *   constat n'a rien à dire. La contresignature reste NON BLOQUANTE.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { constatContresignatureSession } from "./constat-financeur-session";

const findUnique = (
  prisma as unknown as { trainingSession: { findUnique: ReturnType<typeof vi.fn> } }
).trainingSession.findUnique;

/** 16/09/2026 20:00 Paris — les deux demi-journées du 16 sont terminées. */
const MAINTENANT = new Date("2026-09-16T18:00:00.000Z");
const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function ligneSession(over: Record<string, unknown> = {}) {
  return {
    statut: "en_cours",
    financementType: "opco",
    formateurPrincipalId: "t-1",
    sessionFormateurs: [],
    jours: [{ date: jour("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: null }],
    // Deux demi-journées signées par un stagiaire, aucune contresignée.
    emargementContresignatures: [],
    enrollments: [
      {
        // Override du payeur par participant (R-INTER). `null` = aucun :
        // l'inscription relève du `financementType` de la session.
        financementType: null,
        presences: [
          { date: jour("2026-09-16"), demiJournee: "matin" },
          { date: jour("2026-09-16"), demiJournee: "apres_midi" },
        ],
      },
    ],
    ...over,
  };
}

const DATABASE_URL = process.env["DATABASE_URL"];

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/test";
  findUnique.mockResolvedValue(ligneSession());
});

afterEach(() => {
  if (DATABASE_URL === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = DATABASE_URL;
});

describe("constatContresignatureSession", () => {
  it("affiche le manque, nommé, sur une session financée par un OPCO", async () => {
    const c = await constatContresignatureSession("s-1", MAINTENANT);
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.cas).toBe("contresignatures_manquantes");
    expect(c.manquantes).toHaveLength(2);
    expect(c.financeur).toContain("OPCO");
  });

  it("se tait sur la MÊME session en financement direct", async () => {
    // Témoin de non-vacuité : seul le financement change entre les deux cas.
    findUnique.mockResolvedValue(ligneSession({ financementType: "direct" }));
    const c = await constatContresignatureSession("s-1", MAINTENANT);
    expect(c.afficher).toBe(false);
  });

  it("🔴 R-INTER — session `direct`, un inscrit en OPCO : le bandeau parle", async () => {
    // Le cas qui a fait refuser la PR, sur l'écran d'émargement : la session
    // reste `direct` (valeur par défaut à la création), c'est l'INSCRIPTION qui
    // porte l'override. Lire la seule session rendait ce bandeau muet.
    const base = ligneSession({ financementType: "direct" });
    findUnique.mockResolvedValue({
      ...base,
      enrollments: base.enrollments.map((e) => ({ ...e, financementType: "opco" })),
    });
    const c = await constatContresignatureSession("s-1", MAINTENANT);
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.financeur).toContain("OPCO");
  });

  it("se tait quand le financement n'est pas renseigné", async () => {
    findUnique.mockResolvedValue(ligneSession({ financementType: null }));
    expect((await constatContresignatureSession("s-1", MAINTENANT)).afficher).toBe(false);
  });

  it("se tait dès que les deux demi-journées sont contresignées", async () => {
    findUnique.mockResolvedValue(
      ligneSession({
        emargementContresignatures: [
          { date: jour("2026-09-16"), demiJournee: "matin" },
          { date: jour("2026-09-16"), demiJournee: "apres_midi" },
        ],
      }),
    );
    const c = await constatContresignatureSession("s-1", MAINTENANT);
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("tout_contresigne");
  });

  it("ne réclame RIEN sur une session annulée ou reportée", async () => {
    // Une pièce pour un dossier qui ne sera jamais déposé est du bruit pur.
    for (const statut of ["annulee", "reportee"]) {
      findUnique.mockResolvedValue(ligneSession({ statut }));
      expect((await constatContresignatureSession("s-1", MAINTENANT)).afficher, statut).toBe(false);
    }
  });

  it("rend un constat MUET sur une session introuvable, sans lever", async () => {
    findUnique.mockResolvedValue(null);
    await expect(constatContresignatureSession("inconnue", MAINTENANT)).resolves.toEqual({
      afficher: false,
      raison: "financement_non_renseigne",
    });
  });

  it("🔴 ne touche PAS la base au build SSG (`stub.invalid`)", async () => {
    // Un bandeau calculé sur des tables vides serait figé dans la page
    // pré-rendue — et il affirmerait quelque chose de faux.
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const c = await constatContresignatureSession("s-1", MAINTENANT);
    expect(c.afficher).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("ne dit rien avant la fin de la journée — on ne réclame pas en pleine séance", async () => {
    // 16/09 à 11 h Paris : la journée déclarée finit à 17 h. `bilanContresignature`
    // ne compte que les demi-journées TERMINÉES ; le constat suit, et tombe
    // dans le cas NOMMÉ « rien à contresigner » plutôt que dans un « 0/0 ».
    const c = await constatContresignatureSession("s-1", new Date("2026-09-16T09:00:00.000Z"));
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.cas).toBe("rien_a_contresigner");
  });
});
