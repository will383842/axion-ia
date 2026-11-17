// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../prisma/generated/client";
import {
  LOT,
  ReclassementRefuse,
  appliquer,
  classer,
  lire,
  lireArguments,
  requeteLecture,
  revenir,
  type BaseReclassement,
  type LigneDevis,
} from "../reclasser-demandes-devis";

const T = new Date("2026-11-17T12:00:00Z");
const avant = (h: number) => new Date(T.getTime() - h * 3600_000);
const apres = (h: number) => new Date(T.getTime() + h * 3600_000);

function ligne(o: Partial<LigneDevis> = {}): LigneDevis {
  return {
    id: "id-1",
    type: "audit",
    status: "new",
    submittedAt: avant(48),
    source: "/demande-devis",
    unifiedType: "audit",
    subType: "automatisation",
    dejaReclassee: false,
    missionLiee: false,
    ...o,
  };
}

function brute(l: LigneDevis) {
  return {
    id: l.id,
    type: l.type,
    status: l.status,
    submitted_at: l.submittedAt,
    source: l.source,
    unified_type: l.unifiedType,
    sub_type: l.subType,
    deja_reclassee: l.dejaReclassee,
    mission_liee: l.missionLiee,
  };
}

function fausseBase(lignes: LigneDevis[], modifiees?: number) {
  const exec = vi.fn(async (_q: Prisma.Sql) => modifiees ?? lignes.length);
  const queries: string[] = [];
  const db: BaseReclassement = {
    $queryRaw: (async (q: Prisma.Sql) => {
      queries.push(q.sql);
      return lignes.map(brute);
    }) as BaseReclassement["$queryRaw"],
    $executeRaw: exec,
    $transaction: async (fn) => fn(db),
  };
  return { db, exec, queries };
}

describe("classer", () => {
  it("retient une ligne conforme", () => {
    expect(classer([ligne()], T).retenues).toHaveLength(1);
  });
  it("exclut la source /audit/demande", () => {
    expect(classer([ligne({ source: "/audit/demande" })], T).retenues).toHaveLength(0);
  });
  it("exclut unifiedType déjà devis", () => {
    expect(classer([ligne({ unifiedType: "devis" })], T).retenues).toHaveLength(0);
  });
  it("exclut le type intervention", () => {
    expect(classer([ligne({ type: "intervention" })], T).retenues).toHaveLength(0);
  });
  it("exclut une ligne postérieure à T, et la liste à revoir si < T + 24 h", () => {
    const c = classer(
      [ligne({ id: "a", submittedAt: apres(2) }), ligne({ id: "b", submittedAt: apres(30) })],
      T,
    );
    expect(c.retenues).toHaveLength(0);
    expect(c.aRevoirFenetre.map((l) => l.id)).toEqual(["a"]);
  });
  it("exclut une ligne déjà reclassée", () => {
    expect(classer([ligne({ dejaReclassee: true })], T).retenues).toHaveLength(0);
  });
  it("exclut et liste une ligne avec mission liée", () => {
    const c = classer([ligne({ missionLiee: true })], T);
    expect(c.retenues).toHaveLength(0);
    expect(c.aRevoirMission).toHaveLength(1);
  });
});

describe("lire", () => {
  it("n'appelle jamais $executeRaw et ne rend aucune donnée de personne", async () => {
    const { db, exec } = fausseBase([ligne(), ligne({ id: "id-2", subType: null })]);
    const r = await lire(db, T);
    expect(exec).not.toHaveBeenCalled();
    expect(r.total).toBe(2);
    expect(r.parMois).toEqual({ "2026-11": 2 });
    expect(r.parSousType).toEqual({ automatisation: 1, "(aucun)": 1 });
    expect(Object.keys(r).sort()).toEqual([
      "aRevoirFenetre",
      "aRevoirMission",
      "identifiants",
      "parMois",
      "parSousType",
      "parStatut",
      "total",
    ]);
  });
  it("la requête de lecture ne nomme ni contact_name, ni contact_email, ni details entier", () => {
    const sql = requeteLecture().sql;
    expect(sql).not.toMatch(/contact_name|contact_email|contact_phone/);
    expect(sql.replace(/details->>?'[a-zA-Z]+'|details->'[a-zA-Z]+'/g, "")).not.toMatch(/details/);
  });
});

describe("appliquer", () => {
  it("refuse sans --avant valide : zéro écriture", async () => {
    const { db, exec } = fausseBase([ligne()]);
    await expect(appliquer(db, { avant: new Date("x"), attendu: 1 })).rejects.toBeInstanceOf(
      ReclassementRefuse,
    );
    expect(exec).not.toHaveBeenCalled();
  });
  it("refuse un --attendu faux : zéro écriture", async () => {
    const { db, exec } = fausseBase([ligne()]);
    await expect(appliquer(db, { avant: T, attendu: 5 })).rejects.toThrow(/différent/);
    expect(exec).not.toHaveBeenCalled();
  });
  it("écart de lignes modifiées : retour arrière (la transaction lève)", async () => {
    const { db } = fausseBase([ligne()], 0);
    await expect(appliquer(db, { avant: T, attendu: 1 })).rejects.toThrow(/retour arrière/);
  });
  it("écrit une fois, avec les bonnes conditions, sans toucher updated_at ni status", async () => {
    const { db, exec } = fausseBase([ligne()]);
    expect(await appliquer(db, { avant: T, attendu: 1 })).toEqual({ modifiees: 1 });
    expect(exec).toHaveBeenCalledTimes(1);
    const q = exec.mock.calls[0]![0];
    expect(q.sql).toContain(`'quote_request'::"SubmissionType"`);
    expect(q.sql).toContain("jsonb_set");
    expect(q.sql).not.toMatch(/updated_at|status|sub_?type/i);
    expect(q.sql).toMatch(/audit_missions/);
    expect(q.values.some((v) => typeof v === "string" && v.includes(LOT))).toBe(true);
  });
});

describe("revenir", () => {
  it("restitue d'après details.reclassement et garde la trace", async () => {
    const { db, exec } = fausseBase([]);
    await revenir(db, LOT);
    const sql = exec.mock.calls[0]![0].sql;
    expect(sql).toContain("ancienType");
    expect(sql).toContain("ancienUnifiedType");
    expect(sql).toContain("reclassementAnnule");
    expect(sql).not.toMatch(/DELETE/i);
  });
});

describe("lireArguments", () => {
  it("--lire est le défaut", () => {
    expect(lireArguments([]).mode).toBe("lire");
  });
  it("--appliquer sans --avant ou sans --attendu : refus", () => {
    expect(() => lireArguments(["--appliquer", "--attendu=3"])).toThrow(ReclassementRefuse);
    expect(() => lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z"])).toThrow(
      ReclassementRefuse,
    );
  });
  it("--appliquer complet est accepté ; deux modes sont refusés", () => {
    expect(lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z", "--attendu=3"]).mode).toBe(
      "appliquer",
    );
    expect(() => lireArguments(["--lire", "--appliquer"])).toThrow(ReclassementRefuse);
  });
});

describe("garde de source", () => {
  const racine = path.resolve(__dirname, "../../../..");
  const fichiers = [
    "src/server/donnees/reclasser-demandes-devis.ts",
    "prisma/scripts/reclasser-demandes-devis-2026-11-17.ts",
  ].map((f) => readFileSync(path.join(racine, f), "utf8"));
  const code = fichiers
    .map((f) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
    .join("\n");
  it("aucune suppression", () => {
    expect(code).not.toMatch(/\.delete\(|deleteMany|\bDELETE\b|\bTRUNCATE\b/i);
  });
  it("aucun import de file d'e-mails, de notification ou de CRM", () => {
    const imports = code.match(/from\s+"[^"]+"/g) ?? [];
    for (const i of imports) expect(i).not.toMatch(/queue|email|mail|notif|crm|outbox|bullmq/i);
  });
});
