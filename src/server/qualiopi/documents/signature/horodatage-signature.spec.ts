/**
 * Horodatage d'une signature : la signature ne dépend jamais de l'autorité, les réessais
 * s'espacent sans plafond d'essais, un jeton obtenu est définitif.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  signatureId: string;
  empreinteSha256: string;
  statut: "en_attente" | "obtenu";
  essais: number;
  prochainEssaiAt: Date;
  dernierEssaiAt: Date | null;
  derniereErreur: string | null;
  jeton: Buffer | null;
  jetonSha256: string | null;
  horodateAt: Date | null;
  autorite: string | null;
}
const table: Ligne[] = [];

function correspond(l: Ligne, w: Record<string, unknown>): boolean {
  return Object.entries(w).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && "lte" in (v as object)) {
      return (val as Date).getTime() <= (v as { lte: Date }).lte.getTime();
    }
    return val === v;
  });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureHorodatage: {
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const l of table) {
          if (!correspond(l, where)) continue;
          count++;
          for (const [k, v] of Object.entries(data)) {
            (l as unknown as Record<string, unknown>)[k] =
              v !== null && typeof v === "object" && "increment" in (v as object)
                ? (l as unknown as Record<string, number>)[k]! +
                  (v as { increment: number }).increment
                : v;
          }
        }
        return { count };
      },
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        table.find((l) =>
          where["id"] ? l.id === where["id"] : l.signatureId === where["signatureId"],
        ) ?? null,
      findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        table.filter((l) => correspond(l, where)).slice(0, take),
    },
  },
}));

const demander = vi.fn();
vi.mock("./horodatage-rfc3161", async (orig) => ({
  ...(await orig<typeof import("./horodatage-rfc3161")>()),
  demanderJeton: (...a: unknown[]) => demander(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { ErreurHorodatage } from "./horodatage-rfc3161";

const URL_TSA = "https://tsa.exemple.test/tsr";
const ENV = { HORODATAGE_TSA_URL: URL_TSA };
import {
  delaiAvantEssai,
  horodaterLigne,
  horodaterSignature,
  passerHorodatages,
} from "./horodatage-signature";

const prismaMock = prisma as unknown as {
  documentSignatureHorodatage: { findMany: (...a: unknown[]) => Promise<unknown> };
};

const T0 = new Date("2026-11-07T10:00:00.000Z");
const mn = (min: number) => new Date(T0.getTime() + min * 60_000);

function ligne(id = "h1"): Ligne {
  const l: Ligne = {
    id,
    signatureId: `s-${id}`,
    empreinteSha256: "ab".repeat(32),
    statut: "en_attente",
    essais: 0,
    prochainEssaiAt: T0,
    dernierEssaiAt: null,
    derniereErreur: null,
    jeton: null,
    jetonSha256: null,
    horodateAt: null,
    autorite: null,
  };
  table.push(l);
  return l;
}

const JETON = {
  jeton: Buffer.from("3003020101", "hex"),
  genTime: T0,
  autorite: "https://tsa.test/tsr",
};

beforeEach(() => {
  table.length = 0;
  demander.mockReset();
  vi.mocked(Sentry.captureException).mockClear();
});

describe("délai entre deux essais", () => {
  it("double à chaque échec, plafonné à 6 h, sans fin", () => {
    expect([1, 2, 3, 4].map((n) => delaiAvantEssai(n) / 60_000)).toEqual([5, 10, 20, 40]);
    expect(delaiAvantEssai(50)).toBe(6 * 60 * 60 * 1000);
    expect(delaiAvantEssai(10_000)).toBe(6 * 60 * 60 * 1000);
  });
});

describe("horodaterLigne", () => {
  it("obtient et stocke le jeton, son empreinte, son instant et l'autorité", async () => {
    const l = ligne();
    demander.mockResolvedValue(JETON);
    expect(await horodaterLigne("h1", { maintenant: T0, env: ENV })).toBe("obtenu");
    expect(l.statut).toBe("obtenu");
    expect(Buffer.from(l.jeton!).equals(JETON.jeton)).toBe(true);
    expect(l.jetonSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(l.horodateAt).toEqual(T0);
    expect(l.autorite).toBe("https://tsa.test/tsr");
    expect(demander).toHaveBeenCalledWith(
      expect.objectContaining({ empreinteHex: "ab".repeat(32), url: URL_TSA }),
    );
  });

  it("autorité injoignable : la ligne reste en attente, l'erreur est notée, l'essai suivant s'espace", async () => {
    const l = ligne();
    demander.mockRejectedValue(new ErreurHorodatage("autorité injoignable"));
    expect(await horodaterLigne("h1", { maintenant: T0, env: ENV })).toBe("en_attente");
    expect(l.statut).toBe("en_attente");
    expect(l.jeton).toBeNull();
    expect(l.derniereErreur).toBe("autorité injoignable");
    expect(l.prochainEssaiAt).toEqual(mn(5));
    // Pas dû avant l'échéance : aucun nouvel appel.
    expect(await horodaterLigne("h1", { maintenant: mn(4), env: ENV })).toBe("pas_du");
    expect(demander).toHaveBeenCalledTimes(1);
    // Dû ensuite : on réessaie, espacement doublé.
    expect(await horodaterLigne("h1", { maintenant: mn(5), env: ENV })).toBe("en_attente");
    expect(l.essais).toBe(2);
    expect(l.prochainEssaiAt).toEqual(mn(15));
  });

  it("n'écrit jamais autre chose qu'un message sûr quand l'erreur est inattendue", async () => {
    const l = ligne();
    demander.mockRejectedValue(new Error("connect ECONNREFUSED 10.1.2.3:443 token=abc"));
    await horodaterLigne("h1", { maintenant: T0, env: ENV });
    expect(l.derniereErreur).toBe("erreur inattendue");
  });

  it("deux passages simultanés : un seul demande un jeton", async () => {
    ligne();
    demander.mockResolvedValue(JETON);
    const [a, b] = await Promise.all([
      horodaterLigne("h1", { maintenant: T0, env: ENV }),
      horodaterLigne("h1", { maintenant: T0, env: ENV }),
    ]);
    expect([a, b].sort()).toEqual(["obtenu", "pas_du"]);
    expect(demander).toHaveBeenCalledTimes(1);
  });

  it("🔴 aucune autorité configurée : coupé, rien n'est demandé (pas d'autorité par défaut)", async () => {
    expect(await horodaterLigne("h1", { maintenant: T0, env: {} })).toBe("coupe");
    expect(demander).not.toHaveBeenCalled();
  });

  it("🔴 une URL non HTTPS en production : coupé, rien n'est demandé", async () => {
    const env = { HORODATAGE_TSA_URL: "http://time.exemple.test", NODE_ENV: "production" };
    expect(await horodaterLigne("h1", { maintenant: T0, env })).toBe("coupe");
    expect(demander).not.toHaveBeenCalled();
  });

  it("transmet les ancres de confiance de HORODATAGE_TSA_CA_PEM à la demande", async () => {
    ligne();
    demander.mockResolvedValue(JETON);
    const env = { ...ENV, HORODATAGE_TSA_CA_PEM: "PEM-PRIVE" };
    await horodaterLigne("h1", { maintenant: T0, env });
    expect(demander).toHaveBeenCalledWith(expect.objectContaining({ ancresPem: ["PEM-PRIVE"] }));
  });

  it("un jeton obtenu n'est jamais redemandé", async () => {
    const l = ligne();
    demander.mockResolvedValue(JETON);
    await horodaterLigne("h1", { maintenant: T0, env: ENV });
    expect(await horodaterLigne("h1", { maintenant: mn(60), env: ENV })).toBe("pas_du");
    expect(demander).toHaveBeenCalledTimes(1);
    expect(l.statut).toBe("obtenu");
  });

  it("horodatage coupé : aucune demande, la ligne reste intacte", async () => {
    const l = ligne();
    expect(
      await horodaterLigne("h1", { maintenant: T0, env: { HORODATAGE_DESACTIVE: "true" } }),
    ).toBe("coupe");
    expect(demander).not.toHaveBeenCalled();
    expect(l.essais).toBe(0);
  });

  it("n'a pas de plafond d'essais : le cent unième réessai part encore", async () => {
    const l = ligne();
    l.essais = 100;
    demander.mockResolvedValue(JETON);
    expect(await horodaterLigne("h1", { maintenant: T0, env: ENV })).toBe("obtenu");
  });
});

describe("horodaterSignature et balayage", () => {
  it("retrouve la ligne par sa signature", async () => {
    ligne();
    demander.mockResolvedValue(JETON);
    expect(await horodaterSignature("s-h1", { maintenant: T0, env: ENV })).toBe("obtenu");
    expect(await horodaterSignature("inconnue", { maintenant: T0, env: ENV })).toBe("inconnu");
  });

  it("le balayage reprend les lignes dues, pas les autres", async () => {
    ligne("a");
    const b = ligne("b");
    b.prochainEssaiAt = mn(30);
    const c = ligne("c");
    c.statut = "obtenu";
    demander.mockResolvedValue(JETON);
    const bilan = await passerHorodatages({ maintenant: T0, env: ENV });
    expect(bilan).toEqual({ tentes: 1, obtenus: 1, enAttente: 0 });
    expect(demander).toHaveBeenCalledTimes(1);
  });

  it("autorité en panne : le balayage compte les attentes et ne lève pas", async () => {
    ligne("a");
    ligne("b");
    demander.mockRejectedValue(new ErreurHorodatage("autorité : HTTP 503"));
    await expect(passerHorodatages({ maintenant: T0, env: ENV })).resolves.toEqual({
      tentes: 2,
      obtenus: 0,
      enAttente: 2,
    });
  });

  it("table pas encore migrée (worker en avance sur l'app) : balayage muet, aucune alerte", async () => {
    const orig = prismaMock.documentSignatureHorodatage.findMany;
    prismaMock.documentSignatureHorodatage.findMany = async () => {
      throw Object.assign(new Error("table absente"), { code: "P2021" });
    };
    try {
      await expect(passerHorodatages({ maintenant: T0, env: ENV })).resolves.toEqual({
        tentes: 0,
        obtenus: 0,
        enAttente: 0,
      });
      expect(Sentry.captureException).not.toHaveBeenCalled();
      // Toute AUTRE panne de base reste signalée.
      prismaMock.documentSignatureHorodatage.findMany = async () => {
        throw new Error("connexion perdue");
      };
      await passerHorodatages({ maintenant: T0, env: ENV });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    } finally {
      prismaMock.documentSignatureHorodatage.findMany = orig;
    }
  });

  it("autorité coupée : le balayage s'arrête au premier refus", async () => {
    ligne("a");
    ligne("b");
    const bilan = await passerHorodatages({
      maintenant: T0,
      env: { HORODATAGE_DESACTIVE: "true" },
    });
    expect(bilan.tentes).toBe(0);
    expect(demander).not.toHaveBeenCalled();
  });
});
