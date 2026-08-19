/**
 * Export CSV des soumissions — fidélité et innocuité du fichier produit.
 *
 * Ce que ces tests protègent, dans l'ordre de gravité :
 *
 *  1. « N lignes pour N soumissions ». L'export s'arrêtait à 5 000 lignes
 *     (`take: 5000`) SANS RIEN DIRE : ni en-tête, ni avertissement, ni journal.
 *     Un opérateur téléchargeait 5 000 lignes en croyant tenir la totalité.
 *     C'est aussi l'outil de réponse à une demande RGPD : une troncature muette
 *     y est une réponse fausse, pas une limite technique.
 *
 *  2. Le périmètre. L'écran masque la corbeille et les archives, et applique une
 *     plage de dates ; l'export, lui, construisait son propre `where` en oubliant
 *     les trois. Le CSV ne correspondait donc pas à ce qu'on regardait — et il
 *     exportait des messages mis à la corbeille.
 *
 *  3. L'injection de formule. `escape()` protégeait le séparateur et les
 *     guillemets, mais laissait passer `=`, `+`, `-`, `@` en tête de champ :
 *     un visiteur pouvait faire exécuter une formule dans le tableur de
 *     l'admin qui ouvre l'export. L'export public de l'observatoire
 *     (`api/observatoire/export-csv/route.ts`) neutralise déjà ce préfixe ;
 *     l'export qui porte les PII, non.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const submissionFindMany = vi.fn();
const activityLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => submissionFindMany(...a) },
    activityLog: { create: (...a: unknown[]) => activityLogCreate(...a) },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin-1", role: "super_admin" } }),
}));

vi.mock("@/lib/client-ip", () => ({ getClientIp: () => Promise.resolve("127.0.0.1") }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: vi.fn(),
}));

import { exportSubmissionsCsvAction } from "./actions";

/** Une soumission telle que la sélection de l'export la ramène. */
function ligne(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `sub-${String(i).padStart(6, "0")}`,
    type: "contact",
    status: "new",
    locale: "fr",
    companyName: `Entreprise ${i}`,
    sector: "industrie",
    contactName: `Contact ${i}`,
    contactRole: "Dirigeant",
    contactEmail: `contact${i}@example.fr`,
    contactPhone: "0611223344",
    employeesCount: "10-49",
    address: null,
    assignedTo: null,
    internalNotes: null,
    submittedAt: new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - i * 60_000),
    details: { unifiedType: "contact" },
    ...overrides,
  };
}

/**
 * `findMany` en mémoire, honorant `take`, `cursor` et `skip` — c'est-à-dire
 * exactement ce dont une pagination interne a besoin. Sans cette émulation, un
 * test « il n'y a plus de plafond » ne prouverait rien : le mock rendrait tout
 * d'un coup quel que soit le code appelant.
 */
function servir(base: ReturnType<typeof ligne>[]): void {
  submissionFindMany.mockImplementation((args: Record<string, unknown> | undefined) => {
    const take = typeof args?.["take"] === "number" ? (args["take"] as number) : base.length;
    const cursor = args?.["cursor"] as { id?: string } | undefined;
    const skip = typeof args?.["skip"] === "number" ? (args["skip"] as number) : 0;
    let debut = 0;
    if (cursor?.id) {
      const idx = base.findIndex((r) => r.id === cursor.id);
      debut = idx < 0 ? base.length : idx;
    }
    return Promise.resolve(base.slice(debut + skip, debut + skip + take));
  });
}

/** Lignes de DONNÉES du CSV (sans l'en-tête, sans le BOM). */
function lignesDonnees(csv: string): string[] {
  return csv.split("\r\n").slice(1).filter(Boolean);
}

beforeEach(() => {
  submissionFindMany.mockReset();
  activityLogCreate.mockReset();
  captureMessage.mockReset();
  activityLogCreate.mockResolvedValue({});
});

describe("exportSubmissionsCsvAction — N lignes pour N soumissions", () => {
  it("rend les 7 000 lignes d'une base de 7 000 soumissions", async () => {
    const base = Array.from({ length: 7000 }, (_, i) => ligne(i));
    servir(base);

    const { csv } = await exportSubmissionsCsvAction({});

    expect(lignesDonnees(csv)).toHaveLength(7000);
    // Et pas seulement le compte : la DERNIÈRE soumission doit y être, sinon on
    // a rendu 7 000 lignes en en oubliant une au milieu.
    expect(csv).toContain("sub-006999");
  }, 60_000);

  it("s'arrête proprement sur une base plus petite qu'une page", async () => {
    servir([ligne(0), ligne(1), ligne(2)]);
    const { csv } = await exportSubmissionsCsvAction({});
    expect(lignesDonnees(csv)).toHaveLength(3);
  });

  it("le garde-fou dur reste, mais il est BRUYANT — jamais muet", async () => {
    // Le plafond de 50 000 n'est pas atteignable à l'échelle du produit
    // (≈ 137 soumissions PAR JOUR pendant un an). S'il l'était, il devrait se
    // voir de trois façons — c'est exactement ce qui manquait aux 5 000
    // précédents, qui ne se voyaient d'AUCUNE.
    servir(Array.from({ length: 50_001 }, (_, i) => ligne(i)));

    const { csv } = await exportSubmissionsCsvAction({});

    // 1. dans le fichier lui-même, en dernière ligne ;
    expect(csv).toContain("EXPORT TRONQUÉ à 50000 lignes");
    // 2. dans Sentry ;
    expect(captureMessage).toHaveBeenCalledOnce();
    // 3. dans le journal RGPD — sinon rien ne prouverait, six mois plus tard,
    //    que la réponse à une demande d'accès était incomplète.
    const changes = (
      activityLogCreate.mock.calls[0]![0] as { data: { changes: Record<string, unknown> } }
    ).data.changes;
    expect(changes["tronque"]).toBe(true);
    // Le compte journalisé est celui des SOUMISSIONS, pas des lignes du
    // fichier : la ligne d'avertissement n'en est pas une.
    expect(changes["lignes"]).toBe(50_000);
  }, 120_000);

  it("une base vide rend l'en-tête seul, pas un fichier vide", async () => {
    servir([]);
    const { csv } = await exportSubmissionsCsvAction({});
    expect(lignesDonnees(csv)).toHaveLength(0);
    expect(csv).toContain("contactEmail");
  });
});

describe("exportSubmissionsCsvAction — le CSV porte le périmètre de l'écran", () => {
  beforeEach(() => servir([ligne(0)]));

  it("exclut la corbeille et les archives, comme le listing", async () => {
    await exportSubmissionsCsvAction({});
    const where = (submissionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    // Sans ces deux clauses, l'export ressortait des messages que l'opérateur
    // avait mis à la corbeille — y compris dans une réponse RGPD.
    expect(where["deletedAt"]).toBeNull();
    expect(where["archivedAt"]).toBeNull();
  });

  it("applique la plage de dates de l'écran", async () => {
    await exportSubmissionsCsvAction({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });
    const where = (submissionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    const plage = where["submittedAt"] as { gte?: Date; lte?: Date };
    expect(plage?.gte).toEqual(new Date("2026-01-01"));
    // Borne haute INCLUSIVE : filtrer « jusqu'au 31 » doit garder le 31 entier.
    expect(plage?.lte?.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });

  it("l'onglet Corbeille n'exporte QUE la corbeille", async () => {
    await exportSubmissionsCsvAction({ deleted: true });
    const where = (submissionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    expect(where["deletedAt"]).toEqual({ not: null });
  });

  it("le journal RGPD décrit le périmètre réellement exporté", async () => {
    await exportSubmissionsCsvAction({ dateFrom: "2026-01-01", status: "new" });
    const changes = (
      activityLogCreate.mock.calls[0]![0] as { data: { changes: Record<string, unknown> } }
    ).data.changes;
    expect(changes["dateFrom"]).toBe("2026-01-01");
    expect(changes["status"]).toBe("new");
  });
});

describe("exportSubmissionsCsvAction — injection de formule tableur", () => {
  it("neutralise `=`, `+`, `-` et `@` en tête de champ", async () => {
    servir([
      ligne(0, {
        companyName: "=cmd|' /c calc'!A1",
        contactName: '+HYPERLINK("http://mechant","cliquez")',
        internalNotes: "-2+3+cmd|' /c calc'!A0",
        sector: "@SUM(1+1)*cmd",
      }),
    ]);

    const { csv } = await exportSubmissionsCsvAction({});
    const champs = lignesDonnees(csv)[0]!;

    // Aucun champ ne doit COMMENCER par un caractère que le tableur interprète.
    // On regarde le champ tel qu'il sort, guillemets d'échappement compris.
    expect(champs).not.toMatch(/(^|;)"?=/);
    expect(champs).not.toMatch(/(^|;)"?\+H/);
    expect(champs).not.toMatch(/(^|;)"?@/);
    // Le contenu, lui, reste lisible — on préfixe, on ne mutile pas.
    expect(csv).toContain("cmd|");
    expect(csv).toContain("HYPERLINK");
  });

  it("laisse un numéro de téléphone international lisible", async () => {
    // Le préfixe anti-formule ne doit pas transformer chaque `+33…` en
    // `'+33…` : le `'` n'est PAS masqué à l'import CSV (contrairement à une
    // saisie en cellule), il apparaîtrait dans toute la colonne Téléphone.
    // Une suite de chiffres et de séparateurs ne peut porter aucune formule :
    // toutes les charges connues (`cmd`, `HYPERLINK`, `SUM`, `DDE`) exigent des
    // lettres.
    servir([ligne(0, { contactPhone: "+33 6 11 22 33 44" })]);
    const { csv } = await exportSubmissionsCsvAction({});
    expect(csv).toContain("+33 6 11 22 33 44");
    expect(csv).not.toContain("'+33");
  });
});
