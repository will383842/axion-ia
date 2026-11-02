// @vitest-environment node
//
// Lot L3b — historique `origines` (ADR §2, I3, I4, I6) et synchro v3 éteinte par défaut (§3).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({ lignes: [] as Ligne[], verrous: 0, supprimes: 0, n: 0 }));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: async () => {
      bd.verrous++;
      return 1;
    },
    guideReseauOrigine: {
      createMany: async ({ data }: { data: Ligne }) => {
        const d = data as Ligne;
        if (
          bd.lignes.some(
            (l) => l.emailKey === d.emailKey && l.cleDedoublonnage === d.cleDedoublonnage,
          )
        )
          return { count: 0 };
        bd.lignes.push({ id: `o${++bd.n}`, archiveeLe: null, ...d });
        return { count: 1 };
      },
      findMany: async ({ where }: { where: Ligne }) =>
        bd.lignes
          .filter(
            (l) =>
              l.emailKey === where.emailKey &&
              (where.archiveeLe === null ? l.archiveeLe === null : true),
          )
          .sort((a, b) => +(a.occurredAt as Date) - +(b.occurredAt as Date)),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Ligne }) => {
        for (const l of bd.lignes) if (where.id.in.includes(l.id as string)) Object.assign(l, data);
        return { count: where.id.in.length };
      },
      count: async ({ where }: { where: Ligne }) =>
        bd.lignes.filter((l) => l.emailKey === where.emailKey && l.archiveeLe !== null).length,
      delete: async () => (bd.supprimes++, {}),
      deleteMany: async () => (bd.supprimes++, {}),
    },
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (f: (t: typeof tx) => Promise<unknown>) => f(tx),
    },
  };
});

import {
  cleDedoublonnage,
  construireOrigine,
  enregistrerOrigine,
  hmacCommentaireRef,
  PLAFOND_ORIGINES,
} from "../origines";
import { chargeCrmV3, MAX_ORIGINES_PAR_CHARGE, synchroCrmV3Active } from "../synchro-v3";
import { analyserCorps } from "../contrat";

const demandeV3 = (patch: Record<string, unknown> = {}) => {
  const r = analyserCorps(
    Buffer.from(
      JSON.stringify({
        schemaVersion: 3,
        cleIdempotence: "run_zernio_0001",
        email: "personne@exemple.test",
        mot: "guide",
        reseau: "instagram",
        guide: "guide-ia",
        accord: "non_demande",
        versionTexteM1: "m1-brouillon-v1",
        post_ref: "post_ref_test_01",
        canal: "commentaire",
        commentaire_ref: "comm_ref_test_01",
        ...patch,
      }),
    ),
  );
  if (!r.ok || !r.demande) throw new Error("fixture invalide");
  return r.demande;
};
const t = (i: number) => new Date(Date.UTC(2026, 10, 1, 10, 0, i));

beforeEach(() => {
  bd.lignes.length = 0;
  bd.verrous = 0;
  bd.supprimes = 0;
});

describe("origines", () => {
  it("commentaire_ref : HMAC de 64 hex, jamais le jeton brut, stable", () => {
    const h = hmacCommentaireRef("comm_ref_test_01");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hmacCommentaireRef("comm_ref_test_01"));
    expect(h).not.toContain("comm_ref_test_01");
  });
  it("la ligne écrite ne contient pas le jeton brut", async () => {
    await enregistrerOrigine("k1", construireOrigine(demandeV3(), t(0)));
    expect(JSON.stringify(bd.lignes)).not.toContain("comm_ref_test_01");
    expect(bd.lignes[0]?.commentaireRefHmac).toMatch(/^[0-9a-f]{64}$/);
  });
  it("idempotent : même (post_ref, canal, seconde) = une seule ligne", async () => {
    const o = construireOrigine(demandeV3(), t(0));
    await enregistrerOrigine("k1", o);
    const r = await enregistrerOrigine("k1", o);
    expect(r.creee).toBe(false);
    expect(bd.lignes).toHaveLength(1);
  });
  it("même post à une autre seconde = nouvelle entrée (union)", async () => {
    await enregistrerOrigine("k1", construireOrigine(demandeV3(), t(0)));
    await enregistrerOrigine("k1", construireOrigine(demandeV3(), t(1)));
    expect(bd.lignes).toHaveLength(2);
  });
  it("null traité comme une valeur (origine sans post_ref)", () => {
    const a = cleDedoublonnage(construireOrigine(demandeV3({ post_ref: undefined }), t(0)));
    const b = cleDedoublonnage(construireOrigine(demandeV3({ post_ref: "autre_post_01" }), t(0)));
    expect(a).not.toBe(b);
  });
  it("51e entrée : la plus ancienne est ARCHIVÉE, rien n'est supprimé, sous verrou", async () => {
    for (let i = 0; i < PLAFOND_ORIGINES + 1; i++) {
      await enregistrerOrigine("k1", construireOrigine(demandeV3(), t(i)));
    }
    expect(bd.lignes).toHaveLength(PLAFOND_ORIGINES + 1);
    const actives = bd.lignes.filter((l) => l.archiveeLe === null);
    expect(actives).toHaveLength(PLAFOND_ORIGINES);
    const archivee = bd.lignes.find((l) => l.archiveeLe !== null);
    expect(archivee?.occurredAt).toEqual(t(0));
    expect(bd.supprimes).toBe(0);
    expect(bd.verrous).toBe(PLAFOND_ORIGINES + 1);
  });
  it("une origine v1 (sans champs v3) s'enregistre aussi", async () => {
    const r = await enregistrerOrigine(
      "k1",
      construireOrigine(
        demandeV3({ post_ref: undefined, canal: undefined, commentaire_ref: undefined }),
        t(0),
      ),
    );
    expect(r.creee).toBe(true);
  });
});

describe("synchro v3 (§3)", () => {
  const ancien = process.env.SYNCHRO_CRM_V3;
  afterEach(() => {
    if (ancien === undefined) delete process.env.SYNCHRO_CRM_V3;
    else process.env.SYNCHRO_CRM_V3 = ancien;
  });
  it("éteinte par défaut", () => {
    delete process.env.SYNCHRO_CRM_V3;
    expect(synchroCrmV3Active()).toBe(false);
    process.env.SYNCHRO_CRM_V3 = "1";
    expect(synchroCrmV3Active()).toBe(false);
    process.env.SYNCHRO_CRM_V3 = "true";
    expect(synchroCrmV3Active()).toBe(true);
  });
  it("charge : schema_version 3, aucun champ de personne en plus, ≤ 20 entrées", () => {
    const o = construireOrigine(demandeV3(), t(0));
    const c = chargeCrmV3([o]);
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.charge.schema_version).toBe(3);
      expect(JSON.stringify(c.charge)).not.toContain("comm_ref_test_01");
      expect(JSON.stringify(c.charge)).not.toMatch(/pseudo|texte|nom/);
    }
  });
  it("plus de 20 origines : too_many_origines", () => {
    const o = construireOrigine(demandeV3(), t(0));
    const r = chargeCrmV3(Array.from({ length: MAX_ORIGINES_PAR_CHARGE + 1 }, () => o));
    expect(r).toEqual({ ok: false, erreur: "too_many_origines" });
  });
});
