/**
 * PRÉSENCE d'une précision — et l'anomalie « présente mais non chiffrée » est
 * SIGNALÉE, pas transformée en absence.
 *
 * 🔴 Une première version de ce correctif avait durci le filtre pour exiger le
 * préfixe de chiffrement, au motif que le nom `…PrecisionChiffree` devait dire
 * vrai. C'était la mauvaise moitié du problème : la mention affichée par
 * l'appelant parle de PRÉSENCE (« une précision peut figurer sur la fiche »),
 * jamais de protection. Exiger le chiffrement faisait donc DISPARAÎTRE la
 * mention pour une précision en clair — le seul cas où l'on veut vraiment être
 * prévenu. Le nom avait été honoré, le besoin de l'appelant cassé.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const findMany = vi.fn();
const captureMessage = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainee: { findMany: (a: unknown) => findMany(a) } },
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: vi.fn(),
}));

import { stagiairesAvecPrecision } from "./precision-presente";
import { PREFIX_V1 } from "@/lib/pii-crypto";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("stagiairesAvecPrecision", () => {
  it("🔴 une précision NON chiffrée reste VUE — elle ne disparaît pas de l'écran", async () => {
    // 1re requête : la présence. 2e : la détection d'anomalie.
    findMany.mockResolvedValueOnce([{ id: A }]).mockResolvedValueOnce([{ id: A }]);

    const res = await stagiairesAvecPrecision([A]);

    expect(res, "exiger le chiffrement ferait disparaître la mention").toEqual(new Set([A]));
    const presence = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(presence.where["handicapDetailsChiffre"]).toEqual({ not: null });
  });

  it("🔴 …et l'anomalie est SIGNALÉE, avec le préfixe réel dans le filtre", async () => {
    findMany.mockResolvedValueOnce([{ id: A }]).mockResolvedValueOnce([{ id: A }]);

    await stagiairesAvecPrecision([A]);

    const anomalie = findMany.mock.calls[1]?.[0] as { where: { NOT: unknown } };
    expect(anomalie.where.NOT).toEqual({ handicapDetailsChiffre: { startsWith: PREFIX_V1 } });
    expect(captureMessage, "une donnée de santé en clair passe inaperçue").toHaveBeenCalledOnce();
    expect(String(captureMessage.mock.calls[0]?.[0])).toContain("NON chiffré");
  });

  it("rien d'anormal : aucun signalement", async () => {
    findMany.mockResolvedValueOnce([{ id: A }]).mockResolvedValueOnce([]);
    await stagiairesAvecPrecision([A]);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("une panne de la détection d'anomalie ne fait pas tomber l'écran", async () => {
    findMany.mockResolvedValueOnce([{ id: A }]).mockRejectedValueOnce(new Error("base absente"));
    expect(await stagiairesAvecPrecision([A])).toEqual(new Set([A]));
  });

  it("dédoublonne les identifiants en entrée", async () => {
    findMany.mockResolvedValue([]);
    await stagiairesAvecPrecision([A, A, B]);
    const appel = findMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } };
    expect(appel.where.id.in).toEqual([A, B]);
  });

  it("aucun identifiant : aucune requête", async () => {
    expect(await stagiairesAvecPrecision([])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("🔑 le contenu de la colonne n'est JAMAIS chargé, dans aucune des deux requêtes", async () => {
    findMany.mockResolvedValueOnce([{ id: A }]).mockResolvedValueOnce([]);
    await stagiairesAvecPrecision([A]);
    for (const appel of findMany.mock.calls) {
      expect((appel[0] as { select: unknown }).select).toEqual({ id: true });
    }
  });

  it("🔑 le préfixe n'est pas RETAPÉ : il est importé du module de chiffrement", () => {
    // ⚠️ Un `expect(PREFIX_V1).toBe("enc:v1:")` ne garderait rien : il retape
    // lui-même le littéral et n'observe pas ce module. On lit la source.
    const source = readFileSync(join(__dirname, "precision-presente.ts"), "utf8");
    const code = source
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"))
      .join("\n");

    expect(code, "le préfixe est retapé au lieu d'être importé").not.toContain('"enc:v1:"');
    expect(code).toContain('PREFIX_V1 } from "@/lib/pii-crypto"');
  });
});
