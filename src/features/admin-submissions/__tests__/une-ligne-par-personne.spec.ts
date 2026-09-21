/**
 * La liste « Apporteurs » montre UNE LIGNE PAR PERSONNE (2026-09-21).
 *
 * ── Ce que la console montrait ────────────────────────────────────────────
 * Une ligne par FORMULAIRE. Quelqu'un qui laisse ses cinq champs, revient
 * valider l'écran 1, puis envoie son dossier complet occupait TROIS lignes, sans
 * que rien ne dise qu'il s'agit de la même personne. Trois lignes, c'est trois
 * fois le geste — et un compteur « 17 à traiter » qui décrit 12 personnes.
 *
 * ── Le piège que ce test existe pour tenir ────────────────────────────────
 * 🔴 CINQ DES DIX-SEPT LIGNES N'ONT PAS D'EMPREINTE D'ADRESSE (mesure R3 du
 * 19/09). Un `groupBy` SQL sur `contactEmailHash` les rassemblerait TOUTES dans
 * un seul groupe — cinq personnes distinctes fondues en une, silencieusement, et
 * une seule d'entre elles resterait joignable depuis la console.
 *
 * Le repli sur l'identifiant de ligne isole ces orphelines au lieu de les
 * confondre. C'est le sens du doute qu'il faut ici : une personne de trop coûte
 * une ligne en double, une personne de moins coûte quelqu'un qu'on ne voit plus.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));
// Les adresses sont chiffrées en base ; le déchiffrement a ses propres tests.
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));

import { listSubmissions } from "../reads";

interface Ligne {
  id: string;
  hash: string | null;
  quand: string;
  details: Record<string, unknown>;
}

function ligne(l: Ligne) {
  return {
    id: l.id,
    type: "contact",
    status: "new",
    locale: "fr",
    companyName: "",
    contactName: "Camille Martin",
    contactEmail: "camille@exemple.invalid",
    contactPhone: null,
    sector: null,
    assignedTo: null,
    submittedAt: new Date(l.quand),
    replyCount: 0,
    needsAttention: true,
    archivedAt: null,
    deletedAt: null,
    lastRepliedAt: null,
    contactEmailHash: l.hash,
    details: { unifiedType: "recrutement", subType: "candidature-commerciale", ...l.details },
    replies: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
});

describe("le périmètre apporteurs regroupe par personne", () => {
  it("trois formulaires de la même personne = UNE ligne, à l'étape la plus avancée", async () => {
    findMany.mockResolvedValue([
      ligne({ id: "c", hash: "h1", quand: "2026-09-18T10:00:00Z", details: {} }),
      ligne({
        id: "b",
        hash: "h1",
        quand: "2026-09-12T10:00:00Z",
        details: { origine: "ecran-1-du-dossier" },
      }),
      ligne({
        id: "a",
        hash: "h1",
        quand: "2026-09-01T10:00:00Z",
        details: { etape: "premier-contact" },
      }),
    ]);

    const r = await listSubmissions({ perimetre: "apporteurs" });

    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(1);
    expect(r.items[0]?.lignesDeLaPersonne).toBe(3);
    expect(r.items[0]?.etape).toBe("dossier-complet");
    // La ligne ouverte est la plus RÉCENTE : c'est celle que Will veut lire.
    expect(r.items[0]?.id).toBe("c");
  });

  it("🔴 cinq lignes SANS empreinte restent CINQ personnes", async () => {
    findMany.mockResolvedValue(
      ["a", "b", "c", "d", "e"].map((id, i) =>
        ligne({ id, hash: null, quand: `2026-09-0${i + 1}T10:00:00Z`, details: {} }),
      ),
    );

    const r = await listSubmissions({ perimetre: "apporteurs" });

    expect(r.items).toHaveLength(5);
    expect(r.total).toBe(5);
    // Chacune est seule dans son groupe : aucune n'en absorbe une autre.
    for (const item of r.items) expect(item.lignesDeLaPersonne).toBe(1);
  });

  it("empreintes et orphelines mélangées : chacune son compte", async () => {
    findMany.mockResolvedValue([
      ligne({ id: "x1", hash: "h1", quand: "2026-09-18T10:00:00Z", details: {} }),
      ligne({ id: "orph", hash: null, quand: "2026-09-17T10:00:00Z", details: {} }),
      ligne({ id: "x2", hash: "h1", quand: "2026-09-16T10:00:00Z", details: {} }),
      ligne({ id: "y1", hash: "h2", quand: "2026-09-15T10:00:00Z", details: {} }),
    ]);

    const r = await listSubmissions({ perimetre: "apporteurs" });

    expect(r.items.map((i) => i.id)).toEqual(["x1", "orph", "y1"]);
    expect(r.items.map((i) => i.lignesDeLaPersonne)).toEqual([2, 1, 1]);
  });

  it("la pagination compte des PERSONNES, pas des lignes", async () => {
    // Sinon la console annonce des pages qui n'existent pas, et la dernière
    // s'affiche vide — le genre de bogue qu'on met sur le compte du réseau.
    findMany.mockResolvedValue([
      ligne({ id: "a1", hash: "h1", quand: "2026-09-18T10:00:00Z", details: {} }),
      ligne({ id: "a2", hash: "h1", quand: "2026-09-17T10:00:00Z", details: {} }),
      ligne({ id: "b1", hash: "h2", quand: "2026-09-16T10:00:00Z", details: {} }),
      ligne({ id: "b2", hash: "h2", quand: "2026-09-15T10:00:00Z", details: {} }),
    ]);

    const r = await listSubmissions({ perimetre: "apporteurs", pageSize: 10 });

    expect(r.total).toBe(2);
    expect(r.totalPages).toBe(1);
  });
});

describe("le regroupement ne déborde PAS sur les autres listes", () => {
  // 🔑 Le témoin. Sans lui, un regroupement appliqué partout passerait ce
  // fichier en entier — et la boîte de réception fondrait deux demandes
  // distinctes d'un même client en une seule ligne.
  it("hors périmètre apporteurs, une ligne reste une ligne", async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([
      ligne({ id: "m1", hash: "h1", quand: "2026-09-18T10:00:00Z", details: {} }),
      ligne({ id: "m2", hash: "h1", quand: "2026-09-17T10:00:00Z", details: {} }),
    ]);

    const r = await listSubmissions({});

    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(2);
    // Et le champ dit toujours la vérité : jamais `null` « parce qu'on ne
    // regroupe pas ici ».
    expect(r.items.map((i) => i.lignesDeLaPersonne)).toEqual([1, 1]);
    expect(r.items[0]?.etape).toBeNull();
  });

  it("la lecture non groupée pagine toujours en BASE, pas en mémoire", async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([]);

    await listSubmissions({ page: 3, pageSize: 25 });

    // `skip`/`take` présents = Postgres fait le travail. Le regroupement par
    // personne est une exception bornée, pas une nouvelle règle générale.
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ skip: 50, take: 25 });
  });
});
