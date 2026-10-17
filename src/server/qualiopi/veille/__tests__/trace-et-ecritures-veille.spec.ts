/**
 * Chantier QNC, lot L10 — la veille tracée, sans base :
 *   - le journal relu (`lireTraceVeille`) : décision humaine, reprise par une
 *     correction, archivage, version initiale ;
 *   - les écritures (`veille-tracee.ts`) contre un faux client transactionnel :
 *     la ligne et sa trace dans la MÊME transaction, `exiger` (sans trace, pas
 *     d'écriture), aucune réécriture (ni `update` ni `delete`), dates serveur ;
 *   - la règle partagée (`whereVeilleExploitee`) : sans règle, l'objet d'avant
 *     au caractère près.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ACTION_JOURNAL_VEILLE,
  idsVeillesDecidees,
  lireTraceVeille,
  versionInitiale,
  type LigneJournalVeille,
} from "../trace-veille";
import {
  RefusVeille,
  archiverVeille,
  corrigerVeille,
  creerVeilleTracee,
  deciderVeille,
  jourInformation,
} from "../veille-tracee";
import { whereVeilleExploitee } from "@/server/qualiopi/conformite/veille-exploitee";

const t = (iso: string) => new Date(iso);

function ligne(
  p: Partial<LigneJournalVeille> & Pick<LigneJournalVeille, "action" | "targetId">,
): LigneJournalVeille {
  return { adminUserId: "will", changes: {}, createdAt: t("2026-10-01T10:00:00Z"), ...p };
}

describe("le journal d'une veille", () => {
  it("une décision ne compte que prise par une personne et non vide", () => {
    const trace = lireTraceVeille([
      ligne({
        action: ACTION_JOURNAL_VEILLE.decision,
        targetId: "v2",
        changes: { remplace: "v1", decision: "Mettre à jour", pieceModifiee: "Livret" },
      }),
      ligne({
        action: ACTION_JOURNAL_VEILLE.decision,
        targetId: "v3",
        adminUserId: null,
        changes: { decision: "Proposée par le système" },
      }),
      ligne({
        action: ACTION_JOURNAL_VEILLE.decision,
        targetId: "v4",
        changes: { decision: "  " },
      }),
    ]);
    expect([...trace.decisions.keys()]).toEqual(["v2"]);
    expect(trace.decisions.get("v2")).toMatchObject({
      decideurId: "will",
      pieceModifiee: "Livret",
    });
  });

  it("une correction reprend la décision d'origine, son auteur et sa date ; l'archivée ne compte plus", () => {
    const trace = lireTraceVeille([
      ligne({
        action: ACTION_JOURNAL_VEILLE.archivage,
        targetId: "v2",
        createdAt: t("2026-10-03T00:00:00Z"),
        changes: { motif: "Analyse incomplète", remplaceePar: "v3" },
      }),
      ligne({
        action: ACTION_JOURNAL_VEILLE.correction,
        targetId: "v3",
        adminUserId: "secretaire",
        createdAt: t("2026-10-03T00:00:00Z"),
        changes: { remplace: "v2", motif: "Analyse incomplète" },
      }),
      ligne({
        action: ACTION_JOURNAL_VEILLE.decision,
        targetId: "v2",
        createdAt: t("2026-10-02T00:00:00Z"),
        changes: {
          remplace: "v1",
          decision: "Revoir le programme",
          pieceModifiee: "AXI-FORM-2026-003",
        },
      }),
      ligne({
        action: ACTION_JOURNAL_VEILLE.archivage,
        targetId: "v1",
        createdAt: t("2026-10-02T00:00:00Z"),
        changes: { motif: "Décision prise", remplaceePar: "v2" },
      }),
    ]);
    expect(trace.decisions.get("v3")).toMatchObject({
      decideurId: "will",
      decision: "Revoir le programme",
    });
    expect(idsVeillesDecidees(trace)).toEqual(["v3"]);
    expect(versionInitiale(trace, "v3")).toBe("v1");
    expect(trace.archivees.get("v2")).toMatchObject({
      remplaceePar: "v3",
      motif: "Analyse incomplète",
    });
  });
});

describe("la règle partagée des indicateurs 23 à 25", () => {
  const maintenant = t("2026-10-17T10:00:00Z");

  it("sans règle (interrupteur éteint) : l'objet d'avant, au caractère près", () => {
    expect(whereVeilleExploitee("legale", maintenant)).toEqual({
      type: "legale",
      dateVeille: { gte: t("2025-10-17T10:00:00Z") },
      AND: [{ actionDecidee: { not: null } }, { actionDecidee: { not: "" } }],
    });
  });

  it("avec règle : seules les veilles décidées par une personne et non archivées", () => {
    expect(whereVeilleExploitee("legale", maintenant, { idsDecidees: ["v3"] })).toMatchObject({
      id: { in: ["v3"] },
    });
    // Aucune décision humaine : aucun vert possible, même avec `actionDecidee` rempli.
    expect(whereVeilleExploitee("legale", maintenant, { idsDecidees: [] })).toMatchObject({
      id: { in: [] },
    });
  });
});

// ─── Faux client transactionnel ─────────────────────────────────────────────

// `journaliser` refuse une cible qui n'est pas un UUID : les identifiants en sont.
const V1 = "00000000-0000-4000-8000-000000000001";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fauxClient(
  opts: {
    veille?: Record<string, unknown> | null;
    archivee?: boolean;
    journalEnPanne?: boolean;
  } = {},
) {
  const ecrits: Array<{ table: string; data: unknown }> = [];
  let transactionsOuvertes = 0;
  const veilleStockee =
    opts.veille === undefined
      ? {
          id: V1,
          type: "legale",
          source: "Légifrance",
          titre: "Décret 2026-728",
          contenu: "Référentiel à 33 indicateurs",
          dateVeille: t("2026-10-01T12:00:00Z"),
          impact: "Procédure qualité",
          actionDecidee: null,
          creeParId: "ia",
        }
      : opts.veille;
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    veille: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        ecrits.push({ table: "veilles", data });
        return { id: uuid(100 + ecrits.length) };
      }),
      findUnique: vi.fn().mockResolvedValue(veilleStockee),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: {
      findFirst: vi.fn().mockResolvedValue(opts.archivee ? { id: "a" } : null),
      create: vi.fn(async ({ data }: { data: unknown }) => {
        if (opts.journalEnPanne) throw new Error("activity_logs indisponible");
        ecrits.push({ table: "activity_logs", data });
        return {};
      }),
    },
  };
  const db = {
    $transaction: vi.fn(async (fn: (x: typeof tx) => Promise<unknown>) => {
      transactionsOuvertes += 1;
      return fn(tx);
    }),
  };
  return { db: db as never, tx, ecrits, transactions: () => transactionsOuvertes };
}

const maintenant = t("2026-10-16T22:30:00Z"); // 00:30 le 17 octobre à Paris

describe("les écritures de la veille tracée", () => {
  it("création : la ligne et sa trace dans UNE transaction, sans décision, date du jour de Paris par défaut", async () => {
    const c = fauxClient();
    await creerVeilleTracee(
      c.db,
      {
        type: "legale",
        source: " Légifrance ",
        titre: "Décret",
        contenu: "Analyse",
        auteurId: "ia-admin",
      },
      { maintenant },
    );
    expect(c.transactions()).toBe(1);
    expect(c.ecrits.map((e) => e.table)).toEqual(["veilles", "activity_logs"]);
    const data = c.ecrits[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("actionDecidee");
    expect(data["source"]).toBe("Légifrance");
    // Le conteneur est en UTC (16 octobre) ; à Paris, c'est déjà le 17.
    expect(data["dateVeille"]).toEqual(t("2026-10-17T12:00:00Z"));
    expect(data).not.toHaveProperty("createdAt"); // la date de saisie est celle du serveur de base
  });

  it("une date de l'information dans le futur (heure de Paris) est refusée", () => {
    expect(() => jourInformation(t("2026-10-18T00:00:00Z"), maintenant)).toThrow(RefusVeille);
    expect(jourInformation(t("2026-10-17T00:00:00Z"), maintenant)).toEqual(
      t("2026-10-17T12:00:00Z"),
    );
  });

  it("sans trace, pas d'écriture : l'échec du journal fait échouer la transaction", async () => {
    const c = fauxClient({ journalEnPanne: true });
    await expect(
      creerVeilleTracee(
        c.db,
        { type: "legale", source: "S", titre: "T", contenu: "C", auteurId: "a" },
        { maintenant },
      ),
    ).rejects.toThrow();
  });

  it("décider : nouvelle version portant la décision et son auteur ; l'ancienne est archivée, jamais réécrite", async () => {
    const c = fauxClient();
    await deciderVeille(c.db, {
      veilleId: V1,
      decision: "Mettre à jour la procédure P04",
      pieceModifiee: "Procédure P04 v3",
      auteurId: "will",
    });
    expect(c.tx.veille.update).not.toHaveBeenCalled();
    expect(c.tx.veille.delete).not.toHaveBeenCalled();
    const nouvelle = c.ecrits[0]?.data as Record<string, unknown>;
    expect(nouvelle).toMatchObject({
      actionDecidee: "Mettre à jour la procédure P04",
      creeParId: "will",
      type: "legale",
      dateVeille: t("2026-10-01T12:00:00Z"),
    });
    const actions = c.ecrits
      .filter((e) => e.table === "activity_logs")
      .map((e) => (e.data as { action: string }).action);
    expect(actions).toEqual([ACTION_JOURNAL_VEILLE.decision, ACTION_JOURNAL_VEILLE.archivage]);
    const decision = c.ecrits[1]?.data as { adminUserId: string; changes: Record<string, unknown> };
    expect(decision.adminUserId).toBe("will");
    expect(decision.changes).toMatchObject({ remplace: V1, pieceModifiee: "Procédure P04 v3" });
  });

  it("corriger : ni type ni date ne bougent, le motif est exigé, rien d'identique ne s'ajoute", async () => {
    const c = fauxClient();
    await expect(
      corrigerVeille(c.db, { veilleId: V1, titre: "Autre", motif: "court", auteurId: "w" }),
    ).rejects.toThrow(/Motif/);
    await expect(
      corrigerVeille(c.db, {
        veilleId: V1,
        titre: "Décret 2026-728",
        motif: "Rien ne change ici",
        auteurId: "w",
      }),
    ).rejects.toThrow(/rien n'a changé/);
    await corrigerVeille(c.db, {
      veilleId: V1,
      titre: "Décret n° 2026-728",
      motif: "Référence exacte du décret",
      auteurId: "w",
    });
    const nouvelle = c.ecrits.find((e) => e.table === "veilles")?.data as Record<string, unknown>;
    expect(nouvelle).toMatchObject({
      type: "legale",
      dateVeille: t("2026-10-01T12:00:00Z"),
      titre: "Décret n° 2026-728",
    });
    expect(c.tx.veille.update).not.toHaveBeenCalled();
  });

  it("une veille archivée ne se décide, ne se corrige ni ne s'archive plus", async () => {
    const c = fauxClient({ archivee: true });
    await expect(
      archiverVeille(c.db, { veilleId: V1, motif: "Doublon de l'entrée", auteurId: "w" }),
    ).rejects.toThrow(/archivée/);
    await expect(
      deciderVeille(c.db, {
        veilleId: V1,
        decision: "Décision tardive",
        pieceModifiee: "aucune",
        auteurId: "w",
      }),
    ).rejects.toThrow(/archivée/);
    expect(c.ecrits).toEqual([]);
  });

  it("archiver remplace la suppression : la ligne reste, l'archivage est au journal", async () => {
    const c = fauxClient();
    await archiverVeille(c.db, {
      veilleId: V1,
      motif: "Doublon de l'entrée du 1er",
      auteurId: "w",
    });
    expect(c.tx.veille.delete).not.toHaveBeenCalled();
    expect(c.ecrits).toEqual([
      {
        table: "activity_logs",
        data: expect.objectContaining({ action: ACTION_JOURNAL_VEILLE.archivage, targetId: V1 }),
      },
    ]);
  });
});
