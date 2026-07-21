/**
 * Tests — feuille-pdf.ts
 *
 * Deux choses que ce module doit garantir, et que rien d'autre ne garantit :
 *
 *  1. **L'écart entre la signature et le créneau est VISIBLE.** C'est la
 *     mitigation obligatoire de la décision D13 — la fenêtre de 48 h a été prise
 *     contre la recommandation initiale, et `CAA Nantes 20/04/2021` sanctionne
 *     les signatures aux dates impossibles. Un écart de 40 h assumé et affiché se
 *     défend ; le même écart muet ne se défend pas.
 *  2. **L'ancrage de chaîne.** Un chaînage ne détecte jamais la suppression des
 *     DERNIERS maillons : retirer les signatures de fin laisse un préfixe
 *     valide. Le PDF, numéroté et stocké hors base, fige le nombre et
 *     l'empreinte de tête — c'est ce qui rend la troncature détectable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { construireFeuillePdf, ecartLisible } from "./feuille-pdf";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
};

/** Fin de matinée pour une journée 09:00–17:00 : le pivot, soit 13:00. */
const FIN_MATIN = 13 * 60;

function sessionAvecSignature(signeAt: Date | null) {
  return {
    numero: "AXI-SESS-2026-001",
    titreSession: "Bien démarrer avec l'IA",
    formateurPrincipal: { nom: "Jullin", prenom: "Williams" },
    jours: [
      {
        date: new Date("2026-06-10T00:00:00.000Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        modules: ["Module 1 — Cadrage"],
        trainer: null,
      },
    ],
    enrollments: [
      {
        id: "enr-1",
        trainee: { nom: "Dupont", prenom: "Alice", entreprise: "ACME" },
        emargementSignatures:
          signeAt === null
            ? []
            : [
                {
                  date: new Date("2026-06-10T00:00:00.000Z"),
                  demiJournee: "matin",
                  signeAt,
                  methode: "canvas",
                  selfHash: "a".repeat(64),
                  recueilliParTrainerId: null,
                },
              ],
      },
    ],
    emargementContresignatures: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ecartLisible — mitigation obligatoire de D13", () => {
  it("ne signale AUCUN écart quand la signature tombe dans le créneau", () => {
    // 11 h 30 Paris = 09 h 30 UTC en heure d'été.
    expect(ecartLisible(new Date("2026-06-10T09:30:00Z"), "2026-06-10", FIN_MATIN)).toBeNull();
  });

  it("signale un écart de quelques heures le même jour", () => {
    // 16 h 00 Paris, soit 3 h après la fin de la matinée.
    expect(ecartLisible(new Date("2026-06-10T14:00:00Z"), "2026-06-10", FIN_MATIN)).toBe("+ 3 h");
  });

  it("🔴 signale un écart de PLUSIEURS JOURS — le cas que la fenêtre de 48 h autorise", () => {
    // Signature le surlendemain : exactement ce que D13 rend possible, et que
    // le PDF doit rendre visible plutôt que taire.
    const ecart = ecartLisible(new Date("2026-06-12T09:00:00Z"), "2026-06-10", FIN_MATIN);
    expect(ecart).not.toBeNull();
    expect(ecart).toContain("j");
  });

  it("signale les minutes quand l'écart est court", () => {
    // 13 h 20 Paris = 11 h 20 UTC.
    expect(ecartLisible(new Date("2026-06-10T11:20:00Z"), "2026-06-10", FIN_MATIN)).toBe(
      "+ 20 min",
    );
  });

  it("compte en heure de PARIS des deux côtés", () => {
    // 12 h 59 Paris (10 h 59 UTC) est encore dans la matinée ; 13 h 01 non.
    expect(ecartLisible(new Date("2026-06-10T10:59:00Z"), "2026-06-10", FIN_MATIN)).toBeNull();
    expect(ecartLisible(new Date("2026-06-10T11:01:00Z"), "2026-06-10", FIN_MATIN)).not.toBeNull();
  });
});

describe("construireFeuillePdf", () => {
  it("porte les horaires RÉELS, pas un « 09h00–17h00 » codé en dur", async () => {
    const s = sessionAvecSignature(null);
    s.jours[0]!.heureDebut = "08:30";
    s.jours[0]!.heureFin = "16:45";
    mockPrisma.trainingSession.findUnique.mockResolvedValue(s);

    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees[0]?.horaires).toBe("08:30–16:45");
  });

  it("produit UNE journée par jour déclaré", async () => {
    const s = sessionAvecSignature(null);
    s.jours.push({
      date: new Date("2026-06-11T00:00:00.000Z"),
      heureDebut: "09:00",
      heureFin: "12:30",
      modules: [],
      trainer: null,
    });
    mockPrisma.trainingSession.findUnique.mockResolvedValue(s);

    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees).toHaveLength(2);
    // Une matinée seule ne porte qu'une demi-journée.
    expect(f?.journees[1]?.demiJournees).toEqual(["matin"]);
  });

  it("porte les modules et le nom du formateur", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionAvecSignature(null));
    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees[0]?.modules).toEqual(["Module 1 — Cadrage"]);
    expect(f?.journees[0]?.formateurNom).toBe("Williams Jullin");
  });

  it("le formateur de la JOURNÉE prime — désistement, co-animation", async () => {
    const s = sessionAvecSignature(null);
    s.jours[0]!.trainer = { nom: "Remplaçante", prenom: "Claire" } as never;
    mockPrisma.trainingSession.findUnique.mockResolvedValue(s);

    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees[0]?.formateurNom).toBe("Claire Remplaçante");
  });

  it("affiche l'heure de signature ET son écart", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionAvecSignature(new Date("2026-06-10T14:00:00Z")),
    );
    const f = await construireFeuillePdf("ses-1");
    const c = f?.journees[0]?.lignes[0]?.cases[0];
    expect(c?.signeAHeure).toBe("16h00");
    expect(c?.ecart).toBe("+ 3 h");
  });

  it("laisse la case VIDE quand personne n'a signé — jamais de valeur inventée", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionAvecSignature(null));
    const f = await construireFeuillePdf("ses-1");
    const c = f?.journees[0]?.lignes[0]?.cases[0];
    expect(c?.signeAHeure).toBeNull();
    expect(c?.methode).toBeNull();
  });

  it("🔴 fige l'ANCRAGE de chaîne : nombre et empreinte de tête", async () => {
    // C'est ce qui rend détectable la suppression des dernières signatures, que
    // le chaînage seul ne voit pas — il suffira de comparer au document tiré.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionAvecSignature(new Date("2026-06-10T09:30:00Z")),
    );
    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees[0]?.lignes[0]?.nbSignatures).toBe(1);
    expect(f?.journees[0]?.lignes[0]?.empreinteTete).toBe("a".repeat(64));
    expect(f?.totalSignatures).toBe(1);
  });

  it("ne compte pas N fois les mêmes signatures sur une session multi-jours", async () => {
    const s = sessionAvecSignature(new Date("2026-06-10T09:30:00Z"));
    s.jours.push({
      date: new Date("2026-06-11T00:00:00.000Z"),
      heureDebut: "09:00",
      heureFin: "17:00",
      modules: [],
      trainer: null,
    });
    mockPrisma.trainingSession.findUnique.mockResolvedValue(s);

    const f = await construireFeuillePdf("ses-1");
    // Une seule signature existe, même si elle apparaît sur les deux tableaux.
    expect(f?.totalSignatures).toBe(1);
  });

  it("signale une signature recueillie sur le poste du formateur", async () => {
    const s = sessionAvecSignature(new Date("2026-06-10T09:30:00Z"));
    s.enrollments[0]!.emargementSignatures[0]!.recueilliParTrainerId = "tr-1" as never;
    mockPrisma.trainingSession.findUnique.mockResolvedValue(s);

    const f = await construireFeuillePdf("ses-1");
    expect(f?.journees[0]?.lignes[0]?.cases[0]?.surPosteFormateur).toBe(true);
  });

  it("lit les signatures dans l'ordre d'INSERTION, jamais de `signeAt`", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionAvecSignature(null));
    await construireFeuillePdf("ses-1");
    const arg = mockPrisma.trainingSession.findUnique.mock.calls[0]?.[0] as {
      select: {
        enrollments: { select: { emargementSignatures: { orderBy: unknown } } };
      };
    };
    expect(arg.select.enrollments.select.emargementSignatures.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("retourne null sur une session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    expect(await construireFeuillePdf("inconnue")).toBeNull();
  });
});
