/**
 * Tests — echeances-formateur.ts.
 *
 * 🔴 L'ENJEU EST LE CLOISONNEMENT, et rien d'autre ne compte autant ici.
 *
 * Un formateur ne doit JAMAIS voir une session qu'il n'anime pas. Le risque
 * n'est pas théorique : `prochainesEcheances` accepte des `sessionIds` bruts et
 * ne vérifie AUCUNE appartenance — c'est un service d'administration, appelé
 * ailleurs sans aucun périmètre. Toute la garde tient donc à l'endroit d'où
 * sortent ces identifiants.
 *
 * Ces tests inspectent l'ARGUMENT réellement passé au service. Vérifier
 * seulement la sortie ne prouverait rien : une implémentation qui balaie toutes
 * les sessions du monde puis filtre le résultat passerait un test de sortie —
 * en ayant lu, et fait construire, le parcours des sessions des autres.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./collectif-queries", () => ({
  listMyTrainingSessions: vi.fn(),
  whereSessionsDuFormateur: vi.fn(),
}));

vi.mock("@/server/qualiopi/parcours/echeances-service", () => ({
  prochainesEcheances: vi.fn(),
}));

import { listMyTrainingSessions } from "./collectif-queries";
import { prochainesEcheances } from "@/server/qualiopi/parcours/echeances-service";
import { echeancesDuFormateur } from "./echeances-formateur";

const mockMesSessions = vi.mocked(listMyTrainingSessions);
const mockEcheances = vi.mocked(prochainesEcheances);

const TRAINER = "trainer-1";
const MAINTENANT = new Date("2026-08-17T10:00:00Z");
const j = (n: number) => new Date(MAINTENANT.getTime() + n * 24 * 60 * 60 * 1000);

/** Une session telle que `listMyTrainingSessions` la rend. */
function session(id: string, statut = "en_cours", dateFin = j(1)) {
  return {
    id,
    numero: `AXI-SESS-2026-${id}`,
    titreSession: "IA pour RH",
    statut,
    modalite: "presentiel",
    dateDebut: j(-1),
    dateFin,
    lieuVille: "Grenoble",
    role: "principal" as const,
    nbInscrits: 6,
  };
}

/** Une échéance telle que `prochainesEcheances` la rend. */
function echeance(sessionId: string, cle: string, etat = "rattrapable") {
  return {
    sessionId,
    numero: `AXI-SESS-2026-${sessionId}`,
    titre: "IA pour RH",
    dateDebut: j(-1),
    etape: {
      cle,
      libelle: `Étape ${cle}`,
      etat,
      mention: "Échéance dépassée — encore rattrapable",
      geste: "Manuel — onglet Émargement de la console.",
    },
  };
}

const VIDE = { echeances: [], parSession: new Map(), troncature: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockEcheances.mockResolvedValue(VIDE as never);
});

describe("🔴 cloisonnement — le périmètre vient des sessions DU formateur", () => {
  it("passe à prochainesEcheances exactement les identifiants rendus par listMyTrainingSessions", async () => {
    mockMesSessions.mockResolvedValue([session("s1"), session("s2")] as never);

    await echeancesDuFormateur(TRAINER, MAINTENANT);

    // La lecture scopée est bien interrogée, et avec l'identité du formateur.
    expect(mockMesSessions).toHaveBeenCalledTimes(1);
    expect(mockMesSessions).toHaveBeenCalledWith(TRAINER);
    const arg = mockEcheances.mock.calls[0]?.[0] as { sessionIds: string[] };
    expect(arg.sessionIds).toEqual(["s1", "s2"]);
  });

  it("🔴 n'appelle JAMAIS prochainesEcheances sans périmètre", async () => {
    // Un appel sans `sessionIds` balaierait les 300 sessions de l'organisme et
    // rendrait au formateur les échéances de ses confrères. C'est LE défaut à
    // interdire, et il ne se voit pas dans la sortie s'il est filtré après coup.
    mockMesSessions.mockResolvedValue([session("s1")] as never);

    await echeancesDuFormateur(TRAINER, MAINTENANT);

    for (const [options] of mockEcheances.mock.calls) {
      expect(options).toBeDefined();
      expect((options as { sessionIds?: unknown }).sessionIds).toBeDefined();
    }
  });

  it("🔴 n'appelle même PAS le service quand le formateur n'a aucune session dans le périmètre", async () => {
    // `prochainesEcheances([])` rend vide, mais compter là-dessus ferait
    // dépendre le cloisonnement d'un détail d'implémentation du service. On
    // s'arrête avant.
    mockMesSessions.mockResolvedValue([] as never);

    expect(await echeancesDuFormateur(TRAINER, MAINTENANT)).toEqual([]);
    expect(mockEcheances).not.toHaveBeenCalled();
  });

  it("🔴 borne le périmètre : une session réalisée il y a plus de 45 jours n'est pas transmise", async () => {
    mockMesSessions.mockResolvedValue([
      session("vieille", "realisee", j(-90)),
      session("recente", "realisee", j(-10)),
      session("annulee", "annulee", j(2)),
    ] as never);

    await echeancesDuFormateur(TRAINER, MAINTENANT);

    const arg = mockEcheances.mock.calls[0]?.[0] as { sessionIds: string[] };
    expect(arg.sessionIds).toEqual(["recente"]);
  });

  it("propage l'instant unique du rendu au service (pas deux horloges)", async () => {
    mockMesSessions.mockResolvedValue([session("s1")] as never);

    await echeancesDuFormateur(TRAINER, MAINTENANT);

    const arg = mockEcheances.mock.calls[0]?.[0] as { maintenant: Date };
    expect(arg.maintenant).toBe(MAINTENANT);
  });
});

describe("filtrage et mise en forme", () => {
  it("🔴 ne rend que les étapes qui concernent le formateur", async () => {
    mockMesSessions.mockResolvedValue([session("s1")] as never);
    mockEcheances.mockResolvedValue({
      ...VIDE,
      echeances: [
        echeance("s1", "convention_signee"),
        echeance("s1", "emargement_signe"),
        echeance("s1", "attestation"),
        echeance("s1", "satisfaction_froid"),
      ],
    } as never);

    const r = await echeancesDuFormateur(TRAINER, MAINTENANT);
    expect(r.map((e) => e.cle)).toEqual(["emargement_signe"]);
  });

  it("🔴 réécrit le geste : jamais celui qui nomme un bouton de la console", async () => {
    mockMesSessions.mockResolvedValue([session("s1")] as never);
    mockEcheances.mockResolvedValue({
      ...VIDE,
      echeances: [echeance("s1", "creneaux_emargement")],
    } as never);

    const r = await echeancesDuFormateur(TRAINER, MAINTENANT);
    expect(r[0]?.geste).not.toContain("console");
    expect(r[0]?.geste).toContain("Signalez-le");
  });

  it("🔴 ne rend AUCUNE donnée de stagiaire — la forme de sortie est close", async () => {
    mockMesSessions.mockResolvedValue([session("s1")] as never);
    mockEcheances.mockResolvedValue({
      ...VIDE,
      echeances: [
        {
          ...echeance("s1", "emargement_signe"),
          etape: {
            ...echeance("s1", "emargement_signe").etape,
            avancement: { fait: 2, total: 6 },
            // Le service porte des avertissements écrits pour le REGISTRE de
            // l'organisme (numéros de pièces à annuler). Ils ne doivent pas
            // traverser jusqu'au formateur.
            avertissement: "Convention AXI-DOC-2026-003 à annuler au registre.",
          },
        },
      ],
    } as never);

    const r = await echeancesDuFormateur(TRAINER, MAINTENANT);
    expect(Object.keys(r[0] ?? {}).sort()).toEqual([
      "avancement",
      "cle",
      "etat",
      "geste",
      "libelle",
      "mention",
      "numero",
      "sessionId",
      "titre",
    ]);
    // Un dénombrement ne désigne personne : `n/m` reste, les noms n'existent pas.
    expect(r[0]?.avancement).toEqual({ fait: 2, total: 6 });
  });
});
