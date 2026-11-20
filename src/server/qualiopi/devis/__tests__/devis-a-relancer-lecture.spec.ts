import { describe, expect, it, vi } from "vitest";
import { devisAvecRelanceRecente, devisRemisEnMainPropreParmi } from "../devis-a-relancer";
import { ACTION_REMIS_MAIN_PROPRE } from "../canal-emission";

const JOUR = 86_400_000;
const maintenant = new Date("2026-11-20T10:00:00Z");
const ilYa = (j: number) => new Date(maintenant.getTime() - j * JOUR);

type Ligne = {
  entityId: string;
  statut: "a_valider" | "approuve" | "envoye" | "refuse";
  createdAt: Date;
  approuveAt: Date | null;
  envoyeAt: Date | null;
};
type Where = Parameters<
  Parameters<typeof devisAvecRelanceRecente>[0]["emailOutbox"]["findMany"]
>[0]["where"];

/** Évalue le `where` reçu sur des lignes en mémoire : le test dépend donc du filtre réel. */
function lecteur(lignes: Ligne[]) {
  const findMany = vi.fn(async (args: { where: Where }) => {
    const { where } = args;
    return lignes
      .filter((l) => where.entityId.in.includes(l.entityId))
      .filter((l) =>
        where.OR.some((c) =>
          c.statut === "a_valider"
            ? l.statut === "a_valider"
            : (c.statut.in as string[]).includes(l.statut) &&
              c.OR.some((d) =>
                "approuveAt" in d
                  ? l.approuveAt !== null && l.approuveAt >= d.approuveAt.gte
                  : l.envoyeAt !== null && l.envoyeAt >= d.envoyeAt.gte,
              ),
        ),
      )
      .map((l) => ({ entityId: l.entityId }));
  });
  return { emailOutbox: { findMany }, findMany };
}

const ligne = (o: Partial<Ligne>): Ligne => ({
  entityId: "d1",
  statut: "a_valider",
  createdAt: ilYa(10),
  approuveAt: null,
  envoyeAt: null,
  ...o,
});

describe("devisAvecRelanceRecente : le where passé", () => {
  it("filtre sur le modèle, l'entité, les identifiants, les statuts et les dates d'approbation et d'envoi", async () => {
    const l = lecteur([]);
    await devisAvecRelanceRecente(l, ["d1", "d2"], maintenant);
    expect(l.findMany).toHaveBeenCalledTimes(1);
    expect(l.findMany).toHaveBeenCalledWith({
      where: {
        template: "relance-devis-client",
        entityType: "Devis",
        entityId: { in: ["d1", "d2"] },
        OR: [
          { statut: "a_valider" },
          {
            statut: { in: ["approuve", "envoye"] },
            OR: [{ approuveAt: { gte: ilYa(7) } }, { envoyeAt: { gte: ilYa(7) } }],
          },
        ],
      },
      select: { entityId: true },
    });
  });

  it("n'interroge pas la base sans candidat", async () => {
    const l = lecteur([]);
    expect((await devisAvecRelanceRecente(l, [], maintenant)).size).toBe(0);
    expect(l.findMany).not.toHaveBeenCalled();
  });
});

describe("devisAvecRelanceRecente : états réels", () => {
  const lis = async (lignes: Ligne[]) =>
    (await devisAvecRelanceRecente(lecteur(lignes), ["d1"], maintenant)).has("d1");

  it("relance garée il y a 10 jours, toujours a_valider : comptée", async () => {
    expect(await lis([ligne({})])).toBe(true);
  });
  it("garée il y a 10 jours, envoyée il y a 2 jours : comptée", async () => {
    expect(await lis([ligne({ statut: "envoye", approuveAt: ilYa(2), envoyeAt: ilYa(2) })])).toBe(
      true,
    );
  });
  it("envoyée il y a 8 jours : non comptée", async () => {
    expect(await lis([ligne({ statut: "envoye", approuveAt: ilYa(8), envoyeAt: ilYa(8) })])).toBe(
      false,
    );
  });
  it("approuvée il y a 2 jours : comptée", async () => {
    expect(await lis([ligne({ statut: "approuve", approuveAt: ilYa(2) })])).toBe(true);
  });
  it("refusée : non comptée", async () => {
    expect(await lis([ligne({ statut: "refuse", createdAt: ilYa(1) })])).toBe(false);
  });
});

describe("devisRemisEnMainPropreParmi", () => {
  it("une lecture groupée sur l'action de remise en main propre", async () => {
    const findMany = vi.fn(async (_args: unknown) => [{ targetId: "d2" }]);
    const r = await devisRemisEnMainPropreParmi({ activityLog: { findMany } }, ["d1", "d2"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        action: ACTION_REMIS_MAIN_PROPRE,
        targetType: "Devis",
        targetId: { in: ["d1", "d2"] },
      },
      select: { targetId: true },
    });
    expect([...r]).toEqual(["d2"]);
  });

  it("aucune lecture sans candidat", async () => {
    const findMany = vi.fn(async (_args: unknown) => []);
    await devisRemisEnMainPropreParmi({ activityLog: { findMany } }, []);
    expect(findMany).not.toHaveBeenCalled();
  });
});
