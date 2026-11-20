// @vitest-environment node
/**
 * Garde « un e-mail d'envoi de ce devis attend » : une ligne « approuvé » ne bloque le devis que
 * pendant la fenêtre où l'envoi est réellement en cours. Au-delà, elle est abandonnée (conteneur
 * arrêté entre l'approbation et la mise en file) et ne doit pas verrouiller le devis pour toujours.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AGE_APPROUVE_ENCORE_EN_COURS_MIN,
  devisAvecEmailEnAttente,
  emailDevisEnAttente,
} from "./email-devis-en-attente";

type Ligne = { statut: "a_valider" | "approuve"; approuveAt: Date | null };
type Cond = { statut: "a_valider" } | { statut: "approuve"; approuveAt: { gte: Date } };

/**
 * Faux lecteur qui applique réellement le filtre demandé à une liste de lignes.
 * `journalPending` : identifiants de tâche (`outbox-<id>`) qui ont une ligne `pending` au journal.
 */
function lecteur(lignes: Ligne[], journalPending: string[] = []) {
  const findFirst = vi.fn(async (args: { where: { OR?: Cond[] } }) => {
    const conditions = args.where.OR;
    if (conditions === undefined) {
      // 2e question (OUT-1) : la ligne « approuvé » la plus récente.
      const ap = lignes.filter((l) => l.statut === "approuve");
      return ap.length > 0 ? { id: "ob-1", approuveAt: ap[0]?.approuveAt ?? null } : null;
    }
    const trouvee = lignes.find((l) =>
      conditions.some((c) => {
        if (c.statut !== l.statut) return false;
        if (c.statut === "a_valider") return true;
        return l.approuveAt !== null && l.approuveAt >= c.approuveAt.gte;
      }),
    );
    return trouvee ? { id: "ob-1" } : null;
  });
  const logFindFirst = vi.fn(async (args: { where: { jobId: string } }) =>
    journalPending.includes(args.where.jobId) ? { id: "log-1" } : null,
  );
  return { emailOutbox: { findFirst }, emailLog: { findFirst: logFindFirst } } as never;
}

const MAINTENANT = new Date("2026-11-18T12:00:00Z");
const ilYA = (min: number) => new Date(MAINTENANT.getTime() - min * 60_000);

describe("emailDevisEnAttente", () => {
  it("la fenêtre « approuvé » est de 15 minutes", () => {
    expect(AGE_APPROUVE_ENCORE_EN_COURS_MIN).toBe(15);
  });

  it("« approuvé » récent : en attente", async () => {
    const db = lecteur([{ statut: "approuve", approuveAt: ilYA(2) }]);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(true);
  });

  it("« approuvé » ancien : plus en attente", async () => {
    const db = lecteur([{ statut: "approuve", approuveAt: ilYA(16) }]);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(false);
  });

  it("« approuvé » sans date d'approbation : plus en attente", async () => {
    const db = lecteur([{ statut: "approuve", approuveAt: null }]);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(false);
  });

  it("« à valider » : en attente, quel que soit son âge", async () => {
    const db = lecteur([{ statut: "a_valider", approuveAt: null }]);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(true);
  });

  it("OUT-1 : « approuvé » de 20 min avec journal `pending` pour outbox-<id> : en attente", async () => {
    const db = lecteur([{ statut: "approuve", approuveAt: ilYA(20) }], ["outbox-ob-1"]);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(true);
  });

  it("OUT-1 : « approuvé » de 20 min sans journal : plus en attente", async () => {
    const db = lecteur([{ statut: "approuve", approuveAt: ilYA(20) }], []);
    expect(await emailDevisEnAttente(db, "d1", MAINTENANT)).toBe(false);
  });
});

type LigneGroupee = {
  entityId: string;
  template: string;
  entityType: string;
  statut: "a_valider" | "approuve" | "envoye";
  approuveAt: Date | null;
};
type FiltreGroupe = {
  template: string;
  entityType: string;
  entityId: { in: string[] };
  statut: { in: string[] };
};

/** Faux lecteur groupé : applique réellement le filtre demandé (gabarit, type, ids, statut). */
function lecteurGroupe(lignes: LigneGroupee[], journalPending: string[] = []) {
  const findMany = vi.fn(async (args: { where: FiltreGroupe }) => {
    const w = args.where;
    return lignes
      .filter(
        (l) =>
          l.template === w.template &&
          l.entityType === w.entityType &&
          w.entityId.in.includes(l.entityId) &&
          w.statut.in.includes(l.statut),
      )
      .map((l) => ({
        id: `ob-${l.entityId}`,
        entityId: l.entityId,
        statut: l.statut,
        approuveAt: l.approuveAt,
      }));
  });
  const logFindFirst = vi.fn(async (args: { where: { jobId: string } }) =>
    journalPending.includes(args.where.jobId) ? { id: "log-1" } : null,
  );
  return {
    db: { emailOutbox: { findMany }, emailLog: { findFirst: logFindFirst } } as never,
    findMany,
  };
}

const ligne = (over: Partial<LigneGroupee> & { entityId: string }): LigneGroupee => ({
  template: "devis-envoi",
  entityType: "Devis",
  statut: "a_valider",
  approuveAt: null,
  ...over,
});

describe("devisAvecEmailEnAttente (version groupée)", () => {
  it("une seule requête pour toute la liste, et rend les identifiants concernés", async () => {
    const { db, findMany } = lecteurGroupe([
      ligne({ entityId: "d1" }),
      ligne({ entityId: "d3", statut: "approuve", approuveAt: ilYA(1) }),
    ]);
    const r = await devisAvecEmailEnAttente(db, ["d1", "d2", "d3"], MAINTENANT);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect([...r].sort()).toEqual(["d1", "d3"]);
  });

  it("« à valider » : en attente, quel que soit son âge", async () => {
    const { db } = lecteurGroupe([ligne({ entityId: "d1" })]);
    expect((await devisAvecEmailEnAttente(db, ["d1"], MAINTENANT)).has("d1")).toBe(true);
  });

  it("« approuvé » récent : en attente", async () => {
    const { db } = lecteurGroupe([
      ligne({ entityId: "d1", statut: "approuve", approuveAt: ilYA(2) }),
    ]);
    expect((await devisAvecEmailEnAttente(db, ["d1"], MAINTENANT)).has("d1")).toBe(true);
  });

  it("« approuvé » de plus de 15 minutes : plus en attente", async () => {
    const { db } = lecteurGroupe([
      ligne({ entityId: "d1", statut: "approuve", approuveAt: ilYA(16) }),
    ]);
    expect((await devisAvecEmailEnAttente(db, ["d1"], MAINTENANT)).size).toBe(0);
  });

  it("« approuvé » sans date d'approbation : plus en attente", async () => {
    const { db } = lecteurGroupe([ligne({ entityId: "d1", statut: "approuve", approuveAt: null })]);
    expect((await devisAvecEmailEnAttente(db, ["d1"], MAINTENANT)).size).toBe(0);
  });

  it("autre type de ligne (autre gabarit, autre entité, déjà envoyée) : ignoré", async () => {
    const { db } = lecteurGroupe([
      ligne({ entityId: "d1", template: "facture-envoi" }),
      ligne({ entityId: "d1", entityType: "Facture" }),
      ligne({ entityId: "d1", statut: "envoye" }),
    ]);
    expect((await devisAvecEmailEnAttente(db, ["d1"], MAINTENANT)).size).toBe(0);
  });

  it("OUT-1 : « approuvé » de 20 min : en attente seulement avec un journal `pending`", async () => {
    const lignes = [
      ligne({ entityId: "d1", statut: "approuve", approuveAt: ilYA(20) }),
      ligne({ entityId: "d2", statut: "approuve", approuveAt: ilYA(20) }),
    ];
    const { db } = lecteurGroupe(lignes, ["outbox-ob-d1"]);
    expect([...(await devisAvecEmailEnAttente(db, ["d1", "d2"], MAINTENANT))]).toEqual(["d1"]);
  });

  it("liste vide : aucune requête", async () => {
    const { db, findMany } = lecteurGroupe([ligne({ entityId: "d1" })]);
    expect((await devisAvecEmailEnAttente(db, [], MAINTENANT)).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("identifiants en double : un seul passage, sans doublon dans la requête", async () => {
    const { db, findMany } = lecteurGroupe([ligne({ entityId: "d1" })]);
    await devisAvecEmailEnAttente(db, ["d1", "d1"], MAINTENANT);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0].where.entityId.in).toEqual(["d1"]);
  });
});
