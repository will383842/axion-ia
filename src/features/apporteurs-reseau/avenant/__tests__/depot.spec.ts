import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown> & {
  id: string;
  apporteurId: string;
  statut: string;
  numero: number;
};
type Arg = {
  where: Record<string, unknown> & {
    id?: string;
    apporteurId?: string;
    statut?: unknown;
    enregistreAt?: unknown;
  };
  data: Record<string, unknown>;
  orderBy?: unknown;
};
const lignes: Ligne[] = [];
let seq = 0;

vi.mock("@/lib/prisma", () => {
  const actif = (l: Ligne) => ["propose", "accepte", "enregistre"].includes(l.statut);
  return {
    prisma: {
      apporteurAvenant: {
        findFirst: vi.fn(async ({ where, orderBy }: Arg) => {
          let r = lignes.filter((l) => l.apporteurId === where.apporteurId);
          if (where.statut) r = r.filter(actif);
          if (orderBy) r = [...r].sort((a, b) => b.numero - a.numero);
          return r[0] ?? null;
        }),
        findUnique: vi.fn(async ({ where }: Arg) => lignes.find((l) => l.id === where.id) ?? null),
        create: vi.fn(async ({ data }: Arg) => {
          if (
            lignes.some(
              (l) => l.apporteurId === data.apporteurId && actif(l) && actif(data as Ligne),
            )
          ) {
            throw Object.assign(new Error("unique"), { code: "P2002" });
          }
          const l = { id: `id-${++seq}`, enregistreAt: null, ...data } as unknown as Ligne;
          lignes.push(l);
          return l;
        }),
        updateMany: vi.fn(async ({ where, data }: Arg) => {
          const l = lignes.find(
            (x) =>
              x.id === where.id &&
              x.statut === where.statut &&
              (where.enregistreAt !== null || x.enregistreAt === null),
          );
          if (!l) return { count: 0 };
          Object.assign(l, data);
          return { count: 1 };
        }),
      },
    },
  };
});

import {
  AvenantErreur,
  STATUTS_AVENANT,
  avenantActif,
  changerStatut,
  creerProposition,
  transitionAutorisee,
} from "../depot";

const A = "00000000-0000-4000-8000-000000000001";
const entree = (apporteurId = A) => ({
  apporteurId,
  versionCible: "2.8",
  versionDepart: "2.6",
  texteAvenant: "Texte fictif de l'avenant.",
  texteAvenantSha256: "a".repeat(64),
  texteContratSha256: "b".repeat(64),
});

beforeEach(() => {
  lignes.length = 0;
  seq = 0;
});

describe("transitions de statut", () => {
  const permises = new Set([
    "propose>accepte",
    "propose>decline",
    "propose>retire",
    "accepte>enregistre",
    "accepte>retire",
  ]);
  for (const de of STATUTS_AVENANT)
    for (const vers of STATUTS_AVENANT)
      it(`${de} → ${vers} : ${permises.has(`${de}>${vers}`) ? "permise" : "interdite"}`, () => {
        expect(transitionAutorisee(de, vers)).toBe(permises.has(`${de}>${vers}`));
      });
});

describe("dépôt des avenants", () => {
  it("crée une proposition numérotée à partir de 1", async () => {
    const l = await creerProposition(entree());
    expect(l.statut).toBe("propose");
    expect(l.numero).toBe(1);
    expect((await avenantActif(A))?.id).toBe(l.id);
  });

  it("refuse une seconde ligne active pour le même apporteur", async () => {
    await creerProposition(entree());
    await expect(creerProposition(entree())).rejects.toMatchObject({ code: "deja_actif" });
  });

  it("traduit un refus de l'index unique en erreur claire", async () => {
    await creerProposition(entree());
    // l'index partiel gagne la course même si la lecture ne voyait rien
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.apporteurAvenant.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(creerProposition(entree())).rejects.toBeInstanceOf(AvenantErreur);
  });

  it("autorise une nouvelle proposition après un refus, numéro suivant", async () => {
    const l = await creerProposition(entree());
    await changerStatut(l.id, "decline");
    expect(await avenantActif(A)).toBeNull();
    const l2 = await creerProposition(entree());
    expect(l2.numero).toBe(2);
  });

  it("une autre personne n'est pas gênée", async () => {
    await creerProposition(entree());
    await expect(
      creerProposition(entree("00000000-0000-4000-8000-000000000002")),
    ).resolves.toBeTruthy();
  });

  it("refuse les transitions interdites", async () => {
    const l = await creerProposition(entree());
    await expect(changerStatut(l.id, "enregistre")).rejects.toMatchObject({
      code: "transition_interdite",
    });
    await changerStatut(l.id, "decline");
    await expect(changerStatut(l.id, "accepte")).rejects.toMatchObject({
      code: "transition_interdite",
    });
  });

  it("introuvable", async () => {
    await expect(changerStatut("nope", "retire")).rejects.toMatchObject({ code: "introuvable" });
  });

  it("accepte puis enregistre : preuve gardée, date d'effet fixée une seule fois", async () => {
    const l = await creerProposition(entree());
    const acc = await changerStatut(l.id, "accepte", { preuve: { cases: [true, true] } });
    expect(acc?.accepteAt).toBeInstanceOf(Date);
    expect(acc?.preuve).toEqual({ cases: [true, true] });
    const effet = new Date("2026-12-01T00:00:00Z");
    const enr = await changerStatut(l.id, "enregistre", {
      enregistreAt: effet,
      pdfCle: "cle/x.pdf",
    });
    expect(enr?.enregistreAt).toEqual(effet);
    expect(enr?.pdfCle).toBe("cle/x.pdf");
    // enregistré : plus aucune sortie, la date d'effet ne bouge pas
    await expect(changerStatut(l.id, "retire")).rejects.toMatchObject({
      code: "transition_interdite",
    });
    expect(lignes[0]?.enregistreAt).toEqual(effet);
  });

  it("signale une ligne modifiée entre la lecture et l'écriture", async () => {
    const l = await creerProposition(entree());
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.apporteurAvenant.updateMany).mockResolvedValueOnce({ count: 0 });
    await expect(changerStatut(l.id, "retire")).rejects.toMatchObject({ code: "ligne_changee" });
  });
});
