// @vitest-environment node
/**
 * ⛔ La purge des 36 mois de `calendly_events` FIGE le statut de la rencontre
 * du dossier client AVANT de supprimer le rendez-vous, dans la même
 * transaction (principe PA-3 du plan).
 *
 * Tant que Calendly vit, le statut de la rencontre EST celui de Calendly
 * (colonne nulle, CHECK `rencontres_statut_fige_calendly`) : la purge
 * l'effacerait avec la ligne, et la rencontre de juillet 2023 perdrait « a
 * eu lieu » / « absent » en silence. On recopie donc l'issue du point (sinon
 * le statut Calendly) et on coupe le lien.
 *
 * Mutation qui fait rougir : retirer l'appel à `figerRencontresAvantPurge`
 * du worker → le test de lecture du code rougit ; retirer l'écriture de
 * `statut` dans la fonction → le premier test rougit.
 * Contre-témoin : une rencontre d'un rendez-vous NON purgé n'est pas touchée.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dossierEnMemoire,
  id,
  rendezVousCalendly,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { figerRencontresAvantPurge, statutFige } from "@/server/visio/figer-avant-purge";

describe("⛔ la purge des 36 mois fige le statut avant de supprimer", () => {
  it("statut et issue figés, lien coupé — dans la transaction de la suppression", async () => {
    const vieux = rendezVousCalendly({ startTime: new Date("2023-07-01T08:00:00Z") });
    const recent = rendezVousCalendly({ startTime: new Date("2026-10-01T08:00:00Z") });
    const rVieille = {
      id: id(5),
      source: "calendly",
      type: "visio",
      titre: "t",
      calendlyEventId: vieux["id"],
    };
    const rRecente = {
      id: id(5),
      source: "calendly",
      type: "visio",
      titre: "t",
      calendlyEventId: recent["id"],
    };
    const base = dossierEnMemoire({
      calendlyEvent: [vieux, recent],
      rencontre: [rVieille, rRecente],
      rendezVousSuivi: [{ id: "s", calendlyEventId: vieux["id"], issue: "absent" }],
    });
    const ou = { startTime: { lt: new Date("2023-10-01T00:00:00Z") } };

    const supprimes = await base.client.$transaction(async (tx) => {
      const figees = await figerRencontresAvantPurge(tx as never, ou);
      expect(figees).toBe(1);
      return (
        tx as never as { calendlyEvent: { deleteMany: (a: unknown) => Promise<{ count: number }> } }
      ).calendlyEvent.deleteMany({ where: ou });
    });
    expect(supprimes.count).toBe(1);

    const vieille = base.tables["rencontre"]?.find((r) => r["id"] === rVieille.id);
    expect(vieille?.["calendlyEventId"]).toBeNull();
    expect(vieille?.["statut"]).toBe("absent");
    expect(vieille?.["issueFigee"]).toBe("absent");
    // Contre-témoin.
    const recente = base.tables["rencontre"]?.find((r) => r["id"] === rRecente.id);
    expect(recente?.["calendlyEventId"]).toBe(recent["id"]);
    expect(recente?.["statut"] ?? null).toBeNull();
  });

  it("l'issue vient de `RencontreSuivi`, l'autorité — pas de sa recopie", async () => {
    const vieux = rendezVousCalendly({ startTime: new Date("2023-07-01T08:00:00Z") });
    const r = {
      id: id(5),
      source: "calendly",
      type: "visio",
      titre: "t",
      calendlyEventId: vieux["id"],
    };
    const base = dossierEnMemoire({
      calendlyEvent: [vieux],
      rencontre: [r],
      // Divergence volontaire : l'autorité dit « a eu lieu », la recopie « absent ».
      rencontreSuivi: [{ rencontreId: r.id, issue: "eu_lieu", suite: "aucune", suiteLe: null }],
      rendezVousSuivi: [{ id: "s", calendlyEventId: vieux["id"], issue: "absent" }],
    });
    await base.client.$transaction((tx) =>
      figerRencontresAvantPurge(tx as never, {
        startTime: { lt: new Date("2023-10-01T00:00:00Z") },
      }),
    );
    const figee = base.tables["rencontre"]?.[0];
    expect(figee?.["statut"]).toBe("tenu");
    expect(figee?.["issueFigee"]).toBe("eu_lieu");
  });

  it("le statut de l'issue a une seule table (lecture du code)", () => {
    const src = readFileSync(join(process.cwd(), "src/server/visio/figer-avant-purge.ts"), "utf8");
    expect(src).toContain("STATUT_DE_L_ISSUE");
    expect(src).not.toMatch(/eu_lieu:\s*"tenu"/);
  });

  it("sans point fait, le statut vient de Calendly", () => {
    expect(statutFige(null, "canceled")).toBe("annule");
    expect(statutFige(null, "no_show")).toBe("absent");
    expect(statutFige(null, "completed")).toBe("tenu");
    expect(statutFige(null, "scheduled")).toBeNull();
    expect(statutFige("eu_lieu", "canceled")).toBe("tenu");
  });

  it("le worker fige AVANT de supprimer, dans la même transaction (lecture du code)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts"),
      "utf8",
    );
    const figer = src.indexOf("await figerRencontresAvantPurge(tx, ouRdv)");
    const supprimer = src.indexOf("tx.calendlyEvent.deleteMany({ where: ouRdv })");
    const transaction = src.lastIndexOf("prisma.$transaction(", figer);
    expect(figer).toBeGreaterThan(-1);
    expect(supprimer).toBeGreaterThan(figer);
    expect(transaction).toBeGreaterThan(-1);
    expect(transaction).toBeLessThan(figer);
  });
});
