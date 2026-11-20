// @vitest-environment node
/**
 * Garde « un e-mail d'envoi de ce devis attend » (OUT-1) : une ligne « approuvé » compte QUEL QUE
 * SOIT SON ÂGE, en UNE requête, sans lire le journal. Le balayage de santé des e-mails est le seul
 * juge : c'est lui qui la remet « à valider » ou la passe « envoyé ».
 */
import { describe, expect, it, vi } from "vitest";
import { devisAvecEmailEnAttente, emailDevisEnAttente } from "./email-devis-en-attente";

type Ligne = {
  entityId: string;
  template: string;
  entityType: string;
  statut: "a_valider" | "approuve" | "envoye";
};
type Filtre = {
  template: string;
  entityType: string;
  entityId: string | { in: string[] };
  statut: { in: string[] };
};

/** Faux lecteur qui applique réellement le filtre demandé ; `emailLog` lèverait s'il était lu. */
function lecteur(lignes: Ligne[]) {
  const correspond = (l: Ligne, w: Filtre) =>
    l.template === w.template &&
    l.entityType === w.entityType &&
    (typeof w.entityId === "string"
      ? l.entityId === w.entityId
      : w.entityId.in.includes(l.entityId)) &&
    w.statut.in.includes(l.statut);
  const findFirst = vi.fn(async (args: { where: Filtre }) =>
    lignes.some((l) => correspond(l, args.where)) ? { id: "ob-1" } : null,
  );
  const findMany = vi.fn(async (args: { where: Filtre }) =>
    lignes.filter((l) => correspond(l, args.where)).map((l) => ({ entityId: l.entityId })),
  );
  const emailLog = new Proxy(
    {},
    {
      get() {
        throw new Error("le journal ne doit pas être lu");
      },
    },
  );
  return { db: { emailOutbox: { findFirst, findMany }, emailLog } as never, findFirst, findMany };
}

const ligne = (over: Partial<Ligne> & { entityId: string }): Ligne => ({
  template: "devis-envoi",
  entityType: "Devis",
  statut: "a_valider",
  ...over,
});

describe("emailDevisEnAttente", () => {
  it("« à valider » : en attente", async () => {
    const { db } = lecteur([ligne({ entityId: "d1" })]);
    expect(await emailDevisEnAttente(db, "d1")).toBe(true);
  });

  it("OUT-1 : « approuvé » (même de 3 h) : en attente, UNE requête, aucun journal lu", async () => {
    const { db, findFirst } = lecteur([ligne({ entityId: "d1", statut: "approuve" })]);
    expect(await emailDevisEnAttente(db, "d1")).toBe(true);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("« envoyé » ou autre gabarit : pas en attente", async () => {
    const { db } = lecteur([
      ligne({ entityId: "d1", statut: "envoye" }),
      ligne({ entityId: "d1", template: "facture-envoi" }),
    ]);
    expect(await emailDevisEnAttente(db, "d1")).toBe(false);
  });
});

describe("devisAvecEmailEnAttente (version groupée)", () => {
  it("une seule requête pour toute la liste, « approuvé » ancien compris", async () => {
    const { db, findMany } = lecteur([
      ligne({ entityId: "d1" }),
      ligne({ entityId: "d3", statut: "approuve" }),
    ]);
    const r = await devisAvecEmailEnAttente(db, ["d1", "d2", "d3"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect([...r].sort()).toEqual(["d1", "d3"]);
  });

  it("autre type de ligne (autre gabarit, autre entité, déjà envoyée) : ignoré", async () => {
    const { db } = lecteur([
      ligne({ entityId: "d1", template: "facture-envoi" }),
      ligne({ entityId: "d1", entityType: "Facture" }),
      ligne({ entityId: "d1", statut: "envoye" }),
    ]);
    expect((await devisAvecEmailEnAttente(db, ["d1"])).size).toBe(0);
  });

  it("liste vide : aucune requête ; identifiants en double : dédoublonnés", async () => {
    const { db, findMany } = lecteur([ligne({ entityId: "d1" })]);
    expect((await devisAvecEmailEnAttente(db, [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    await devisAvecEmailEnAttente(db, ["d1", "d1"]);
    expect((findMany.mock.calls[0]?.[0].where.entityId as { in: string[] }).in).toEqual(["d1"]);
  });
});
