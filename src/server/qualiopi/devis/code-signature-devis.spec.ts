/**
 * Code à usage unique du devis (lot 4 bis) : envoi sur clic, 10 minutes, 5 essais puis blocage de
 * 15 minutes, plafonds par lien, un seul code vivant, rien en clair dans la file.
 * Contre une table EN MÉMOIRE qui reproduit la sémantique des écritures conditionnelles.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  documentGenereId: string;
  partie: string;
  codeHash: string;
  expiresAt: Date;
  essais: number;
  utiliseAt: Date | null;
  invalideAt: Date | null;
  createdAt: Date;
  jetonId: string | null;
  bloqueJusquA: Date | null;
}
const table: Ligne[] = [];
let horloge = 0;
/** Instant simulé : la ligne créée est datée de la demande, pas de l'horloge réelle. */
let instantSimule = new Date(0);

type Filtre = Record<string, unknown>;
function correspond(l: Ligne, w: Filtre): boolean {
  return Object.entries(w).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { lt?: number; gte?: number; gt?: Date };
      if (o.lt !== undefined) return (val as number) < o.lt;
      if (o.gte !== undefined) return (val as number) >= o.gte;
      if (o.gt !== undefined) return val !== null && (val as Date).getTime() > o.gt.getTime();
    }
    return val === v;
  });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureCode: {
      create: async ({ data }: { data: Partial<Ligne> & { id: string } }) => {
        const l = {
          essais: 0,
          utiliseAt: null,
          invalideAt: null,
          jetonId: null,
          bloqueJusquA: null,
          createdAt: new Date(instantSimule.getTime() + ++horloge),
          ...data,
        } as Ligne;
        table.push(l);
        return l;
      },
      updateMany: async ({ where, data }: { where: Filtre; data: Record<string, unknown> }) => {
        let count = 0;
        for (const l of table) {
          if (!correspond(l, where)) continue;
          count++;
          for (const [k, v] of Object.entries(data)) {
            const r = l as unknown as Record<string, unknown>;
            r[k] =
              typeof v === "object" && v !== null && "increment" in v
                ? (r[k] as number) + (v as { increment: number }).increment
                : v;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: { where: Filtre }) =>
        [...table].reverse().find((l) => correspond(l, where)) ?? null,
      findMany: async ({ where }: { where: Filtre }) => table.filter((l) => correspond(l, where)),
      count: async ({ where }: { where: Filtre }) =>
        table.filter((l) => correspond(l, where)).length,
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

const enqueue = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/server/email/code-en-file", () => ({
  CLE_CODE_SIGNATURE: "codeSignatureId",
  scellerCodePourFile: (c: string) => `enc:v2:${Buffer.from(c).toString("base64")}`,
}));

import {
  CODE_ESSAIS_MAX,
  MESSAGE_CODE_BLOQUE,
  MESSAGE_CODE_REFUSE,
  verifierCodeSignature,
} from "@/server/qualiopi/documents/signature/code-signature";
import { envoyerCodeDevis } from "./code-signature-devis";
import { CODE_DEVIS_BLOCAGE_MS, CODE_DEVIS_VALIDITE_MS } from "./signature-renforcee";

const PIECE = "11111111-1111-4111-8111-111111111111";
const LIEN = "22222222-2222-4222-8222-222222222222";
const T0 = new Date("2026-11-07T10:00:00.000Z");
const apres = (ms: number) => new Date(T0.getTime() + ms);

/** Le code en clair, retrouvé dans le payload scellé de l'e-mail enfilé (le test joue le worker). */
function dernierCode(): string {
  const payload = enqueue.mock.calls.at(-1)![3] as { valeurs: { code: string } };
  return Buffer.from(payload.valeurs.code.replace("enc:v2:", ""), "base64").toString();
}

const demander = (maintenant: Date, over: Partial<Parameters<typeof envoyerCodeDevis>[0]> = {}) => {
  instantSimule = maintenant;
  return envoyerCodeDevis({
    documentGenereId: PIECE,
    jetonId: LIEN,
    destinataire: "signataire@client.test",
    numeroDevis: "AXI-2026-001",
    maintenant,
    ...over,
  });
};

const verifier = (code: string, maintenant: Date) =>
  verifierCodeSignature({
    documentGenereId: PIECE,
    partie: "client",
    code,
    maintenant,
    blocageMs: CODE_DEVIS_BLOCAGE_MS,
  });

beforeEach(() => {
  table.length = 0;
  horloge = 0;
  enqueue.mockClear();
  process.env["AUTH_SECRET"] = "secret-de-test-secret-de-test-secret";
});

describe("envoi du code du devis", () => {
  it("part à l'adresse figée, scellé, avec la ligne du code ; jamais le code en clair", async () => {
    const r = await demander(T0);
    expect(r).toEqual({ ok: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, to, , payload, options] = enqueue.mock.calls[0]!;
    expect(gabarit).toBe("devis-code-signature");
    expect(to).toBe("signataire@client.test");
    const p = payload as { valeurs: { code: string; durée: string }; codeSignatureId: string };
    expect(p.valeurs.code.startsWith("enc:v2:")).toBe(true);
    expect(p.valeurs.durée).toBe("10 minutes");
    expect(p.codeSignatureId).toBe(table[0]!.id);
    expect(options).toMatchObject({ entityType: "DocumentGenere", entityId: PIECE });
    // Le clair n'apparaît ni dans le payload sérialisé ni dans la base.
    const clair = dernierCode();
    expect(JSON.stringify(payload)).not.toContain(`"${clair}"`);
    expect(JSON.stringify(table)).not.toContain(clair);
    expect(table[0]!.jetonId).toBe(LIEN);
  });

  it("le code vit 10 minutes exactement", async () => {
    await demander(T0);
    expect(table[0]!.expiresAt.getTime() - T0.getTime()).toBe(CODE_DEVIS_VALIDITE_MS);
    const code = dernierCode();
    expect((await verifier(code, apres(CODE_DEVIS_VALIDITE_MS - 1))).ok).toBe(true);
  });

  it("un code expiré est refusé comme un code faux", async () => {
    await demander(T0);
    const code = dernierCode();
    const r = await verifier(code, apres(CODE_DEVIS_VALIDITE_MS + 1));
    expect(r).toEqual({ ok: false, message: MESSAGE_CODE_REFUSE });
  });

  it("un code déjà utilisé ne sert pas deux fois (rejeu)", async () => {
    await demander(T0);
    const code = dernierCode();
    expect((await verifier(code, apres(1000))).ok).toBe(true);
    expect(await verifier(code, apres(2000))).toEqual({ ok: false, message: MESSAGE_CODE_REFUSE });
  });

  it("deux onglets : le second code remplace le premier, qui ne vaut plus rien", async () => {
    await demander(T0);
    const premier = dernierCode();
    await demander(apres(61_000));
    const second = dernierCode();
    expect(second).not.toBe(premier);
    expect((await verifier(premier, apres(62_000))).ok).toBe(false);
    expect((await verifier(second, apres(63_000))).ok).toBe(true);
  });

  it("double clic : de deux demandes simultanées, un seul e-mail part", async () => {
    const [a, b] = await Promise.all([demander(T0), demander(T0)]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });

  it("pas deux envois à moins d'une minute, puis le renvoi est permis", async () => {
    await demander(T0);
    const trop = await demander(apres(30_000));
    expect(trop).toMatchObject({ ok: false, raison: "trop_tot" });
    expect(await demander(apres(61_000))).toEqual({ ok: true });
  });

  it("au plus 5 envois par heure pour un même lien", async () => {
    for (let i = 0; i < 5; i++) expect((await demander(apres(i * 61_000))).ok).toBe(true);
    const r = await demander(apres(5 * 61_000));
    expect(r).toMatchObject({ ok: false, raison: "trop_de_codes" });
    // L'heure écoulée, le compteur repart.
    expect((await demander(apres(66 * 60_000))).ok).toBe(true);
  });

  it("sans clé de scellement ou sans secret : aucun code n'est émis", async () => {
    delete process.env["AUTH_SECRET"];
    const r = await demander(T0);
    expect(r).toMatchObject({ ok: false, raison: "envoi_impossible" });
    expect(table).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("file indisponible : refus explicite, jamais un faux succès", async () => {
    enqueue.mockResolvedValueOnce({ enqueued: false });
    expect(await demander(T0)).toMatchObject({ ok: false, raison: "envoi_impossible" });
    enqueue.mockRejectedValueOnce(new Error("redis"));
    expect(await demander(apres(61_000))).toMatchObject({ ok: false, raison: "envoi_impossible" });
  });
});

describe("trop d'essais : blocage de 15 minutes", () => {
  it("cinq codes faux bloquent la pièce ; le bon code ne passe plus, aucun nouveau code ne part", async () => {
    await demander(T0);
    const bon = dernierCode();
    const faux = bon === "000000" ? "111111" : "000000";
    for (let i = 1; i < CODE_ESSAIS_MAX; i++) {
      expect(await verifier(faux, apres(i * 1000))).toEqual({
        ok: false,
        message: MESSAGE_CODE_REFUSE,
      });
    }
    // Le cinquième échec bloque.
    expect(await verifier(faux, apres(5000))).toEqual({
      ok: false,
      message: MESSAGE_CODE_BLOQUE,
      bloque: true,
    });
    // Même le bon code est refusé pendant le blocage.
    expect(await verifier(bon, apres(6000))).toMatchObject({ ok: false, bloque: true });
    // Aucun nouveau code ne part.
    enqueue.mockClear();
    expect(await demander(apres(120_000))).toMatchObject({ ok: false, raison: "bloque" });
    expect(enqueue).not.toHaveBeenCalled();
    // Le blocage tombe après 15 minutes : un nouveau code est émis et accepté.
    const fin = apres(5000 + CODE_DEVIS_BLOCAGE_MS + 1);
    expect(await demander(fin)).toEqual({ ok: true });
    expect((await verifier(dernierCode(), apres(5000 + CODE_DEVIS_BLOCAGE_MS + 2))).ok).toBe(true);
  });

  it("le cinquième essai peut encore réussir (cinq essais, bon code compris)", async () => {
    await demander(T0);
    const bon = dernierCode();
    const faux = bon === "000000" ? "111111" : "000000";
    for (let i = 1; i < CODE_ESSAIS_MAX; i++) await verifier(faux, apres(i * 1000));
    expect((await verifier(bon, apres(5000))).ok).toBe(true);
  });

  it("un code mal formé est refusé sans coûter d'essai", async () => {
    await demander(T0);
    for (let i = 0; i < 10; i++) await verifier("abc", apres(i * 100));
    expect(table[0]!.essais).toBe(0);
    expect((await verifier(dernierCode(), apres(2000))).ok).toBe(true);
  });
});
