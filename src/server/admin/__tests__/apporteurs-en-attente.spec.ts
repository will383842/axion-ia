/**
 * La tuile « Apporteurs en attente » compte des PERSONNES (2026-09-21).
 *
 * ── Pourquoi une tuile, et pas une alerte ─────────────────────────────────
 * Mesure du 19/09 en production (R7) : 15 personnes en attente, la plus
 * ancienne depuis 26 JOURS. Un seuil de quelques heures aurait sonné dès le
 * premier jour et n'aurait plus jamais cessé — et une alerte qui sonne toujours
 * ne dit plus rien.
 *
 * ── Ce que ce test tient ──────────────────────────────────────────────────
 * 🔑 Le chiffre affiché sur l'accueil renvoie vers une liste. S'il compte des
 * FORMULAIRES pendant que la liste montre des PERSONNES, les deux écrans se
 * contredisent — et on apprend à se méfier des deux. C'est exactement le
 * raisonnement qui gouverne déjà les compteurs de la barre latérale.
 *
 * Et le même piège qu'ailleurs : cinq lignes sur dix-sept n'ont pas d'empreinte
 * d'adresse (R3). Les fondre en une seule personne ferait afficher « 13 » pour
 * 17 personnes qui attendent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { apporteursEnAttente } from "../apporteurs-en-attente";

const MAINTENANT = new Date("2026-09-21T12:00:00Z");

function ligne(id: string, hash: string | null, quand: string) {
  return { id, contactEmailHash: hash, submittedAt: new Date(quand) };
}

beforeEach(() => vi.clearAllMocks());

describe("le compte", () => {
  it("trois formulaires de la même personne = UNE personne en attente", async () => {
    findMany.mockResolvedValue([
      ligne("a", "h1", "2026-09-01T10:00:00Z"),
      ligne("b", "h1", "2026-09-10T10:00:00Z"),
      ligne("c", "h1", "2026-09-18T10:00:00Z"),
    ]);

    const r = await apporteursEnAttente(MAINTENANT);

    expect(r.personnes).toBe(1);
  });

  it("🔴 cinq lignes SANS empreinte restent CINQ personnes", async () => {
    findMany.mockResolvedValue(
      ["a", "b", "c", "d", "e"].map((id, i) => ligne(id, null, `2026-09-0${i + 1}T10:00:00Z`)),
    );

    expect((await apporteursEnAttente(MAINTENANT)).personnes).toBe(5);
  });

  it("personne n'attend : zéro, et aucune ancienneté à afficher", async () => {
    findMany.mockResolvedValue([]);
    expect(await apporteursEnAttente(MAINTENANT)).toEqual({
      personnes: 0,
      plusAncienJours: null,
    });
  });
});

describe("l'ancienneté", () => {
  it("compte depuis la demande la PLUS ANCIENNE encore en attente", async () => {
    findMany.mockResolvedValue([
      ligne("vieux", "h1", "2026-08-26T12:00:00Z"), // 26 jours
      ligne("recent", "h2", "2026-09-20T12:00:00Z"), // 1 jour
    ]);

    expect((await apporteursEnAttente(MAINTENANT)).plusAncienJours).toBe(26);
  });

  it("une demande du jour même vaut 0, jamais un nombre négatif", async () => {
    // Une horloge de serveur légèrement en avance rendrait -1, et « depuis -1
    // jours » est le genre de texte qui part en production.
    findMany.mockResolvedValue([ligne("a", "h1", "2026-09-21T13:30:00Z")]);
    expect((await apporteursEnAttente(MAINTENANT)).plusAncienJours).toBe(0);
  });
});

describe("ce que la requête demande à la base", () => {
  it("ne compte QUE des apporteurs, vivants, sans réponse", async () => {
    findMany.mockResolvedValue([]);
    await apporteursEnAttente(MAINTENANT);

    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where["archivedAt"]).toBeNull();
    expect(where["deletedAt"]).toBeNull();
    expect(where["replyCount"]).toBe(0);
    // Miroir du critère de la LISTE, pas de `needsAttention` : un chiffre
    // d'accueil qui ne colle pas à l'écran vers lequel il renvoie est pire
    // qu'aucun chiffre.
    expect(where["status"]).toEqual({ notIn: ["processed", "archived"] });
    // Et le prédicat apporteur, jamais une catégorie approchante.
    expect(JSON.stringify(where)).toContain("candidature-commerciale");
  });

  it("trie du plus ANCIEN au plus récent — l'ancienneté se lit sur la première ligne", async () => {
    findMany.mockResolvedValue([]);
    await apporteursEnAttente(MAINTENANT);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { submittedAt: "asc" } });
  });
});

describe("une panne ne casse pas l'accueil", () => {
  it("base indisponible (ou stub de build) : la tuile est vide, la page s'affiche", async () => {
    // 🔑 ADR 0026 : au build, Prisma est un stub. Et en production, une panne
    // de cette seule requête ne doit pas emporter tout le tableau de bord.
    findMany.mockRejectedValue(new Error("base injoignable"));

    await expect(apporteursEnAttente(MAINTENANT)).resolves.toEqual({
      personnes: 0,
      plusAncienJours: null,
    });
  });
});
