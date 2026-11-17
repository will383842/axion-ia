// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../prisma/generated/client";
import {
  LOT,
  ReclassementRefuse,
  DELAI_TRANSACTION_MS,
  appliquer,
  cibleBase,
  classer,
  lire,
  lireArguments,
  lireDateAvant,
  requeteLecture,
  revenir,
  verifierBase,
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

const options_transaction: ({ timeout?: number } | undefined)[] = [];

function fausseBase(lignes: LigneDevis[], modifiees?: number) {
  const exec = vi.fn(async (_q: Prisma.Sql) => modifiees ?? lignes.length);
  const queries: string[] = [];
  const db: BaseReclassement = {
    $queryRaw: (async (q: Prisma.Sql) => {
      queries.push(q.sql);
      return lignes.map(brute);
    }) as BaseReclassement["$queryRaw"],
    $executeRaw: exec,
    $transaction: async (fn, options) => {
      options_transaction.push(options);
      return fn(db);
    },
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
  it("borne stricte : T pile est à revoir (jamais retenue), T - 1 ms est retenue", () => {
    const c = classer(
      [
        ligne({ id: "moins1ms", submittedAt: new Date(T.getTime() - 1) }),
        ligne({ id: "pile", submittedAt: new Date(T.getTime()) }),
      ],
      T,
    );
    expect(c.retenues.map((l) => l.id)).toEqual(["moins1ms"]);
    expect(c.aRevoirFenetre.map((l) => l.id)).toEqual(["pile"]);
  });
  it("fenêtre : T + 24 h - 1 ms est à revoir, T + 24 h pile et T + 24 h + 1 ms ne sont nulle part", () => {
    const fin = T.getTime() + 24 * 3600_000;
    const c = classer(
      [
        ligne({ id: "juste-avant", submittedAt: new Date(fin - 1) }),
        ligne({ id: "limite", submittedAt: new Date(fin) }),
        ligne({ id: "juste-apres", submittedAt: new Date(fin + 1) }),
      ],
      T,
    );
    expect(c.aRevoirFenetre.map((l) => l.id)).toEqual(["juste-avant"]);
    expect(c.retenues).toHaveLength(0);
    expect(c.aRevoirMission).toHaveLength(0);
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
    expect((await appliquer(db, { avant: T, attendu: 1 })).modifiees).toBe(1);
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
    await revenir(db, LOT, 0);
    const sql = exec.mock.calls[0]![0].sql;
    expect(sql).toContain("ancienType");
    expect(sql).toContain("ancienUnifiedType");
    expect(sql).toContain("reclassementAnnule");
    expect(sql).not.toMatch(/DELETE/i);
  });
});

describe("lireArguments", () => {
  it("--lire est le défaut, mais exige --avant", () => {
    expect(lireArguments(["--avant=2026-11-17T12:00:00Z"]).mode).toBe("lire");
    expect(() => lireArguments([])).toThrow(/--lire exige --avant/);
    expect(() => lireArguments(["--lire"])).toThrow(ReclassementRefuse);
  });
  it("--avant exige un fuseau (Z ou décalage)", () => {
    expect(() => lireArguments(["--lire", "--avant=2026-11-17T12:00:00"])).toThrow(/fuseau/);
    expect(() => lireArguments(["--lire", "--avant=2026-11-17T12:00:00.000"])).toThrow(/fuseau/);
    expect(lireArguments(["--lire", "--avant=2026-11-17T12:00:00+01:00"]).mode).toBe("lire");
    expect(lireArguments(["--lire", "--avant=2026-11-17T12:00:00.000Z"]).mode).toBe("lire");
  });
  it("--revenir exige --attendu, refuse une valeur illisible", () => {
    expect(lireArguments(["--revenir", "--lot=L", "--attendu=2", "--base=axion"])).toEqual({
      mode: "revenir",
      lot: "L",
      attendu: 2,
      base: "axion",
    });
    expect(() => lireArguments(["--revenir", "--lot=L", "--attendu=x", "--base=axion"])).toThrow(
      ReclassementRefuse,
    );
  });
  it("--revenir sans --attendu : refus lisible", () => {
    expect(() => lireArguments(["--revenir", "--lot=L", "--base=axion"])).toThrow(
      /--revenir exige --attendu/,
    );
  });
  it("--appliquer et --revenir exigent --base", () => {
    expect(() =>
      lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z", "--attendu=3"]),
    ).toThrow(/--appliquer exige --base/);
    expect(() => lireArguments(["--revenir", "--lot=L", "--attendu=2"])).toThrow(
      /--revenir exige --base/,
    );
    expect(() =>
      lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z", "--attendu=3", "--base="]),
    ).toThrow(ReclassementRefuse);
  });
  it("--lire n'exige pas --base", () => {
    expect(lireArguments(["--lire", "--avant=2026-11-17T12:00:00Z"]).mode).toBe("lire");
  });
  it("--avant : une date impossible est refusée, pas décalée", () => {
    for (const d of [
      "2026-02-30T00:00:00Z",
      "2026-13-01T00:00:00Z",
      "2026-04-31T10:00:00+01:00",
      "2026-11-17T24:00:00Z",
      "2026-11-17T12:60:00Z",
      "2026-11-17T12:00:60Z",
      "2026-11-17T12:00:00+25:00",
      "2026-11-17T12:00:00+01:75",
    ]) {
      expect(() => lireArguments(["--lire", `--avant=${d}`]), d).toThrow(ReclassementRefuse);
    }
    expect(() => lireArguments(["--lire", "--avant=2026-02-30T00:00:00Z"])).toThrow(/impossible/);
  });
  it("--avant : les dates réelles passent (29 février bissextile, décalage, millisecondes)", () => {
    expect(lireDateAvant("2028-02-29T23:59:59Z").toISOString()).toBe("2028-02-29T23:59:59.000Z");
    expect(lireDateAvant("2026-11-17T12:00:00+01:00").toISOString()).toBe(
      "2026-11-17T11:00:00.000Z",
    );
    expect(lireDateAvant("2026-11-17T12:00:00.500Z").getTime()).toBe(T.getTime() + 500);
    expect(() => lireDateAvant("2026-02-29T00:00:00Z")).toThrow(/impossible/);
  });
  it("--appliquer sans --avant ou sans --attendu : refus", () => {
    expect(() => lireArguments(["--appliquer", "--attendu=3"])).toThrow(ReclassementRefuse);
    expect(() => lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z"])).toThrow(
      ReclassementRefuse,
    );
  });
  it("--appliquer complet est accepté ; deux modes sont refusés", () => {
    expect(
      lireArguments(["--appliquer", "--avant=2026-11-17T12:00:00Z", "--attendu=3", "--base=axion"])
        .mode,
    ).toBe("appliquer");
    expect(() => lireArguments(["--lire", "--appliquer"])).toThrow(ReclassementRefuse);
  });
});

describe("fragments SQL (lecture ET écriture)", () => {
  const fragments = [
    /\(s?\.?details->'reclassement'\) IS NULL|\(details->'reclassement'\) IS NULL/,
    /details->>'source' = /,
    /details->>'unifiedType' = 'audit'/,
  ];
  it("la requête de lecture porte les quatre filtres, l'absence de reclassement comprise", () => {
    const sql = requeteLecture().sql;
    expect(sql).toMatch(/\(s\.details->'reclassement'\) IS NULL\s*\n?\s*ORDER/);
    for (const f of fragments.slice(1)) expect(sql).toMatch(f);
    expect(sql).toMatch(/s\.type = 'audit'::"SubmissionType"/);
  });
  it("l'UPDATE relit reclassement IS NULL, source, unifiedType et NOT EXISTS audit_missions", async () => {
    const { db, exec } = fausseBase([ligne()]);
    await appliquer(db, { avant: T, attendu: 1 });
    const sql = exec.mock.calls[0]![0].sql;
    for (const f of fragments) expect(sql).toMatch(f);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM audit_missions/);
    expect(sql).toMatch(/type = 'audit'::"SubmissionType"/);
  });
});

describe("idempotence de bout en bout", () => {
  it("un second appliquer sur des lignes déjà reclassées n'écrit rien", async () => {
    const etat = [ligne({ id: "a" }), ligne({ id: "b" })];
    const reclassees = new Set<string>();
    const ecritures: string[] = [];
    const db: BaseReclassement = {
      // Le faux client interprète le filtre SQL : si le fragment disparaît, les lignes reviennent.
      $queryRaw: (async (q: Prisma.Sql) => {
        const filtre = /details->'reclassement'\) IS NULL/.test(q.sql);
        return etat.filter((l) => !filtre || !reclassees.has(l.id)).map(brute);
      }) as BaseReclassement["$queryRaw"],
      $executeRaw: async (q: Prisma.Sql) => {
        ecritures.push(q.sql);
        const ids = q.values.find((v) => Array.isArray(v)) as string[];
        ids.forEach((i) => reclassees.add(i));
        return ids.length;
      },
      $transaction: async (fn) => fn(db),
    };
    const premier = await appliquer(db, { avant: T, attendu: 2 });
    expect(premier.modifiees).toBe(2);
    const second = await appliquer(db, { avant: T, attendu: 0 });
    expect(second.modifiees).toBe(0);
    expect(ecritures).toHaveLength(1);
  });
});

describe("appliquer : journal et transaction", () => {
  it("rend les identifiants et l'horodatage", async () => {
    const { db } = fausseBase([ligne({ id: "a" }), ligne({ id: "b" })]);
    const r = await appliquer(db, { avant: T, attendu: 2, maintenant: T });
    expect(r).toEqual({ modifiees: 2, identifiants: ["a", "b"], le: T.toISOString() });
  });
  it("transaction avec délai de 30 s (appliquer et revenir)", async () => {
    options_transaction.length = 0;
    const { db } = fausseBase([ligne()]);
    await appliquer(db, { avant: T, attendu: 1 });
    await revenir(db, LOT, 1);
    expect(options_transaction).toEqual([
      { timeout: DELAI_TRANSACTION_MS },
      { timeout: DELAI_TRANSACTION_MS },
    ]);
    expect(DELAI_TRANSACTION_MS).toBe(30000);
  });
});

describe("revenir : garde-fous", () => {
  it("ne touche qu'une ligne encore quote_request + devis (pas de retypage écrasé)", async () => {
    const { db, exec } = fausseBase([]);
    await revenir(db, LOT, 0);
    const sql = exec.mock.calls[0]![0].sql;
    expect(sql).toMatch(/type = 'quote_request'::"SubmissionType"/);
    expect(sql).toMatch(/details->>'unifiedType' = 'devis'/);
    expect(sql).toMatch(/details->'reclassement'->>'lot' = /);
  });
  it("conserve l'historique : tableau reclassementsAnnules, jamais d'écrasement", async () => {
    const { db, exec } = fausseBase([]);
    await revenir(db, LOT, 0);
    const sql = exec.mock.calls[0]![0].sql;
    expect(sql).toContain("reclassementsAnnules");
    expect(sql).toMatch(/COALESCE\(details->'reclassementsAnnules'/);
    expect(sql).toContain("jsonb_build_array(details->'reclassement')");
    expect(sql).not.toMatch(/'reclassementAnnule',/);
  });
  it("--attendu faux : retour arrière (la transaction lève)", async () => {
    const { db } = fausseBase([], 3);
    await expect(revenir(db, LOT, 2)).rejects.toThrow(/retour arrière/);
  });
  it("--attendu juste : passe", async () => {
    expect(await revenir(fausseBase([], 3).db, LOT, 3)).toEqual({ restituees: 3 });
  });
  it("--attendu absent ou invalide : refus, zéro écriture", async () => {
    const { db, exec } = fausseBase([], 3);
    await expect(revenir(db, LOT, undefined as unknown as number)).rejects.toBeInstanceOf(
      ReclassementRefuse,
    );
    await expect(revenir(db, LOT, -1)).rejects.toBeInstanceOf(ReclassementRefuse);
    expect(exec).not.toHaveBeenCalled();
  });
});

describe("cibleBase", () => {
  it("refuse l'absence d'URL, la base factice et une URL illisible", () => {
    expect(() => cibleBase(undefined)).toThrow(ReclassementRefuse);
    expect(() => cibleBase("")).toThrow(ReclassementRefuse);
    expect(() => cibleBase("postgresql://stub:stub@stub.invalid:5432/stub")).toThrow(/stub/);
    expect(() => cibleBase("pas une url")).toThrow(/illisible/);
  });
  it("rend hôte et nom, jamais utilisateur ni mot de passe", () => {
    const c = cibleBase("postgresql://monutilisateur:secretXYZ@db.exemple.test:5432/axion?x=1");
    expect(c).toEqual({ hote: "db.exemple.test:5432", base: "axion" });
    expect(JSON.stringify(c)).not.toMatch(/monutilisateur|secretXYZ/);
  });
});

describe("verifierBase", () => {
  it("accepte le nom exact, refuse tout autre nom avec un message lisible", () => {
    expect(() => verifierBase("axion", { base: "axion" })).not.toThrow();
    expect(() => verifierBase("axion_test", { base: "axion" })).toThrow(
      /ne correspond pas.*lu dans DATABASE_URL : axion\)/,
    );
    expect(() => verifierBase("Axion", { base: "axion" })).toThrow(ReclassementRefuse);
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
  it("le script exige --base avant toute écriture et affiche le nom à recopier", () => {
    const script = fichiers[1]!;
    expect(script).toMatch(/verifierBase\(cmd\.base, cible\)/);
    expect(script).toMatch(/--base=\$\{cible\.base\}/);
    expect(script.indexOf("verifierBase(cmd.base")).toBeLessThan(script.indexOf("appliquer(base"));
    expect(script).toMatch(/node_modules\/\.bin\/tsx/);
    expect(script).not.toMatch(/pnpm tsx/);
  });
  it("aucune suppression", () => {
    expect(code).not.toMatch(/\.delete\(|deleteMany|\bDELETE\b|\bTRUNCATE\b/i);
  });
  it("aucun import de file d'e-mails, de notification ou de CRM", () => {
    const imports = code.match(/from\s+"[^"]+"/g) ?? [];
    for (const i of imports) expect(i).not.toMatch(/queue|email|mail|notif|crm|outbox|bullmq/i);
  });
});
