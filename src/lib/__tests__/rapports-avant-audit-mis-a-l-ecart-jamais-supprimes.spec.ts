// Effacement RGPD (art. 17) et rapports avant audit (2026-11-02) : MISE À L'ÉCART, jamais une
// suppression (règle de Will : aucune purge de données clients). Un lancement encore en attente
// ou en cours est annulé ; la route alerte Will (`src/app/api/gdpr-erase/route.ts`).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const qFindMany = vi.fn();
const rUpdateMany = vi.fn();
const rDelete = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAudit: { findMany: (...a: unknown[]) => qFindMany(...a) },
    rapportAvantAudit: {
      updateMany: (...a: unknown[]) => rUpdateMany(...a),
      delete: (...a: unknown[]) => rDelete(...a),
      deleteMany: (...a: unknown[]) => rDelete(...a),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "hash" }));

beforeEach(() => {
  vi.clearAllMocks();
  rUpdateMany.mockResolvedValue({ count: 2 });
});

describe("rapports avant audit à l'effacement", () => {
  it("met à l'écart et annule, sans jamais supprimer", async () => {
    qFindMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);
    const { ecarterRapportsAvantAuditPourEmail, MOTIF_ECART_RAPPORT_RGPD } =
      await import("../rgpd-erase");
    const t = new Date("2026-11-02T10:00:00Z");
    const r = await ecarterRapportsAvantAuditPourEmail("dirigeant@example.invalid", t);
    expect(r).toEqual({ ecartes: 2, annules: 2 });
    expect(rDelete).not.toHaveBeenCalled();
    const appels = rUpdateMany.mock.calls.map((c) => c[0]);
    expect(appels).toContainEqual({
      where: {
        questionnaireIds: { hasSome: ["q1", "q2"] },
        statut: { in: ["en_attente", "en_cours"] },
      },
      data: expect.objectContaining({ statut: "annule" }),
    });
    expect(appels).toContainEqual({
      where: { questionnaireIds: { hasSome: ["q1", "q2"] }, ecarteLe: null },
      data: { ecarteLe: t, ecarteMotif: MOTIF_ECART_RAPPORT_RGPD },
    });
    // Aucune donnée vidée : la base chiffrée reste, Will décide.
    for (const a of appels) expect(a.data).not.toHaveProperty("baseAudit");
  });

  it("aucun questionnaire du dirigeant : rien n'est touché", async () => {
    qFindMany.mockResolvedValue([]);
    const { ecarterRapportsAvantAuditPourEmail } = await import("../rgpd-erase");
    expect(await ecarterRapportsAvantAuditPourEmail("x@example.invalid")).toEqual({
      ecartes: 0,
      annules: 0,
    });
    expect(rUpdateMany).not.toHaveBeenCalled();
  });

  it("la route appelle la mise à l'écart AVANT l'anonymisation Calendly, et alerte Will", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/gdpr-erase/route.ts"),
      "utf8",
    ).replace(/^\s*\/\/.*$/gm, "");
    const ecart = route.indexOf("ecarterRapportsAvantAuditPourEmail(email)");
    const calendly = route.indexOf("eraseCalendlyEventsForEmail(email)");
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThan(calendly);
    expect(route).toMatch(/rapport\(s\) avant audit mis à l'écart/);
  });
});
