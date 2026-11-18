// @vitest-environment node
/**
 * Garde « un e-mail d'envoi de ce devis attend » : une ligne « approuvé » ne bloque le devis que
 * pendant la fenêtre où l'envoi est réellement en cours. Au-delà, elle est abandonnée (conteneur
 * arrêté entre l'approbation et la mise en file) et ne doit pas verrouiller le devis pour toujours.
 */
import { describe, expect, it, vi } from "vitest";
import { AGE_APPROUVE_ENCORE_EN_COURS_MIN, emailDevisEnAttente } from "./email-devis-en-attente";

type Ligne = { statut: "a_valider" | "approuve"; approuveAt: Date | null };
type Cond = { statut: "a_valider" } | { statut: "approuve"; approuveAt: { gte: Date } };

/** Faux lecteur qui applique réellement le filtre demandé à une liste de lignes. */
function lecteur(lignes: Ligne[]) {
  const findFirst = vi.fn(async (args: { where: { OR: Cond[] } }) => {
    const trouvee = lignes.find((l) =>
      args.where.OR.some((c) => {
        if (c.statut !== l.statut) return false;
        if (c.statut === "a_valider") return true;
        return l.approuveAt !== null && l.approuveAt >= c.approuveAt.gte;
      }),
    );
    return trouvee ? { id: "ob-1" } : null;
  });
  return { emailOutbox: { findFirst } } as never;
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
});
