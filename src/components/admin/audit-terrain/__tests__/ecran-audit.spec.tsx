/**
 * Audit présentiel PR3 : écran « Audit » (droits, rendu, état vide, session sans données) et encart d'entrée.
 * Base et déchiffrement simulés.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const SID = "22222222-2222-4222-8222-222222222222";
const RID = "33333333-3333-4333-8333-333333333333";

const garde = vi.hoisted(() => vi.fn());
const journal = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());
const bd = vi.hoisted(() => ({
  client: { findUnique: vi.fn() },
  auditTerrainSession: { findMany: vi.fn(), findFirst: vi.fn() },
  auditTerrainEvenement: { findMany: vi.fn() },
  auditTerrainRapport: { findFirst: vi.fn() },
  activityLog: { findMany: vi.fn() },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/audit-terrain/journal", () => ({
  ecrireJournalActivite: (...a: unknown[]) => journal(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/features/dossier-client/acces", () => ({
  gardeLectureEchanges: (...a: unknown[]) => garde(...a),
}));
// « Chiffré » = préfixe : le test vérifie que la lecture passe bien par le déchiffrement.
vi.mock("@/lib/chiffrer-parole", () => ({
  dechiffrerParole: (v: string) => {
    if (!v.startsWith("enc:")) throw new Error("clair interdit");
    return v.slice(4);
  },
}));
vi.mock("@/features/admin-audit-terrain/actions", () => ({
  creerJetonAudit: vi.fn(),
  validerRapportAudit: vi.fn(),
}));
vi.mock("@/features/admin-audit-terrain/actions-fiche", () => ({
  revoquerJetonDeLaFiche: vi.fn(),
  regenererJetonDeLaFiche: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import AuditPage from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/audit/page";
import { EncartAudit } from "../EncartAudit";

const params = (id = CID) => Promise.resolve({ locale: "fr" as const, adminPrefix: "console", id });
const sp = (o: Record<string, string> = {}) => Promise.resolve(o);
const rendre = async (id = CID, q: Record<string, string> = {}): Promise<string> =>
  renderToStaticMarkup(await AuditPage({ params: params(id), searchParams: sp(q) }));

const T = new Date("2026-11-06T08:30:00Z");
const session = (o = {}) => ({
  id: SID,
  statut: "ouverte",
  jetonExpireLe: new Date("2099-01-01T00:00:00Z"),
  jetonRevoqueLe: null,
  dernierSeq: 2,
  derniereEtapeIndex: 4,
  dernierEnvoiLe: T,
  creeLe: T,
  ...o,
});
const ligne = (seq: number, type: string, etapeIndex: number, donnees: unknown) => ({
  seq,
  type,
  etape: "Les personnes",
  etapeIndex,
  heurePc: T,
  recuLe: T,
  donneesChiffrees: `enc:${JSON.stringify(donnees)}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  garde.mockResolvedValue({ autorise: true, role: "super_admin", peutEcrire: true });
  authMock.mockResolvedValue({ user: { id: "u", role: "super_admin" } });
  bd.client.findUnique.mockResolvedValue({ id: CID, raisonSociale: "Société Test Tablier" });
  bd.auditTerrainSession.findMany.mockResolvedValue([]);
  bd.auditTerrainEvenement.findMany.mockResolvedValue([]);
  bd.auditTerrainRapport.findFirst.mockResolvedValue(null);
  bd.activityLog.findMany.mockResolvedValue([]);
  journal.mockResolvedValue(undefined);
});

describe("page Audit : droits", () => {
  it("un rôle autre que super_admin voit un refus nommé et AUCUNE lecture n'a lieu", async () => {
    garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
    const html = await rendre();
    expect(html).toContain("réservé au super administrateur");
    expect(bd.client.findUnique).not.toHaveBeenCalled();
    expect(bd.auditTerrainSession.findMany).not.toHaveBeenCalled();
    expect(bd.auditTerrainEvenement.findMany).not.toHaveBeenCalled();
  });
  it("un accès refusé par la garde commune n'ouvre aucune lecture", async () => {
    garde.mockResolvedValue({ autorise: false, role: null, motif: "Pas de rôle." });
    expect(await rendre()).toContain("Pas de rôle.");
    expect(bd.client.findUnique).not.toHaveBeenCalled();
  });
  it("identifiant invalide ou fiche absente : 404", async () => {
    await expect(rendre("pas-un-uuid")).rejects.toThrow("NOT_FOUND");
    bd.client.findUnique.mockResolvedValue(null);
    await expect(rendre()).rejects.toThrow("NOT_FOUND");
  });
});

describe("page Audit : contenu", () => {
  it("état vide : aucun audit, bouton « Créer le jeton » présent", async () => {
    const html = await rendre();
    expect(html).toContain("Aucun audit pour cette fiche");
    expect(html).toContain("Créer le jeton");
  });

  it("session sans données reçues : « Pas encore commencé », journal vide, pas d'erreur", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([
      session({ dernierSeq: 0, derniereEtapeIndex: 0, dernierEnvoiLe: null }),
    ]);
    const html = await rendre();
    expect(html).toContain("Pas encore commencé");
    expect(html).toContain("Rien reçu pour l&#x27;instant");
    expect(html).toContain("Aucun poste reçu");
    expect(html).toContain("Pas encore de brouillon");
  });

  it("session en cours : étape 4 sur 7, postes, tâches ; ni prénom, ni prix", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainEvenement.findMany.mockResolvedValue([
      ligne(1, "etape_validee", 3, {
        "abos.liste": ["a"],
        "abo.a.nom": "Outil X",
        "abo.a.montant": 4242,
        "abo.a.qui": "Camille-SECRET",
      }),
      ligne(2, "entretien_valide", 4, {
        "personnes.liste": ["p1"],
        "p.p1.poste": "Comptable",
        "p.p1.statut": "valide",
        "p.p1.prenom": "Camille-SECRET",
        "p.p1.taches": ["t"],
        "p.p1.t.t.nom": "Saisie",
        "p.p1.t.t.fois": 4,
        "p.p1.t.t.minutes": 30,
      }),
    ]);
    const html = await rendre();
    expect(html).toContain("Étape 4 sur 7");
    expect(html).toContain("Comptable");
    expect(html).toContain("Saisie");
    expect(html).toContain("Outil X");
    expect(html).toContain("entretien validé");
    expect(html).not.toContain("SECRET");
    expect(html).not.toContain("4242");
    expect(html).not.toMatch(/€|EUR/);
  });

  it("brouillon du rapport à relire : texte échappé, bouton « Valider »", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainRapport.findFirst.mockResolvedValue({
      id: RID,
      version: 1,
      source: "gabarit",
      statut: "a_relire",
      creeLe: T,
      valideLe: null,
      contenuChiffre: `enc:${JSON.stringify({ source: "gabarit", resume: "<script>alert(1)</script> Bonjour" })}`,
    });
    const html = await rendre();
    expect(html).toContain("brouillon à relire");
    expect(html).toContain(">Valider<");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("rapport illisible : alerte, pas de bouton Valider", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainRapport.findFirst.mockResolvedValue({
      id: RID,
      version: 1,
      source: "gabarit",
      statut: "a_relire",
      creeLe: T,
      valideLe: null,
      contenuChiffre: "en clair, pas chiffré",
    });
    const html = await rendre();
    expect(html).toContain("illisible");
    expect(html).not.toContain(">Valider<");
  });

  it("jeton révoqué : libellé, pas de bouton de révocation, pas de mise à jour automatique", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session({ jetonRevoqueLe: T })]);
    const html = await rendre();
    expect(html).toContain("Jeton révoqué");
    expect(html).not.toContain("Révoquer le jeton");
    expect(html).toContain("pas de mise à jour automatique");
  });

  it("base en panne : message sobre, sans détail technique", async () => {
    bd.auditTerrainSession.findMany.mockRejectedValue(new Error("secret-db-detail"));
    const html = await rendre();
    expect(html).toContain("Lecture de l&#x27;audit impossible");
    expect(html).not.toContain("secret-db-detail");
  });
});

describe("page Audit : journal de consultation, filtre du rapport, jeton, refus", () => {
  it("chaque consultation est journalisée SANS contenu", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainEvenement.findMany.mockResolvedValue([
      ligne(1, "etape_validee", 4, { "p.p1.poste": "Comptable-CONTENU" }),
    ]);
    await rendre();
    expect(journal).toHaveBeenCalledTimes(1);
    const [, entree] = journal.mock.calls[0] as [
      unknown,
      { action: string; targetId: string; changes: unknown },
    ];
    expect(entree).toMatchObject({
      action: "audit-terrain.consulte",
      targetId: CID,
      changes: { sessionId: SID },
    });
    expect(JSON.stringify(journal.mock.calls)).not.toContain("CONTENU");
  });
  it("aucune consultation journalisée pour un refus de droits", async () => {
    garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
    await rendre();
    expect(journal).not.toHaveBeenCalled();
  });
  it("si le journal échoue, rien n'est affiché", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainEvenement.findMany.mockResolvedValue([
      ligne(1, "etape_validee", 4, { "p.p1.poste": "Comptable-CONTENU" }),
    ]);
    journal.mockRejectedValue(new Error("journal HS"));
    const html = await rendre();
    expect(html).toContain("Lecture de l&#x27;audit impossible");
    expect(html).not.toContain("CONTENU");
  });
  it("le brouillon du rapport ne montre jamais qui / prénom / nom_personne", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.auditTerrainRapport.findFirst.mockResolvedValue({
      id: RID,
      version: 1,
      source: "gabarit",
      statut: "a_relire",
      creeLe: T,
      valideLe: null,
      contenuChiffre: `enc:${JSON.stringify({ source: "gabarit", resume: "Bonjour", qui: "Camille-SECRET", prenom: "Zoé-SECRET", nom_personne: "Dupont-SECRET", sections: [{ titre: "T", Prenom: "Max-SECRET", texte: "Corps" }] })}`,
    });
    const html = await rendre();
    expect(html).toContain("Bonjour");
    expect(html).toContain("Corps");
    expect(html).not.toContain("SECRET");
  });
  it("« Régénérer le jeton » : présent pour une séance ouverte ou révoquée, masqué si elle est close", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([
      session(),
      session({ id: "44444444-4444-4444-8444-444444444444", statut: "close" }),
    ]);
    const html = await rendre();
    expect(html.match(/Régénérer le jeton/g)).toHaveLength(1);
  });
  it("le journal montre les refus : plafond atteint et événement trop gros", async () => {
    bd.auditTerrainSession.findMany.mockResolvedValue([session()]);
    bd.activityLog.findMany.mockResolvedValue([
      {
        createdAt: T,
        changes: { statut: 200, rejetes: 2, motifs: ["trop_gros", "limite_session"] },
      },
      { createdAt: T, changes: { statut: 200, rejetes: 1 } },
    ]);
    const html = await rendre();
    expect(html).toContain("trop_gros");
    expect(html).toContain("limite_session");
    expect(html).toContain("motif non conservé");
  });
});

describe("encart d'entrée dans le suivi des prestations", () => {
  const rendreEncart = async (): Promise<string> =>
    renderToStaticMarkup(
      (await EncartAudit({ clientId: CID, ficheHref: `/fr/console/qualiopi/clients/${CID}` })) ?? (
        <></>
      ),
    );
  it("rien pour un autre rôle, et aucune lecture", async () => {
    authMock.mockResolvedValue({ user: { id: "u", role: "admin" } });
    expect(await rendreEncart()).toBe("");
    expect(bd.auditTerrainSession.findFirst).not.toHaveBeenCalled();
  });
  it("rien sans session", async () => {
    authMock.mockResolvedValue(null);
    expect(await rendreEncart()).toBe("");
  });
  it("super_admin sans audit : lien vers la sous-page", async () => {
    bd.auditTerrainSession.findFirst.mockResolvedValue(null);
    const html = await rendreEncart();
    expect(html).toContain("Aucun audit présentiel");
    expect(html).toContain(`/clients/${CID}/audit`);
  });
  it("super_admin avec audit : étape 4 sur 7", async () => {
    bd.auditTerrainSession.findFirst.mockResolvedValue({
      derniereEtapeIndex: 4,
      dernierEnvoiLe: T,
      jetonRevoqueLe: null,
      jetonExpireLe: T,
    });
    expect(await rendreEncart()).toContain("Étape 4 sur 7");
  });
});
