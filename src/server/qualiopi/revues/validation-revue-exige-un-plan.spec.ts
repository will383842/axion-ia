/**
 * Garde — « validée » est un ACTE, pas une chaîne de caractères (indicateur 32 ⭐).
 *
 * ## Ce qui se passait, mesuré le 2026-08-23
 *
 * `updateRevueDirectionAction` déclarait `statut: z.string().max(20).optional()`.
 * Conséquences, toutes vérifiées dans le code d'origine :
 *
 * 1. **N'importe quelle chaîne ≤ 20 caractères était acceptée.** L'écran ne
 *    propose que `brouillon` / `validee` / `archivee`, mais l'action ne les
 *    imposait pas. Le spec de l'action lui-même écrivait `statut: "finalisee"` —
 *    un statut qui n'existe nulle part ailleurs, que l'écran n'affiche pas et que
 *    la règle de couverture ne reconnaît pas. Une revue « finalisée » ne couvre
 *    rien, et rien ne le disait.
 * 2. **Rien ne contraignait le passage à « validee ».** Une revue sans
 *    participants, sans décisions et au plan d'actions vide pouvait être validée
 *    d'un clic — et `nbRevues > 0` verdissait alors un super-indicateur.
 *
 * Le geste qui verdit une NC majeure doit exiger la preuve, au moment où il est
 * fait, avec un message qui dit ce qui manque. Sinon l'écart n'est découvert que
 * le jour J, par l'auditeur, sur un tableau vert.
 *
 * 3. **Le suivi n'était pas stocké.** Les entrées du plan étaient écrites telles
 *    quelles ; responsable / échéance / statut / clôture n'existaient que dans le
 *    `placeholder` d'un `<textarea>`. L'action normalise désormais chaque entrée
 *    (`normaliserPlanActions`), donc ce qui est écrit en base a une forme, et
 *    cette forme est celle que le moteur de conformité relit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/server/qualiopi/registres/revue-direction-service", () => ({
  creerRevue: vi.fn(),
  updateRevue: vi.fn(),
  reporterConstatRevue: vi.fn(),
  getRevueParId: vi.fn(),
}));

// La date d'audit configurée choisit la grille (et donc l'exigence de
// l'analyse des risques) — comme pour la matrice.
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { updateRevue, getRevueParId } from "@/server/qualiopi/registres/revue-direction-service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { updateRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";
import type { ActionAmelioration } from "./plan-actions";

const mockUpdateRevue = updateRevue as ReturnType<typeof vi.fn>;
const mockGetRevueParId = getRevueParId as ReturnType<typeof vi.fn>;
const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

/** Le double de configuration : seule la date d'audit est renseignée. */
function auditLe(jour: string): void {
  mockGetConfig.mockImplementation((key: string) =>
    Promise.resolve(key === "date_audit_referentiel" ? jour : ""),
  );
}
const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLog = logQualiopiActivity as ReturnType<typeof vi.fn>;

const ID = "550e8400-e29b-41d4-a716-446655440050";

/** Une revue déjà complète en base : la validation doit passer. */
function revueComplete() {
  return {
    id: ID,
    annee: 2026,
    participants: ["Williams Jullin — dirigeant"],
    decisions: ["Renforcer le recueil des appréciations entreprise"],
    planActions: [
      {
        action: "Refondre le questionnaire",
        responsable: "Williams Jullin",
        echeance: "2026-12-31",
        statut: "a_faire",
      },
    ],
  };
}

/** Une revue vide : exactement l'objet qui verdissait off.32. */
function revueVide() {
  return { id: ID, annee: 2026, participants: [], decisions: [], planActions: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
  mockLog.mockResolvedValue(undefined);
  mockUpdateRevue.mockResolvedValue({ id: ID });
  mockGetRevueParId.mockResolvedValue(revueComplete());
  mockGetConfig.mockResolvedValue("");
});

describe("updateRevueDirectionAction — le statut est un enum, pas du texte libre", () => {
  it("🔴 refuse un statut inventé (« finalisee ») au lieu de l'écrire en base", async () => {
    const result = await updateRevueDirectionAction({ id: ID, statut: "finalisee" });

    expect(result).toEqual({ error: "Données invalides" });
    expect(mockUpdateRevue).not.toHaveBeenCalled();
  });

  it("accepte les trois seuls statuts que l'écran propose", async () => {
    for (const statut of ["brouillon", "validee", "archivee"] as const) {
      vi.clearAllMocks();
      mockUpdateRevue.mockResolvedValue({ id: ID });
      mockGetRevueParId.mockResolvedValue(revueComplete());

      const result = await updateRevueDirectionAction({ id: ID, statut });
      expect(result, `statut ${statut}`).toEqual({ data: { id: ID } });
    }
  });
});

describe("updateRevueDirectionAction — « validee » exige la preuve, au moment du geste", () => {
  it("🔴 refuse de valider une revue VIDE, et dit ce qui manque", async () => {
    mockGetRevueParId.mockResolvedValue(revueVide());

    const result = await updateRevueDirectionAction({ id: ID, statut: "validee" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/plan d'actions/i);
    expect(mockUpdateRevue).not.toHaveBeenCalled();
  });

  it("🔴 refuse de valider quand une action n'a ni responsable ni échéance", async () => {
    mockGetRevueParId.mockResolvedValue({
      ...revueComplete(),
      planActions: [{ action: "Refondre le questionnaire" }],
    });

    const result = await updateRevueDirectionAction({ id: ID, statut: "validee" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/responsable/i);
    expect(mockUpdateRevue).not.toHaveBeenCalled();
  });

  it("valide sur l'état RÉSULTANT, pas sur l'état stocké", async () => {
    // Le panneau d'édition envoie statut + décisions + plan dans le même geste :
    // refuser sur l'état d'AVANT rendrait la validation impossible en un clic.
    mockGetRevueParId.mockResolvedValue(revueVide());

    const result = await updateRevueDirectionAction({
      id: ID,
      statut: "validee",
      participants: ["Williams Jullin — dirigeant"],
      decisions: ["Décision prise en revue"],
      planActions: [
        {
          action: "Refondre le questionnaire",
          responsable: "Williams Jullin",
          echeance: "2026-12-31",
        },
      ],
    });

    expect(result).toEqual({ data: { id: ID } });
    expect(mockUpdateRevue).toHaveBeenCalledOnce();
  });

  it("un passage en BROUILLON n'exige rien — on doit pouvoir dévalider", async () => {
    mockGetRevueParId.mockResolvedValue(revueVide());

    const result = await updateRevueDirectionAction({ id: ID, statut: "brouillon" });

    expect(result).toEqual({ data: { id: ID } });
  });
});

/**
 * 🔴 I32-01 (audit initial 2026-09-14) — l'analyse de risques saisie en
 * MODIFICATION était perdue sans message.
 *
 * L'écran d'édition envoie `risques`, le schéma Zod l'accepte, le service sait
 * l'écrire… mais l'action ne le transmettait ni à `updateRevue`, ni à la garde
 * de validation. Or la revue de l'année existe déjà (`annee` est unique) : la
 * mise à jour est le SEUL chemin d'écriture. À partir du 1er novembre 2026
 * (décret 2026-728), la revue ne pouvait donc plus jamais être validée.
 */
describe("updateRevueDirectionAction — l'analyse de risques arrive jusqu'à la base (I32-01)", () => {
  const APRES_ECHEANCE = new Date("2026-11-15T09:00:00.000Z");
  const RISQUE = {
    intitule: "Indisponibilité du formateur unique sur une session engagée",
    cause: "Un seul intervenant habilité",
    gravite: 3,
    probabilite: 2,
    maitrise: "Constituer un vivier de deux sous-traitants habilités",
    echeance: "2026-12-15",
    responsable: "W. Jullin",
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("🔴 transmet les risques saisis à `updateRevue`", async () => {
    const result = await updateRevueDirectionAction({ id: ID, risques: [RISQUE] });

    expect(result).toEqual({ data: { id: ID } });
    const [, input] = mockUpdateRevue.mock.calls[0] as [string, { risques?: unknown[] }];
    // Écrit tel quel, plus la date RÉELLE de la saisie, posée par le serveur.
    expect(input.risques, "l'analyse de risques saisie à l'écran n'est pas écrite en base").toEqual(
      [{ ...RISQUE, misAJourLe: expect.any(String) }],
    );
  });

  // 🔴 Relecture PR #1268 — la cotation n'était pas bornée côté serveur : 99,
  // -5 et une clé arbitraire étaient enregistrés dans la pièce remise à
  // l'auditeur.
  it.each([
    ["gravité 99", { ...RISQUE, gravite: 99 }],
    ["probabilité -5", { ...RISQUE, probabilite: -5 }],
    ["gravité 2,5", { ...RISQUE, gravite: 2.5 }],
    ["gravité en toutes lettres", { ...RISQUE, gravite: "élevée" }],
    ["clé inconnue", { ...RISQUE, valideParAuditeur: true }],
    ["intitulé de 301 caractères", { ...RISQUE, intitule: "x".repeat(301) }],
  ])("🔴 refuse un risque hors schéma (%s) — rien n'est écrit", async (_cas, risque) => {
    const result = await updateRevueDirectionAction({ id: ID, risques: [risque] });
    expect("error" in result).toBe(true);
    expect(mockUpdateRevue).not.toHaveBeenCalled();
  });

  it("écrit les seuls champs connus, cote bornée, date du serveur", async () => {
    await updateRevueDirectionAction({
      id: ID,
      risques: [{ ...RISQUE, gravite: 4, probabilite: 1, misAJourLe: "2026-08-03T00:00:00.000Z" }],
    });
    const [, input] = mockUpdateRevue.mock.calls[0] as [
      string,
      { risques: Record<string, unknown>[] },
    ];
    const ecrit = input.risques[0] as Record<string, unknown>;
    expect(Object.keys(ecrit).sort()).toEqual([
      "cause",
      "echeance",
      "gravite",
      "intitule",
      "maitrise",
      "misAJourLe",
      "probabilite",
      "responsable",
    ]);
    expect(ecrit["gravite"]).toBe(4);
    expect(ecrit["misAJourLe"]).not.toBe("2026-08-03T00:00:00.000Z");
  });

  it("les risques stockés inchangés sont réécrits À L'IDENTIQUE (les 10 du 30/09)", async () => {
    const stockes = [
      { intitule: "Dépendance à un formateur unique", maitrise: "Vivier de sous-traitants" },
      { intitule: "Panne de la chaîne d'e-mails", maitrise: "Relance manuelle" },
    ];
    mockGetRevueParId.mockResolvedValue({ ...revueComplete(), risques: stockes });
    await updateRevueDirectionAction({
      id: ID,
      // Ce que l'écran renvoie : les champs lus, sans date.
      risques: stockes.map((r) => ({
        ...r,
        cause: "",
        gravite: null,
        probabilite: null,
        responsable: "",
        echeance: null,
      })),
    });
    const [, input] = mockUpdateRevue.mock.calls[0] as [string, { risques: unknown[] }];
    expect(input.risques).toEqual(stockes);
    expect(input.risques[0]).toBe(stockes[0]);
  });

  it("la garde suit la DATE D'AUDIT configurée, comme la matrice", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Avant le 1er novembre, mais audit fixé au 05/11 : grille 2026, risques exigés.
    vi.setSystemTime(new Date("2026-10-15T09:00:00.000Z"));
    auditLe("2026-11-05");
    mockGetRevueParId.mockResolvedValue({ ...revueComplete(), risques: [] });
    const refus = await updateRevueDirectionAction({ id: ID, statut: "validee" });
    expect("error" in refus).toBe(true);

    // Après le 1er novembre, mais audit tenu le 28/10 : grille V9, pas exigés.
    vi.setSystemTime(APRES_ECHEANCE);
    auditLe("2026-10-28");
    const ok = await updateRevueDirectionAction({ id: ID, statut: "validee" });
    expect(ok).toEqual({ data: { id: ID } });
    mockGetConfig.mockResolvedValue("");
  });

  it("n'efface pas les risques stockés quand la mise à jour ne les renvoie pas", async () => {
    await updateRevueDirectionAction({ id: ID, statut: "brouillon" });

    const [, input] = mockUpdateRevue.mock.calls[0] as [string, Record<string, unknown>];
    expect("risques" in input).toBe(false);
  });

  it("🔴 après le 1er novembre, valide avec les risques envoyés dans le même geste", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(APRES_ECHEANCE);
    mockGetRevueParId.mockResolvedValue({ ...revueComplete(), risques: [] });

    const result = await updateRevueDirectionAction({
      id: ID,
      statut: "validee",
      risques: [RISQUE],
    });

    expect(result).toEqual({ data: { id: ID } });
    expect(mockUpdateRevue).toHaveBeenCalledOnce();
  });

  it("🔴 après le 1er novembre, valide avec les risques déjà en base", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(APRES_ECHEANCE);
    mockGetRevueParId.mockResolvedValue({ ...revueComplete(), risques: [RISQUE] });

    const result = await updateRevueDirectionAction({ id: ID, statut: "validee" });

    expect(result).toEqual({ data: { id: ID } });
  });

  it("après le 1er novembre, refuse toujours sans aucune analyse — la garde discrimine", async () => {
    // Témoin inverse : sans lui, une garde qui accepterait TOUT passerait les
    // deux tests précédents.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(APRES_ECHEANCE);
    mockGetRevueParId.mockResolvedValue({ ...revueComplete(), risques: [] });

    const result = await updateRevueDirectionAction({ id: ID, statut: "validee" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/analyse de risques/i);
    expect(mockUpdateRevue).not.toHaveBeenCalled();
  });
});

describe("updateRevueDirectionAction — le suivi des actions est STOCKÉ", () => {
  it("responsable, échéance, statut et date de clôture arrivent jusqu'à la base", async () => {
    await updateRevueDirectionAction({
      id: ID,
      planActions: [
        {
          action: "Refondre le questionnaire",
          responsable: "Williams Jullin",
          echeance: "2026-12-31",
          statut: "faite",
          clotureAt: "2026-07-01",
        },
      ],
    });

    const [, input] = mockUpdateRevue.mock.calls[0] as [string, { planActions?: unknown[] }];
    const [a] = (input.planActions ?? []) as ActionAmelioration[];
    expect(a).toMatchObject({
      action: "Refondre le questionnaire",
      responsable: "Williams Jullin",
      echeance: "2026-12-31",
      statut: "faite",
      clotureAt: "2026-07-01",
    });
  });

  it("une entrée héritée (chaîne nue) est normalisée, pas écrasée", async () => {
    await updateRevueDirectionAction({ id: ID, planActions: ["Revoir le délai d'accès"] });

    const [, input] = mockUpdateRevue.mock.calls[0] as [string, { planActions?: unknown[] }];
    const [a] = (input.planActions ?? []) as ActionAmelioration[];
    expect(a).toMatchObject({
      action: "Revoir le délai d'accès",
      responsable: "",
      echeance: null,
      statut: "a_faire",
    });
  });

  it("un statut d'action inventé retombe sur `a_faire`, il n'est pas stocké tel quel", async () => {
    await updateRevueDirectionAction({
      id: ID,
      planActions: [{ action: "X", statut: "terminee-ish" }],
    });

    const [, input] = mockUpdateRevue.mock.calls[0] as [string, { planActions?: unknown[] }];
    const [a] = (input.planActions ?? []) as ActionAmelioration[];
    // Affirmer la PRÉSENCE avant de lire le statut : si la normalisation avalait
    // l'entrée, `a.statut` lèverait un `TypeError` illisible au lieu de dire que
    // le plan est reparti vide. Le message doit porter la cause.
    expect(
      a,
      "l'action a disparu du plan : `normaliserPlanActions` a écarté une entrée " +
        "qui porte pourtant un libellé. C'est un défaut plus grave que le statut testé ici.",
    ).toBeDefined();
    expect(a?.statut).toBe("a_faire");
  });
});
