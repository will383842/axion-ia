/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  tm: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  ev: { create: vi.fn() },
  city: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  ap: { findUnique: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamMember: m.tm,
    teamMemberEvent: m.ev,
    city: m.city,
    authorProfile: m.ap,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import {
  basculerPointCarte,
  creerCollaborateur,
  depublierCollaborateur,
  modifierCollaborateur,
  proposerSlugCollaborateur,
  publierCollaborateur,
  rechercherLieux,
} from "../collaborateurs";

const ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "admin-1";
const NOTE = "Accord reçu par message le 20/11, copie conservée";

const fiche = (over: Record<string, unknown> = {}) => ({
  category: "developpeur",
  firstName: "Julie",
  jobTitle: "Développeuse",
  skills: ["TypeScript"],
  languages: ["français"],
  ...over,
});

const existant = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "julie",
  status: "brouillon",
  category: "developpeur",
  firstName: "Julie",
  organizationName: null,
  jobTitle: "Développeuse",
  headline: null,
  bioMd: null,
  skills: [],
  languages: [],
  websiteUrl: null,
  linkedinUrl: null,
  citySlug: null,
  departmentCode: null,
  showOnMap: false,
  sortOrder: 100,
  publishedAt: null,
  withdrawnAt: null,
  publicationConsentAt: null,
  linkedinConsentAt: null,
  consentSource: null,
  consentNote: null,
  latitude: null,
  longitude: null,
  erasureRequestedAt: null,
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...over,
});

function connecte(role: string | null) {
  m.auth.mockResolvedValue(role === null ? null : { user: { id: ADMIN, role } });
}

beforeEach(() => {
  vi.clearAllMocks();
  connecte("admin");
  m.tm.findFirst.mockResolvedValue(null);
  m.ap.findUnique.mockResolvedValue(null);
  m.tm.create.mockImplementation(async ({ data }: { data: { slug: string } }) => ({
    id: ID,
    slug: data.slug,
  }));
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.tm.update.mockResolvedValue({});
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.ev.create.mockResolvedValue({});
});

describe("droits : administrateur seulement, dans CHAQUE action", () => {
  const appels: Array<[string, () => Promise<{ ok: boolean }>]> = [
    ["rechercherLieux", () => rechercherLieux("Anne")],
    ["proposerSlug", () => proposerSlugCollaborateur({ firstName: "Julie", category: "autres" })],
    ["creer", () => creerCollaborateur(fiche())],
    ["modifier", () => modifierCollaborateur(ID, fiche())],
    ["publier", () => publierCollaborateur(ID)],
    ["depublier", () => depublierCollaborateur(ID)],
    ["carte", () => basculerPointCarte(ID, true)],
  ];
  for (const [nom, appel] of appels) {
    for (const role of [null, "reader", "editor", "secretaire", "responsable_qualite"]) {
      it(`${nom} refuse ${role ?? "sans session"} et ne touche pas la base`, async () => {
        connecte(role);
        const r = await appel();
        expect(r.ok).toBe(false);
        for (const mock of [
          m.tm.create,
          m.tm.update,
          m.tm.updateMany,
          m.tm.findUnique,
          m.ev.create,
          m.city.findMany,
        ]) {
          expect(mock).not.toHaveBeenCalled();
        }
        expect(m.revalidatePath).not.toHaveBeenCalled();
      });
    }
  }
  it("admin et super_admin passent", async () => {
    for (const role of ["admin", "super_admin"]) {
      connecte(role);
      const r = await creerCollaborateur(fiche());
      expect(r.ok).toBe(true);
    }
  });
});

describe("creerCollaborateur : validation", () => {
  it.each([
    ["catégorie inconnue", { category: "pirate" }],
    ["prénom vide", { firstName: "  " }],
    ["HTML dans la présentation", { bioMd: "<script>alert(1)</script>" }],
    ["HTML dans le prénom", { firstName: "<b>Julie</b>" }],
    ["LinkedIn hors linkedin.com", { linkedinUrl: "https://exemple.com/in/julie" }],
    ["LinkedIn en http", { linkedinUrl: "http://www.linkedin.com/in/julie" }],
    ["site javascript:", { websiteUrl: "javascript:alert(1)" }],
    ["ville ET département", { citySlug: "annecy", departmentCode: "74" }],
    ["structure hors partenaire", { organizationName: "ACME" }],
    ["nom de famille dans le prénom", { firstName: "Jean Dupont" }],
    ["caractère de sens inversé", { firstName: "Lea\u202Egnp" }],
    [
      "LinkedIn redirection",
      { linkedinUrl: "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fevil.example" },
    ],
    ["LinkedIn identifiants", { linkedinUrl: "https://u:p@linkedin.com/in/x" }],
    ["LinkedIn sous-domaine pirate", { linkedinUrl: "https://evil.attacker.linkedin.com/in/x" }],
    ["site avec identifiants", { websiteUrl: "https://linkedin.com@evil.example/" }],
    ["image Markdown", { bioMd: "![x](https://t.example/p.gif)" }],
    ["slug réservé", { slug: "williams" }],
    ["slug de catégorie", { slug: "direction" }],
    ["slug majuscules", { slug: "Julie" }],
    ["champ inconnu (strict)", { role: "admin" }],
    ["trop de compétences", { skills: Array.from({ length: 21 }, (_, i) => `c${i}`) }],
  ])("refuse : %s", async (_nom, over) => {
    const r = await creerCollaborateur(fiche(over));
    expect(r.ok).toBe(false);
    expect(m.tm.create).not.toHaveBeenCalled();
  });

  it("refuse une entrée qui n'est pas un objet", async () => {
    expect((await creerCollaborateur(null)).ok).toBe(false);
    expect((await creerCollaborateur("x")).ok).toBe(false);
  });

  it("refuse un accord saisi sans note de preuve", async () => {
    const r = await creerCollaborateur(fiche({ consentPublication: true }));
    expect(r.ok).toBe(false);
    expect(m.tm.create).not.toHaveBeenCalled();
  });

  it("refuse un lieu inconnu et le point carte sans lieu", async () => {
    m.city.findUnique.mockResolvedValue(null);
    expect((await creerCollaborateur(fiche({ citySlug: "nulle-part" }))).ok).toBe(false);
    expect((await creerCollaborateur(fiche({ showOnMap: true }))).ok).toBe(false);
    expect(m.tm.create).not.toHaveBeenCalled();
  });
});

describe("creerCollaborateur : écriture", () => {
  it("crée un brouillon, calcule les coordonnées côté serveur, journalise", async () => {
    m.city.findUnique.mockResolvedValue({
      slug: "annecy",
      name: "Annecy",
      departmentCode: "74",
      latitude: 45.89923,
      longitude: 6.12944,
    });
    const r = await creerCollaborateur(fiche({ citySlug: "annecy", showOnMap: true }));
    expect(r).toEqual({ ok: true, id: ID, slug: "julie-annecy" });
    const data = m.tm.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      status: "brouillon",
      latitude: 45.9,
      longitude: 6.13,
      locationLabel: "Annecy (74)",
      departmentCode: "74",
      showOnMap: true,
    });
    expect(m.ev.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ memberId: ID, action: "creation", actor: ADMIN }),
    });
    // un brouillon n'est pas public : rien à revalider
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("ignore des coordonnées envoyées par le navigateur", async () => {
    await expect(creerCollaborateur(fiche({ latitude: 1, longitude: 2 }))).resolves.toMatchObject({
      ok: false,
    });
  });

  it("enregistre l'accord avec version, source console et note", async () => {
    await creerCollaborateur(fiche({ consentPublication: true, consentNote: NOTE }));
    const data = m.tm.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      publicationConsentVersion: "team-publication-v1",
      consentSource: "console",
      consentNote: NOTE,
    });
    expect(data.publicationConsentAt).toBeInstanceOf(Date);
    expect(data.linkedinConsentAt).toBeUndefined();
  });

  it("le journal ne contient aucun contenu personnel", async () => {
    await creerCollaborateur(
      fiche({ bioMd: "Texte personnel secret", consentPublication: true, consentNote: NOTE }),
    );
    const json = JSON.stringify(m.ev.create.mock.calls[0]![0]);
    expect(json).not.toContain("Julie");
    expect(json).not.toContain("secret");
    expect(json).not.toContain(NOTE);
  });
});

describe("slug unique", () => {
  it("propose prénom-ville, puis catégorie, puis suffixe numérique", async () => {
    m.city.findUnique.mockResolvedValue({
      slug: "annecy",
      name: "Annecy",
      departmentCode: "74",
      latitude: 1,
      longitude: 1,
    });
    m.tm.findFirst
      .mockResolvedValueOnce({ id: "x" }) // julie-annecy pris
      .mockResolvedValueOnce({ id: "x" }) // julie-annecy-developpeur pris
      .mockResolvedValueOnce(null); // julie-annecy-2 libre
    const r = await proposerSlugCollaborateur({
      firstName: "Julie",
      category: "developpeur",
      citySlug: "annecy",
    });
    expect(r).toEqual({ ok: true, slug: "julie-annecy-2" });
  });

  it("refuse un slug déjà pris (y compris comme ancien slug)", async () => {
    m.tm.findFirst.mockResolvedValue({ id: "autre" });
    const r = await creerCollaborateur(fiche({ slug: "julie-annecy" }));
    expect(r.ok).toBe(false);
    expect(m.tm.findFirst.mock.calls[0]![0].where.OR).toEqual([
      { slug: "julie-annecy" },
      { previousSlugs: { has: "julie-annecy" } },
    ]);
    expect(m.tm.create).not.toHaveBeenCalled();
  });

  it("refuse un slug d'AuthorProfile", async () => {
    m.ap.findUnique.mockResolvedValue({ id: "a" });
    expect((await creerCollaborateur(fiche({ slug: "manon-ia" }))).ok).toBe(false);
  });

  it("transforme la collision concurrente (P2002) en refus propre", async () => {
    m.tm.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await creerCollaborateur(fiche({ slug: "julie-annecy" }));
    expect(r).toMatchObject({ ok: false, champs: { slug: expect.any(String) } });
  });

  it("slug figé après la première publication", async () => {
    m.tm.findUnique.mockResolvedValue(existant({ status: "publie", publishedAt: new Date() }));
    const r = await modifierCollaborateur(ID, fiche({ slug: "autre-slug" }));
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });
});

describe("modifierCollaborateur", () => {
  it("refuse un id qui n'est pas un UUID et une fiche absente", async () => {
    expect((await modifierCollaborateur("../../etc", fiche())).ok).toBe(false);
    expect(m.tm.findUnique).not.toHaveBeenCalled();
    m.tm.findUnique.mockResolvedValue(null);
    expect((await modifierCollaborateur(ID, fiche())).ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("revalide fiche et hub si elle est publiée, journalise les champs touchés", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ status: "publie", publishedAt: new Date(), publicationConsentAt: new Date() }),
    );
    const r = await modifierCollaborateur(
      ID,
      fiche({ firstName: "Juliette", consentPublication: true }),
    );
    expect(r).toEqual({ ok: true, slug: "julie" });
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe/julie");
    const details = m.ev.create.mock.calls[0]![0].data.details;
    expect(details.champs).toContain("prenom");
    expect(JSON.stringify(details)).not.toContain("Juliette");
  });

  it("ne revalide pas un brouillon", async () => {
    m.tm.findUnique.mockResolvedValue(existant());
    await modifierCollaborateur(ID, fiche());
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("interdit de retirer l'accord de publication d'une fiche publiée", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ status: "publie", publishedAt: new Date(), publicationConsentAt: new Date() }),
    );
    const r = await modifierCollaborateur(ID, fiche({ consentPublication: false }));
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("retire l'accord LinkedIn et le journalise", async () => {
    m.tm.findUnique.mockResolvedValue(existant({ linkedinConsentAt: new Date() }));
    await modifierCollaborateur(ID, fiche({ consentLinkedin: false }));
    expect(m.tm.updateMany.mock.calls[0]![0].data).toMatchObject({
      linkedinConsentAt: null,
      linkedinConsentVersion: null,
    });
    expect(m.ev.create.mock.calls[0]![0].data.details.evenements).toContain(
      "consentement_linkedin_retire",
    );
  });

  it("n'exige pas de nouvelle note pour un accord déjà enregistré", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ publicationConsentAt: new Date(), consentSource: "questionnaire" }),
    );
    const r = await modifierCollaborateur(ID, fiche({ consentPublication: true }));
    expect(r.ok).toBe(true);
    expect(m.tm.updateMany.mock.calls[0]![0].data.consentSource).toBeUndefined();
  });
});

describe("concurrence, effacement, preuve", () => {
  it("modifier refuse si la fiche a changé entre la lecture et l'écriture", async () => {
    m.tm.findUnique.mockResolvedValue(existant());
    m.tm.updateMany.mockResolvedValue({ count: 0 });
    const r = await modifierCollaborateur(ID, fiche());
    expect(r.ok).toBe(false);
    expect(m.ev.create).not.toHaveBeenCalled();
    expect(m.tm.updateMany.mock.calls[0]![0].where).toMatchObject({ id: ID, status: "brouillon" });
  });
  it("carte : refuse si la fiche a changé entre-temps", async () => {
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      slug: "j",
      status: "brouillon",
      latitude: 1,
      longitude: 1,
      updatedAt: new Date(),
    });
    m.tm.updateMany.mockResolvedValue({ count: 0 });
    expect((await basculerPointCarte(ID, true)).ok).toBe(false);
    expect(m.ev.create).not.toHaveBeenCalled();
  });
  it("une demande d'effacement verrouille modification et publication", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ erasureRequestedAt: new Date(), publicationConsentAt: new Date() }),
    );
    expect((await modifierCollaborateur(ID, fiche())).ok).toBe(false);
    expect((await publierCollaborateur(ID)).ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });
  it("un nouvel accord ne peut pas réutiliser la note précédente", async () => {
    m.tm.findUnique.mockResolvedValue(existant({ consentNote: NOTE, consentSource: "console" }));
    const r = await modifierCollaborateur(
      ID,
      fiche({ consentPublication: true, consentNote: NOTE }),
    );
    expect(r.ok).toBe(false);
  });
  it("une note nouvelle s'ajoute sans effacer la preuve précédente", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({
        publicationConsentAt: new Date(),
        consentNote: "preuve publication initiale",
        consentSource: "questionnaire",
      }),
    );
    await modifierCollaborateur(
      ID,
      fiche({ consentPublication: true, consentLinkedin: true, consentNote: NOTE }),
    );
    const note = m.tm.updateMany.mock.calls[0]![0].data.consentNote as string;
    expect(note).toContain("preuve publication initiale");
    expect(note).toContain(NOTE);
  });
  it("refuse un lien Markdown javascript: dans la présentation", async () => {
    expect((await creerCollaborateur(fiche({ bioMd: "[clic](javascript:alert(1))" }))).ok).toBe(
      false,
    );
  });
});

describe("publier / dépublier", () => {
  it("refuse de publier sans accord de publication", async () => {
    m.tm.findUnique.mockResolvedValue(existant());
    const r = await publierCollaborateur(ID);
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
    expect(m.ev.create).not.toHaveBeenCalled();
  });

  it("refuse un id invalide et une fiche absente", async () => {
    expect((await publierCollaborateur("abc")).ok).toBe(false);
    m.tm.findUnique.mockResolvedValue(null);
    expect((await publierCollaborateur(ID)).ok).toBe(false);
  });

  it("refuse si la note de preuve console manque", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ publicationConsentAt: new Date(), consentSource: "console", consentNote: "" }),
    );
    expect((await publierCollaborateur(ID)).ok).toBe(false);
  });

  it("publie : statut, validation par l'admin, journal, revalidation fiche + hub", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({
        status: "a_valider",
        publicationConsentAt: new Date(),
        consentSource: "questionnaire",
      }),
    );
    const r = await publierCollaborateur(ID);
    expect(r).toEqual({ ok: true, slug: "julie" });
    expect(m.tm.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: ID, status: "a_valider" },
      data: { status: "publie", validatedByAdminId: ADMIN, withdrawnAt: null },
    });
    expect(m.ev.create.mock.calls[0]![0].data).toMatchObject({
      action: "publication",
      actor: ADMIN,
    });
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe/julie");
  });

  it("une fiche retirée exige un NOUVEL accord de publication", async () => {
    const retrait = new Date("2026-11-20T10:00:00Z");
    m.tm.findUnique.mockResolvedValue(
      existant({
        status: "retire",
        withdrawnAt: retrait,
        publicationConsentAt: new Date("2026-11-01T10:00:00Z"),
        consentSource: "questionnaire",
      }),
    );
    expect((await publierCollaborateur(ID)).ok).toBe(false);
    m.tm.findUnique.mockResolvedValue(
      existant({
        status: "retire",
        withdrawnAt: retrait,
        publicationConsentAt: new Date("2026-11-21T10:00:00Z"),
        consentSource: "questionnaire",
      }),
    );
    expect((await publierCollaborateur(ID)).ok).toBe(true);
  });

  it("ne publie pas deux fois ; refuse si la fiche a changé entre-temps", async () => {
    m.tm.findUnique.mockResolvedValue(
      existant({ status: "publie", publicationConsentAt: new Date() }),
    );
    expect((await publierCollaborateur(ID)).ok).toBe(false);
    m.tm.findUnique.mockResolvedValue(
      existant({ publicationConsentAt: new Date(), consentSource: "questionnaire" }),
    );
    m.tm.updateMany.mockResolvedValue({ count: 0 });
    expect((await publierCollaborateur(ID)).ok).toBe(false);
    expect(m.ev.create).not.toHaveBeenCalled();
  });

  it("dépublie : statut retiré, journal, revalidation immédiate", async () => {
    m.tm.findUnique.mockResolvedValue({ id: ID, slug: "julie", status: "publie" });
    const r = await depublierCollaborateur(ID);
    expect(r.ok).toBe(true);
    expect(m.tm.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: ID, status: "publie" },
      data: { status: "retire", withdrawnBy: "admin" },
    });
    expect(m.ev.create.mock.calls[0]![0].data.action).toBe("depublication");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe/julie");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
  });

  it("ne dépublie pas une fiche qui n'est pas publiée", async () => {
    m.tm.findUnique.mockResolvedValue({ id: ID, slug: "julie", status: "brouillon" });
    expect((await depublierCollaborateur(ID)).ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });
});

describe("basculerPointCarte", () => {
  it("refuse sans lieu, accepte avec, journalise, revalide si publié", async () => {
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      slug: "julie",
      status: "publie",
      latitude: null,
      longitude: null,
    });
    expect((await basculerPointCarte(ID, true)).ok).toBe(false);
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      slug: "julie",
      status: "publie",
      latitude: 45.9,
      longitude: 6.1,
      updatedAt: new Date(),
    });
    expect((await basculerPointCarte(ID, true)).ok).toBe(true);
    expect(m.tm.updateMany).toHaveBeenCalledWith({
      where: { id: ID, updatedAt: expect.anything() },
      data: { showOnMap: true },
    });
    expect(m.ev.create.mock.calls[0]![0].data.action).toBe("carte_activee");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
  });

  it("autorise de désactiver sans lieu ; refuse une valeur non booléenne ou un id invalide", async () => {
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      slug: "julie",
      status: "brouillon",
      latitude: null,
      longitude: null,
    });
    expect((await basculerPointCarte(ID, false)).ok).toBe(true);
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect((await basculerPointCarte(ID, "oui")).ok).toBe(false);
    expect((await basculerPointCarte("x", true)).ok).toBe(false);
  });
});

describe("rechercherLieux", () => {
  it("renvoie vide sous 2 caractères sans interroger la base", async () => {
    expect(await rechercherLieux("a")).toEqual({ ok: true, lieux: [] });
    expect(m.city.findMany).not.toHaveBeenCalled();
  });
  it("renvoie villes puis départements", async () => {
    m.city.findMany.mockResolvedValue([{ slug: "annecy", name: "Annecy", departmentCode: "74" }]);
    m.city.groupBy.mockResolvedValue([{ departmentCode: "74", departmentName: "Haute-Savoie" }]);
    const r = await rechercherLieux("An");
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.lieux.map((l) => l.type)).toEqual(["ville", "departement"]);
  });
});
