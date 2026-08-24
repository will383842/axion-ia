/**
 * La borne haute d'une série de sessions VOIT l'ancienne numérotation du
 * registre documentaire — ADR 0035 §5.
 *
 * ## Le constat que ce fichier ferme
 *
 * L'ADR 0035 annonce une collision **certaine**, en toutes lettres :
 * `documents_generes` porte déjà `AXI-SESS-2026-003` (une pièce
 * `positionnement`, émise sous l'ancienne numérotation, cf. §4) alors que
 * `training_sessions` s'arrête à `AXI-SESS-2026-002`. Le compteur des sessions
 * lisait la seule table des sessions : la prochaine session créée recevait donc
 * `-003` et portait le même numéro qu'une pièce du registre documentaire.
 *
 * Une collision de numéros entre deux registres n'est pas un incident
 * technique — rien ne plante, l'index `@unique` de chaque table est satisfait.
 * C'est un point d'audit : deux artefacts distincts portent la même référence.
 *
 * ## Pourquoi un test, et pas seulement le correctif
 *
 * 🔑 Le correctif est une lecture EN PLUS dans un lecteur de série. Rien, dans
 * la forme du code, ne signale qu'on ne doit pas la retirer : elle ressemble à
 * une requête redondante sur une table qui, en développement comme dans les
 * fixtures, ne ramène **jamais rien** (aucun `AXI-SESS-%` dans
 * `documents_generes` hors production — vérifié le 2026-08-23 sur la base
 * locale). C'est le profil parfait d'une ligne qu'une revue future supprime en
 * la croyant morte.
 *
 * Ce fichier est donc le seul endroit où l'héritage de production est REPRÉSENTÉ.
 * Il rougit si la lecture croisée disparaît.
 *
 * ⚠️ Ce test ne prouve pas l'unicité inter-registres en général : seule une
 * table `numero_registre` alimentée par tous les allocateurs le ferait (cf.
 * « ce qui reste ouvert » de l'ADR). Il prouve que la borne haute des sessions
 * n'est plus aveugle au registre documentaire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManySessions = vi.fn();
const findManyPieces = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...a: unknown[]) => findManySessions(...a) },
    documentGenere: { findMany: (...a: unknown[]) => findManyPieces(...a) },
  },
}));

const { allocateSessionNumero } = await import("./numbering");

const ANNEE = new Date().getFullYear();
const P = `AXI-SESS-${ANNEE}-`;

describe("allocateSessionNumero — borne haute inter-registres (ADR 0035 §5)", () => {
  beforeEach(() => {
    findManySessions.mockReset();
    findManyPieces.mockReset();
  });

  it("saute le numéro déjà porté par une pièce du registre documentaire", async () => {
    // L'état de production décrit par l'ADR, transposé sur le millésime courant.
    findManySessions.mockResolvedValue([{ numero: `${P}001` }, { numero: `${P}002` }]);
    findManyPieces.mockResolvedValue([{ numero: `${P}003` }]);

    expect(
      await allocateSessionNumero(),
      "la borne haute a ignoré `documents_generes` : la session créée porterait le numéro " +
        "d'une pièce déjà émise sous l'ancienne numérotation (ADR 0035 §4-§5). La lecture " +
        "croisée de `numbering.ts` a probablement été retirée — elle a l'air redondante " +
        "parce qu'elle ne ramène rien hors production.",
    ).toBe(`${P}004`);
  });

  it("interroge BIEN les deux registres, et sur le même préfixe", async () => {
    // 🔑 Sans ce cas, le précédent passerait encore si l'on interrogeait les
    // pièces sur un préfixe différent : la borne serait juste, par accident.
    findManySessions.mockResolvedValue([]);
    findManyPieces.mockResolvedValue([]);
    await allocateSessionNumero();

    expect(findManySessions).toHaveBeenCalledTimes(1);
    expect(findManyPieces, "le registre documentaire n'a pas été lu du tout").toHaveBeenCalledTimes(
      1,
    );
    const prefixeSessions = (
      findManySessions.mock.calls[0]?.[0] as { where: { numero: { startsWith: string } } }
    ).where.numero.startsWith;
    const prefixePieces = (
      findManyPieces.mock.calls[0]?.[0] as { where: { numero: { startsWith: string } } }
    ).where.numero.startsWith;
    expect(prefixePieces, "les deux registres sont lus sur des préfixes différents").toBe(
      prefixeSessions,
    );
    expect(prefixeSessions).toBe(P);
  });

  it("reste un no-op le jour où la branche A de l'ADR est jouée", async () => {
    // Après purge des 9 tirages antérieurs, `documents_generes` ne porte plus
    // aucun `AXI-SESS-%` : la lecture croisée ne doit alors rien changer.
    findManySessions.mockResolvedValue([{ numero: `${P}001` }, { numero: `${P}002` }]);
    findManyPieces.mockResolvedValue([]);
    expect(await allocateSessionNumero()).toBe(`${P}003`);
  });

  it("garde le suffixe de récurrence, qui ne consomme qu'un rang de série", async () => {
    findManySessions.mockResolvedValue([{ numero: `${P}002` }]);
    findManyPieces.mockResolvedValue([{ numero: `${P}003` }]);
    expect(await allocateSessionNumero({ recurrence: 2 })).toBe(`${P}004-R02`);
  });
});
