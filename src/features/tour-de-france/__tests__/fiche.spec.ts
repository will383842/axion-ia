import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    client: { findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    clientContact: {
      findUnique: vi.fn(async (): Promise<unknown> => null),
      update: vi.fn(async () => ({})),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    tourDemande: { update: vi.fn(async () => ({})) },
  };
  const creerOuRetrouverClient = vi.fn();
  return {
    tx,
    prisma: {
      tourDemande: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
      client: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
    trouverFichesProches: vi.fn(),
    fichesAuMemeTelephone: vi.fn(async () => [] as string[]),
    ajouterPersonneAFiche: vi.fn(async () => ({ contactId: "c1", cree: true })),
    emettreFaitClient: vi.fn(async () => undefined),
    creerOuRetrouverClient,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => v,
  encryptPii: (v: string) => v,
}));
vi.mock("@/features/dossier-client/base", () => ({ dansLaTransaction: (t: unknown) => t }));
vi.mock("@/features/dossier-client/fiche-auto", () => ({
  fichesAuMemeTelephone: m.fichesAuMemeTelephone,
}));
vi.mock("@/features/questionnaire-preaudit/interblocage", () => ({
  reessayerSiInterblocage: (fn: () => unknown) => fn(),
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => ({}),
  emettreFaitClient: m.emettreFaitClient,
}));
vi.mock("@/server/qualiopi/crm/contact-facturation", () => ({ NOM_A_COMPLETER: "(à compléter)" }));
vi.mock("@/server/qualiopi/crm/porte-client", () => ({
  preparerCandidat: () => ({}),
  chargerFichesCandidates: async () => [],
  trouverFichesProches: m.trouverFichesProches,
  creerOuRetrouverClient: m.creerOuRetrouverClient,
  ajouterPersonneAFiche: m.ajouterPersonneAFiche,
}));

import {
  champsACompleter,
  completerFicheDepuisDemande,
  creerFicheDepuisDemande,
  decider,
  fusionnerProches,
  rattacherDemande,
} from "../fiche";

const ligne = {
  id: "d1",
  nom: "Alice Martin",
  email: "alice@societe-exemple.fr",
  telephone: "0612345678",
  villeSaisie: "lyon",
  villeNom: "Lyon",
  statut: "recue",
  fichesProches: null,
  depuis: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  rattachement: "a_verifier",
  clientId: null,
};

const proche = (signal: "email" | "nom_ville" | "domaine", id = "f1") => ({
  ficheId: id,
  numero: `C-${id}`,
  raisonSociale: `Fiche ${id}`,
  signal,
});

/** Le texte d'une requête SQL écrite avec `$queryRaw` (les morceaux, séparés par « ? »). */
function texteSql(appel: ReadonlyArray<unknown> | undefined): string {
  const morceaux = (appel?.[0] ?? []) as ReadonlyArray<string>;
  return morceaux.join("?");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.tourDemande.findUnique.mockResolvedValue(ligne);
  m.fichesAuMemeTelephone.mockResolvedValue([]);
  m.prisma.client.findMany.mockResolvedValue([]);
  m.tx.client.findFirst.mockResolvedValue({ adresseVille: null });
  m.tx.$queryRaw.mockResolvedValue([{ statut: "recue", client_id: null }]);
  m.ajouterPersonneAFiche.mockResolvedValue({ contactId: "c1", cree: true });
});

describe("fiche : parties pures", () => {
  it("decider : même une seule fiche reconnue à l'e-mail va à l'arbitrage (jamais écrite seule)", () => {
    const unique = proche("email");
    expect(decider([unique])).toEqual({ issue: "arbitrer", proches: [unique] });
  });

  it("decider : un homonyme, un domaine ou plusieurs fiches vont à l'arbitrage", () => {
    expect(decider([proche("nom_ville")]).issue).toBe("arbitrer");
    expect(decider([proche("domaine")]).issue).toBe("arbitrer");
    expect(decider([proche("email", "f1"), proche("email", "f2")]).issue).toBe("arbitrer");
  });

  it("decider : aucune fiche", () => {
    expect(decider([])).toEqual({ issue: "aucune" });
  });

  it("fusionnerProches : une fiche n'apparaît qu'une fois, avec son signal le plus fort", () => {
    const liste = fusionnerProches(
      [{ ficheId: "f1", numero: "C-1", raisonSociale: "A", signal: "email", force: "fort" }],
      [
        { id: "f1", numero: "C-1", raisonSociale: "A" },
        { id: "f2", numero: "C-2", raisonSociale: "B" },
      ],
    );
    expect(liste.map((p) => [p.ficheId, p.signal])).toEqual([
      ["f1", "email"],
      ["f2", "telephone"],
    ]);
  });

  it("champsACompleter : seulement la ville DU RÉFÉRENTIEL, seulement si elle est vide", () => {
    expect(champsACompleter({ adresseVille: null }, "Lyon")).toEqual({ adresseVille: "Lyon" });
    expect(champsACompleter({ adresseVille: "  " }, "Lyon")).toEqual({ adresseVille: "Lyon" });
    expect(champsACompleter({ adresseVille: "Annecy" }, "Lyon")).toEqual({});
    expect(champsACompleter({ adresseVille: null }, "")).toEqual({});
  });
});

describe("rattacherDemande : cherche, n'écrit sur AUCUNE fiche", () => {
  it("une fiche reconnue à l'e-mail seule : à arbitrer, rien n'est écrit sur la fiche", async () => {
    m.trouverFichesProches.mockReturnValue([proche("email")]);
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "a_arbitrer", clientId: null });
    // Une demande publique n'écrit jamais seule : ni transaction, ni mise à jour de fiche.
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.client.update).not.toHaveBeenCalled();
    expect(m.tx.activityLog.create).not.toHaveBeenCalled();
    expect(m.ajouterPersonneAFiche).not.toHaveBeenCalled();
    expect(m.emettreFaitClient).not.toHaveBeenCalled();
    const maj = (
      m.prisma.tourDemande.update.mock.calls[0] as unknown as [
        { data: { rattachement: string; fichesProches: Array<Record<string, unknown>> } },
      ]
    )[0];
    expect(maj.data.rattachement).toBe("a_arbitrer");
    expect(maj.data.fichesProches).toEqual([
      { ficheId: "f1", numero: "C-f1", raisonSociale: "Fiche f1", signal: "email" },
    ]);
  });

  it("homonyme (même nom, même ville) : à arbitrer, AUCUNE écriture sur une fiche", async () => {
    m.trouverFichesProches.mockReturnValue([proche("nom_ville")]);
    const r = await rattacherDemande("d1");
    expect(r.rattachement).toBe("a_arbitrer");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.client.update).not.toHaveBeenCalled();
    const maj = (
      m.prisma.tourDemande.update.mock.calls[0] as unknown as [
        { data: { rattachement: string; fichesProches: Array<{ ficheId: string }> } },
      ]
    )[0];
    expect(maj.data.rattachement).toBe("a_arbitrer");
    expect(maj.data.fichesProches[0]?.ficheId).toBe("f1");
  });

  it("même téléphone qu'une AUTRE fiche : à arbitrer, aucune écriture sur une fiche", async () => {
    m.trouverFichesProches.mockReturnValue([proche("email", "f1")]);
    m.fichesAuMemeTelephone.mockResolvedValue(["f2"]);
    m.prisma.client.findMany.mockResolvedValue([
      { id: "f2", numero: "C-f2", raisonSociale: "Fiche f2" },
    ] as never);
    const r = await rattacherDemande("d1");
    expect(r.rattachement).toBe("a_arbitrer");
    expect(m.tx.client.update).not.toHaveBeenCalled();
    // Le téléphone déchiffré est passé tel quel à la recherche (aucune fin de numéro stockée).
    expect(m.fichesAuMemeTelephone).toHaveBeenCalledWith(m.prisma, "0612345678");
  });

  it("aucune fiche : « sans fiche », rien n'est créé", async () => {
    m.trouverFichesProches.mockReturnValue([]);
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "sans_fiche", clientId: null });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.client.update).not.toHaveBeenCalled();
  });

  it("une demande déjà rattachée est rendue telle quelle (idempotent)", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...ligne,
      rattachement: "fiche_completee",
      clientId: "f9",
    });
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "fiche_completee", clientId: "f9" });
    expect(m.trouverFichesProches).not.toHaveBeenCalled();
  });

  it("une demande effacée à la demande de la personne n'est plus cherchée ni rangée", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...ligne, statut: "effacee_rgpd" });
    await rattacherDemande("d1");
    expect(m.trouverFichesProches).not.toHaveBeenCalled();
    expect(m.prisma.tourDemande.update).not.toHaveBeenCalled();
  });
});

describe("completerFicheDepuisDemande : « Compléter la fiche », à la demande d'un humain", () => {
  const arbitree = {
    ...ligne,
    rattachement: "a_arbitrer",
    fichesProches: [{ ficheId: "f1", numero: "C-f1", raisonSociale: "Fiche f1", signal: "email" }],
  };

  beforeEach(() => {
    m.prisma.tourDemande.findUnique.mockResolvedValue(arbitree);
  });

  it("remplit seulement ce qui est vide, avec la ville du RÉFÉRENTIEL, jamais le texte tapé", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...arbitree,
      villeSaisie: "lyon, chez M. Untel",
      villeNom: "Lyon",
    });
    const r = await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(r).toEqual({ statut: "completee", clientId: "f1" });
    expect(m.tx.client.update).toHaveBeenCalledTimes(1);
    const data = (
      m.tx.client.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data).toEqual({ adresseVille: "Lyon" });
    expect(data).not.toHaveProperty("statut");
    expect(data).not.toHaveProperty("source");
    expect(data).not.toHaveProperty("raisonSociale");
    expect(data).not.toHaveProperty("siren");
    // La trace « Demande Tour France IA, ville X » est écrite sur la fiche, au nom de l'acteur.
    const trace = (
      m.tx.activityLog.create.mock.calls[0] as unknown as [
        { data: { adminUserId: string | null; changes: { libelle: string } } },
      ]
    )[0];
    expect(trace.data.changes.libelle).toBe("Demande Tour France IA, ville Lyon");
    expect(trace.data.adminUserId).toBe("u1");
    expect(m.ajouterPersonneAFiche).toHaveBeenCalledWith(
      expect.anything(),
      "f1",
      { nom: "Alice Martin", email: "alice@societe-exemple.fr", telephone: "0612345678" },
      "u1",
    );
    const demande = (
      m.tx.tourDemande.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(demande).toEqual({ rattachement: "fiche_completee", clientId: "f1" });
  });

  it("une ville hors référentiel n'est JAMAIS écrite sur la fiche (la personne l'a tapée)", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...arbitree,
      villeSaisie: "Ville inventée",
      villeNom: null,
    });
    await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(m.tx.client.update).not.toHaveBeenCalled();
    expect(m.emettreFaitClient).not.toHaveBeenCalled();
  });

  it("une fiche dont la ville est déjà remplie : rien n'est écrasé", async () => {
    m.tx.client.findFirst.mockResolvedValue({ adresseVille: "Annecy" });
    await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(m.tx.client.update).not.toHaveBeenCalled();
    expect(m.emettreFaitClient).not.toHaveBeenCalled();
  });

  it("une personne déjà connue : on ne remplit que ce qui lui manque", async () => {
    m.ajouterPersonneAFiche.mockResolvedValue({ contactId: "c9", cree: false });
    m.tx.clientContact.findUnique.mockResolvedValue({ nom: "(à compléter)", telephone: " " });
    await completerFicheDepuisDemande("d1", "f1", "u1");
    const maj = (
      m.tx.clientContact.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(maj).toEqual({ telephone: "0612345678", nom: "Alice Martin" });
  });

  it("une fiche qui n'est pas parmi les fiches proches de la demande est refusée", async () => {
    const r = await completerFicheDepuisDemande("d1", "f-autre", "u1");
    expect(r).toEqual({ statut: "refuse", raison: "fiche_non_proche" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("une demande effacée ou écartée n'écrit rien nulle part", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...arbitree, statut: "effacee_rgpd" });
    await expect(completerFicheDepuisDemande("d1", "f1", "u1")).resolves.toEqual({
      statut: "refuse",
      raison: "efface",
    });
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...arbitree, statut: "ecartee" });
    await expect(completerFicheDepuisDemande("d1", "f1", "u1")).resolves.toEqual({
      statut: "refuse",
      raison: "ecartee",
    });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("une demande effacée ENTRE la lecture et le verrou n'écrit rien", async () => {
    m.tx.$queryRaw.mockResolvedValue([{ statut: "effacee_rgpd", client_id: null }]);
    const r = await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(r).toEqual({ statut: "refuse", raison: "efface" });
    expect(m.tx.client.update).not.toHaveBeenCalled();
    expect(m.ajouterPersonneAFiche).not.toHaveBeenCalled();
  });

  it("la demande est verrouillée avant la fiche (FOR UPDATE)", async () => {
    await completerFicheDepuisDemande("d1", "f1", "u1");
    const textes = m.tx.$queryRaw.mock.calls.map((c) => texteSql(c));
    expect(textes[0]).toContain("tour_demandes");
    expect(textes[0]).toContain("FOR UPDATE");
    expect(textes[1]).toContain("clients");
  });

  it("une fiche disparue ou absorbée par une fusion : refusée", async () => {
    m.tx.client.findFirst.mockResolvedValue(null);
    const r = await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(r).toEqual({ statut: "refuse", raison: "fiche_disparue" });
  });

  it("une demande déjà rattachée n'est pas rattachée une seconde fois", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...arbitree, clientId: "f9" });
    const r = await completerFicheDepuisDemande("d1", "f1", "u1");
    expect(r).toEqual({ statut: "deja_rattachee", clientId: "f9" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("creerFicheDepuisDemande", () => {
  const entree = { raisonSociale: "Société Exemple", type: "entreprise" } as const;

  /** Les arguments du dernier appel de la porte unique. */
  function appelDeLaPorte(): {
    donnees: Record<string, unknown>;
    options: Record<string, unknown>;
  } {
    const appel = m.creerOuRetrouverClient.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      unknown,
      Record<string, unknown>,
    ];
    return { donnees: appel[1], options: appel[3] };
  }

  beforeEach(() => {
    m.creerOuRetrouverClient.mockResolvedValue({ statut: "cree", id: "c1", numero: "C-1" });
  });

  it("crée par la porte unique, avec la ville du référentiel seulement, et range la demande", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...ligne,
      villeSaisie: "lyon, chez M. Untel",
    });
    const r = await creerFicheDepuisDemande("d1", entree, "u1");
    expect(r).toEqual({ statut: "cree", clientId: "c1", numero: "C-1" });
    expect(appelDeLaPorte().donnees).toEqual({
      type: "entreprise",
      raisonSociale: "Société Exemple",
      adresseVille: "Lyon",
      source: "Tour France IA",
    });
    const maj = (
      m.tx.tourDemande.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(maj).toEqual({ rattachement: "fiche_creee", clientId: "c1" });
  });

  it("une ville hors référentiel n'est pas écrite sur la nouvelle fiche", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...ligne,
      villeSaisie: "Ville inventée",
      villeNom: null,
    });
    await creerFicheDepuisDemande("d1", entree, "u1");
    expect(appelDeLaPorte().donnees).not.toHaveProperty("adresseVille");
  });

  it("le motif est limité à 300 caractères", async () => {
    await creerFicheDepuisDemande("d1", { ...entree, motif: "m".repeat(400) }, "u1");
    expect(String(appelDeLaPorte().options["motifCreationForcee"])).toHaveLength(300);
  });

  it("refuse une demande effacée à la demande de la personne, avant toute création", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...ligne, statut: "effacee_rgpd" });
    const r = await creerFicheDepuisDemande("d1", entree, "u1");
    expect(r).toEqual({ statut: "refuse", message: "Demande effacée." });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.creerOuRetrouverClient).not.toHaveBeenCalled();
  });

  it("refuse une demande effacée ENTRE la lecture et le verrou (relue dans la transaction)", async () => {
    m.tx.$queryRaw.mockResolvedValue([{ statut: "effacee_rgpd", client_id: null }]);
    const r = await creerFicheDepuisDemande("d1", entree, "u1");
    expect(r).toEqual({ statut: "refuse", message: "Demande effacée." });
    expect(m.creerOuRetrouverClient).not.toHaveBeenCalled();
  });

  it("verrouille la ligne de la demande (FOR UPDATE) avant de créer : deux clics, une fiche", async () => {
    await creerFicheDepuisDemande("d1", entree, "u1");
    const texte = texteSql(m.tx.$queryRaw.mock.calls[0]);
    expect(texte).toContain("tour_demandes");
    expect(texte).toContain("FOR UPDATE");
    m.tx.$queryRaw.mockResolvedValue([{ statut: "recue", client_id: "c-deja" }]);
    m.creerOuRetrouverClient.mockClear();
    const r = await creerFicheDepuisDemande("d1", entree, "u1");
    expect(r).toEqual({ statut: "deja_rattachee", clientId: "c-deja" });
    expect(m.creerOuRetrouverClient).not.toHaveBeenCalled();
  });

  it("refuse une demande écartée, et une porte qui refuse est rendue telle quelle", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({ ...ligne, statut: "ecartee" });
    await expect(creerFicheDepuisDemande("d1", entree, "u1")).resolves.toEqual({
      statut: "refuse",
      message: "Demande écartée.",
    });
    m.prisma.tourDemande.findUnique.mockResolvedValue(ligne);
    m.creerOuRetrouverClient.mockResolvedValue({ statut: "refuse", message: "Adresse connue." });
    await expect(creerFicheDepuisDemande("d1", entree, "u1")).resolves.toEqual({
      statut: "refuse",
      message: "Adresse connue.",
    });
  });
});
