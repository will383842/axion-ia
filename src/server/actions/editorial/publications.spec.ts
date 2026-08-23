/**
 * Console éditoriale — tests des Server Actions de publication.
 *
 * ## Pourquoi ce fichier existe
 *
 * 🔴 Les deux vérificateurs à l'aveugle du protocole, qui ne se connaissaient
 * pas, ont fait le même constat : `src/server/actions/editorial/` n'avait
 * **aucun test**. Les 450 tests éditoriaux couvraient exclusivement les
 * modules purs — le versionnage, la journalisation, le contrôle de
 * concurrence, l'idempotence, tout le câblage transactionnel était livré sans
 * filet.
 *
 * Ce n'est pas un trou de couverture ordinaire. Les modules purs sont la
 * partie FACILE à tester, et c'est précisément pour ça qu'ils l'étaient : une
 * suite verte à 450 tests donnait l'impression d'un travail vérifié, alors que
 * la moitié qui touche la base ne l'était pas du tout.
 *
 * ## Ce que ces tests verrouillent
 *
 * Chaque cas ci-dessous correspond à un défaut RÉELLEMENT trouvé pendant les
 * passes de vérification, et corrigé. Ils ne décrivent donc pas un idéal :
 * ils empêchent un retour en arrière sur des bugs qui ont existé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPublicationFindUnique,
  mockPublicationUpdate,
  mockPublicationUpdateMany,
  mockPublicationFindUniqueOrThrow,
  mockPublicationCreate,
  mockVersionCreate,
  mockCompteUpdate,
  mockCompteFindUnique,
  mockRegleFindMany,
  mockTransaction,
  mockRequirePermission,
  mockJournaliser,
} = vi.hoisted(() => ({
  mockPublicationFindUnique: vi.fn(),
  mockPublicationUpdate: vi.fn(),
  mockPublicationUpdateMany: vi.fn(),
  mockPublicationFindUniqueOrThrow: vi.fn(),
  mockPublicationCreate: vi.fn(),
  mockVersionCreate: vi.fn(),
  mockCompteUpdate: vi.fn(),
  mockCompteFindUnique: vi.fn(),
  mockRegleFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
}));

const clientPrisma = {
  edPublication: {
    findUnique: mockPublicationFindUnique,
    findUniqueOrThrow: mockPublicationFindUniqueOrThrow,
    update: mockPublicationUpdate,
    updateMany: mockPublicationUpdateMany,
    create: mockPublicationCreate,
  },
  edPublicationVersion: { create: mockVersionCreate },
  edCompte: { update: mockCompteUpdate, findUnique: mockCompteFindUnique },
  edRegleConformite: { findMany: mockRegleFindMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...clientPrisma,
    // `$transaction` reçoit soit un tableau de promesses, soit un callback.
    // On couvre les deux : les actions de ce module utilisent les deux formes.
    $transaction: mockTransaction,
  },
}));

vi.mock("@/server/actions/editorial/_guards", () => ({
  requirePermission: mockRequirePermission,
  journaliser: mockJournaliser,
  requireMembreEditorial: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { modifierPublicationAction, marquerPublieeAction, creerPublicationAction } =
  await import("./publications");

const MEMBRE = { userId: "u1", membreId: "m1", role: "admin" as const, nom: "Will" };
const ID = "11111111-1111-4111-8111-111111111111";
const COMPTE = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(MEMBRE);
  mockJournaliser.mockResolvedValue(undefined);
  // Forme « callback » : on rejoue le corps avec le même client.
  mockTransaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? await (arg as (tx: unknown) => Promise<unknown>)(clientPrisma)
      : await Promise.all(arg as Promise<unknown>[]),
  );
});

// ── La perte de mise à jour silencieuse ───────────────────────────────────

describe("modifierPublicationAction — deux personnes sur la même fiche", () => {
  const existante = {
    id: ID,
    accroche: "A",
    corps: "Le texte de A",
    premierCommentaire: null,
    tags: [],
    lienUrl: null,
    versionCourante: 3,
    updatedAt: new Date("2026-08-21T10:00:00Z"),
  };

  it("🔴 REFUSE quand le formulaire partait d'une version périmée", async () => {
    // Défaut trouvé par la passe 4. B ouvre la fiche en version 3, A
    // enregistre (elle passe en 4), B enregistre : sans cette garde, le patch
    // de B réécrivait TOUS les champs de contenu depuis sa lecture périmée, et
    // le texte de A disparaissait sans exister nulle part — la seule version
    // archivée étant celle d'AVANT A.
    mockPublicationFindUnique.mockResolvedValue({ ...existante, versionCourante: 4 });

    const r = await modifierPublicationAction({
      id: ID,
      corps: "Le texte de B",
      versionAttendue: 3,
    });

    expect("error" in r).toBe(true);
    if ("error" in r) {
      // Le message doit être ACTIONNABLE : « recharger » se fait, « conflit »
      // ne se fait pas.
      expect(r.error).toMatch(/recharge/i);
      expect(r.error).toContain("3");
      expect(r.error).toContain("4");
    }
    // Et surtout : rien n'a été écrit.
    expect(mockPublicationUpdateMany).not.toHaveBeenCalled();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  it("passe quand la version annoncée est encore la bonne", async () => {
    mockPublicationFindUnique.mockResolvedValue(existante);
    mockPublicationUpdateMany.mockResolvedValue({ count: 1 });
    mockPublicationFindUniqueOrThrow.mockResolvedValue({ id: ID, versionCourante: 4 });

    const r = await modifierPublicationAction({ id: ID, corps: "Nouveau", versionAttendue: 3 });

    expect("data" in r).toBe(true);
    expect(mockPublicationUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("🔴 l'écriture porte la version ET l'horodatage LUS dans son `where`", async () => {
    // `versionCourante` seule ne suffit pas : deux modifications sans
    // versionnement la laissent identique, et la seconde écraserait la
    // première sans que la clause ne s'en aperçoive.
    mockPublicationFindUnique.mockResolvedValue(existante);
    mockPublicationUpdateMany.mockResolvedValue({ count: 1 });
    mockPublicationFindUniqueOrThrow.mockResolvedValue({ id: ID, versionCourante: 4 });

    await modifierPublicationAction({ id: ID, corps: "Nouveau" });

    const ou = mockPublicationUpdateMany.mock.calls[0]![0].where;
    expect(ou.id).toBe(ID);
    expect(ou.versionCourante).toBe(3);
    expect(ou.updatedAt).toEqual(existante.updatedAt);
  });

  it("🔴 LÈVE si la ligne a bougé entre la lecture et l'écriture", async () => {
    // La fenêtre est étroite mais réelle. `count: 0` signifie qu'un autre
    // commit s'est intercalé ; on refuse plutôt que de rendre un succès qui
    // n'a rien écrit.
    mockPublicationFindUnique.mockResolvedValue(existante);
    mockPublicationUpdateMany.mockResolvedValue({ count: 0 });

    const r = await modifierPublicationAction({ id: ID, corps: "Nouveau" });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/rechargez|rien n'a été écrasé/i);
  });

  it("🔴 le refus annule AUSSI la version qu'on venait d'archiver", async () => {
    // Sinon on laisserait un instantané orphelin, qui prétend documenter une
    // modification qui n'a pas eu lieu. C'est pour ça que la levée se fait
    // DANS la transaction.
    mockPublicationFindUnique.mockResolvedValue(existante);
    mockPublicationUpdateMany.mockResolvedValue({ count: 0 });

    await modifierPublicationAction({ id: ID, corps: "Nouveau" });

    // La version a bien été tentée…
    expect(mockVersionCreate).toHaveBeenCalled();
    // …mais dans une transaction qui a levé, donc annulée.
    await expect(mockTransaction.mock.results[0]!.value as Promise<unknown>).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("rend `versionCreee: false` quand aucun champ versionné n'a bougé", async () => {
    mockPublicationFindUnique.mockResolvedValue(existante);
    mockPublicationUpdateMany.mockResolvedValue({ count: 1 });
    mockPublicationFindUniqueOrThrow.mockResolvedValue({ id: ID, versionCourante: 3 });

    const r = await modifierPublicationAction({ id: ID, lienUrl: "https://exemple.fr" });

    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data.versionCreee).toBe(false);
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });
});

// ── L'idempotence de la publication ───────────────────────────────────────

describe("marquerPublieeAction — « rejouer ne publie jamais deux fois »", () => {
  const URL = "https://www.linkedin.com/posts/exemple-123";

  it("🔴 un second appel avec la MÊME url ne réécrit RIEN", async () => {
    // Défaut trouvé par la passe 4. Le raccourci `de === vers` de
    // `transitionDiffusion` autorise `publie → publie`. Le second appel
    // réécrivait `urlPubliee`, `publieeA` et surtout
    // `EdCompte.derniereParutionA`, qui arme l'alerte « canal muet » : un
    // double clic repoussait la dernière parution d'un compte et faisait taire
    // une alerte qui devait sonner.
    mockPublicationFindUnique.mockResolvedValue({
      statutDiffusion: "publie",
      compteId: COMPTE,
      urlPubliee: URL,
      publieeA: new Date("2026-08-20T09:00:00Z"),
    });

    const r = await marquerPublieeAction({ id: ID, urlPubliee: URL });

    expect("data" in r).toBe(true);
    expect(mockPublicationUpdate).not.toHaveBeenCalled();
    expect(mockCompteUpdate).not.toHaveBeenCalled();
    expect(mockJournaliser).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE, en la citant, si une AUTRE url est déjà enregistrée", async () => {
    // Un succès muet laisserait croire que la nouvelle URL a été prise en
    // compte.
    mockPublicationFindUnique.mockResolvedValue({
      statutDiffusion: "publie",
      compteId: COMPTE,
      urlPubliee: URL,
      publieeA: new Date(),
    });

    const r = await marquerPublieeAction({ id: ID, urlPubliee: "https://autre.example/post" });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain(URL);
    expect(mockPublicationUpdate).not.toHaveBeenCalled();
  });

  it("publie normalement depuis `programme`, et arme la dernière parution", async () => {
    mockPublicationFindUnique.mockResolvedValue({
      statutDiffusion: "programme",
      compteId: COMPTE,
      urlPubliee: null,
      publieeA: null,
    });

    const r = await marquerPublieeAction({ id: ID, urlPubliee: URL });

    expect("data" in r).toBe(true);
    expect(mockPublicationUpdate).toHaveBeenCalledTimes(1);
    // `derniereParutionA` est RECALCULÉ ici, jamais agrégé au rendu.
    expect(mockCompteUpdate).toHaveBeenCalledTimes(1);
    expect(mockCompteUpdate.mock.calls[0]![0].where.id).toBe(COMPTE);
  });

  it("REFUSE une url qui n'en est pas une", async () => {
    const r = await marquerPublieeAction({ id: ID, urlPubliee: "pas une url" });
    expect("error" in r).toBe(true);
    expect(mockPublicationFindUnique).not.toHaveBeenCalled();
  });
});

// ── Les dates impossibles ─────────────────────────────────────────────────

describe("creerPublicationAction — la forme ne suffit pas", () => {
  beforeEach(() => {
    mockCompteFindUnique.mockResolvedValue({ id: COMPTE, identite: "perso" });
  });

  it.each([
    ["2026-02-30", "le 30 février n'existe pas"],
    ["2026-13-45", "ni le mois 13, ni le jour 45"],
    ["0000-00-00", "zéro n'est ni un mois ni un jour"],
    ["9999-99-99", "Date.UTC reportait sur l'an 10007"],
  ])("🔴 REFUSE « %s » — %s", async (date) => {
    // Défaut trouvé par la passe 4 : le schéma ne vérifiait que la FORME, puis
    // `Date.UTC` reportait en silence. Aggravation : `lireAnnee` borne le
    // calendrier à 2020-2100, donc une publication ainsi datée devenait réelle
    // et INTROUVABLE à l'écran.
    const r = await creerPublicationAction({
      compteId: COMPTE,
      datePrevue: date,
      heurePrevue: "09:00",
      titreInterne: "Test",
    });

    expect("error" in r, date).toBe(true);
    expect(mockPublicationCreate).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE une heure hors bornes", async () => {
    const r = await creerPublicationAction({
      compteId: COMPTE,
      datePrevue: "2026-09-15",
      heurePrevue: "99:99",
      titreInterne: "Test",
    });
    expect("error" in r).toBe(true);
    expect(mockPublicationCreate).not.toHaveBeenCalled();
  });

  it("accepte une date réelle et la range à minuit UTC", async () => {
    mockPublicationCreate.mockResolvedValue({ id: ID });

    const r = await creerPublicationAction({
      compteId: COMPTE,
      datePrevue: "2026-09-15",
      heurePrevue: "09:00",
      titreInterne: "Automatiser une relance",
    });

    expect("data" in r).toBe(true);
    const donnees = mockPublicationCreate.mock.calls[0]![0].data;
    // Jamais `new Date(a, m, j)` : le fuseau local décalerait le jour, et une
    // publication du 15 se rangerait au 14 dans la grille.
    expect((donnees.datePrevue as Date).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("REFUSE un compte inexistant, en le disant", async () => {
    mockCompteFindUnique.mockResolvedValue(null);

    const r = await creerPublicationAction({
      compteId: COMPTE,
      datePrevue: "2026-09-15",
      heurePrevue: "09:00",
      titreInterne: "Test",
    });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/compte/i);
  });
});

// ── Les permissions mordent sur les VRAIES actions ────────────────────────

describe("les gardes de permission ne sont pas décoratives", () => {
  it("🔴 remonte le refus de `requirePermission` au lieu de continuer", async () => {
    // Le §4 veut un refus qui CITE la règle. On vérifie ici que l'action ne
    // l'avale pas : un `catch` trop large transformerait « refusé » en
    // « erreur inattendue », et le rôle fautif disparaîtrait du message.
    mockRequirePermission.mockRejectedValue(
      new Error("Action « publication.valider » refusée : le rôle « montage » ne l'a pas."),
    );

    const r = await marquerPublieeAction({ id: ID, urlPubliee: "https://exemple.fr/p" });

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error).toContain("montage");
      expect(r.error).toContain("refusée");
    }
  });
});
