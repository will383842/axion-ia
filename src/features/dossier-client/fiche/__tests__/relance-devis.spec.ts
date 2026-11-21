/**
 * Lot B9 — la relance de devis est un BROUILLON garé « à valider », jamais un envoi.
 * Tout est simulé : aucun transport d'e-mail n'est jamais appelé (un espion le prouve).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE_CLIENT = "22222222-2222-4222-8222-222222222222";
const DEVIS = "33333333-3333-4333-8333-333333333333";

const m = vi.hoisted(() => ({
  devis: vi.fn(),
  unique: vi.fn(),
  compte: vi.fn(),
  trace: vi.fn(),
  outbox: vi.fn(),
  attente: vi.fn(),
  garer: vi.fn(),
  garde: vi.fn(),
  echanges: vi.fn(),
  log: vi.fn(),
  transport: vi.fn(),
  liste: vi.fn(),
  refuser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findFirst: m.devis, findUnique: m.unique, count: m.compte },
    activityLog: { findFirst: m.trace },
    emailOutbox: {
      // Un e-mail `devis-envoi` en attente (B3) ou un brouillon de relance déjà à valider.
      findFirst: (a: { where: { template: string } }) =>
        a.where.template === "devis-envoi" ? m.attente(a) : m.outbox(a),
      findMany: m.liste,
      updateMany: m.refuser,
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: m.garde,
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/email/outbox-service", () => ({ garerPourValidation: m.garer }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.transport }));
vi.mock("@/lib/email/client", () => ({ sendEmail: m.transport }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.transport }) },
  createTransport: () => ({ sendMail: m.transport }),
}));
vi.mock("../../acces", () => ({
  AccesRefuse: class AccesRefuse extends Error {},
  exigerAccesEchanges: m.echanges,
}));

import { preparerRelanceDevisAction } from "../actions-relance-devis";
import {
  construireRelanceDevis,
  ERREUR_CONTACT_ABSENT,
  ERREUR_DEVIS_INTROUVABLE,
  ERREUR_DEVIS_PERIME,
  ERREUR_DEVIS_REMIS_MAIN_PROPRE,
  ERREUR_GARAGE,
  MESSAGE_RELANCE_GAREE,
  MESSAGE_RELANCE_PRETE,
  MESSAGE_RELANCE_GAREE_SANS_LIEN,
  ERREUR_PDF_ABSENT,
  ERREUR_FORMULES_SANS_PIECE,
  ERREUR_EMAIL_DEVIS_EN_ATTENTE,
  CLE_MARQUEUR_LIEN,
} from "../relance-devis";
import { readFileSync } from "node:fs";

function formulaire(clientId = CLIENT, devisId = DEVIS): FormData {
  const fd = new FormData();
  fd.set("clientId", clientId);
  fd.set("devisId", devisId);
  return fd;
}

async function lancer(fd = formulaire()): Promise<string> {
  try {
    await preparerRelanceDevisAction(fd);
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (digest?.startsWith("NEXT_REDIRECT")) return decodeURIComponent(digest);
    throw e;
  }
  return "";
}

const DEVIS_ENVOYE = {
  id: DEVIS,
  numero: "AXI-DEV-2026-014",
  sentAt: new Date("2026-10-01T10:00:00Z"),
  dateValidite: new Date(Date.now() + 86_400_000),
  client: {
    raisonSociale: "Atelier Martin",
    contactNom: null,
    contactEmail: "compta@martin.example",
    contactCivilite: "monsieur",
    contactPrenom: "Paul",
    contactNomFamille: "Martin",
  },
  documentGenereId: "piece-1",
  fichierPdfUrl: "documents/2026/devis/AXI-DEV-2026-014.pdf",
  offre: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ userId: "u1", role: "admin" });
  m.echanges.mockResolvedValue({ userId: "u1", role: "admin" });
  m.devis.mockImplementation(async (a: { where: { clientId: string; statut: string } }) =>
    a.where.clientId === CLIENT && a.where.statut === "envoye" ? DEVIS_ENVOYE : null,
  );
  m.unique.mockResolvedValue({ statut: "envoye", dateValidite: new Date(Date.now() + 86_400_000) });
  m.compte.mockResolvedValue(1); // 1 = non signé par le client
  m.trace.mockResolvedValue(null);
  m.outbox.mockResolvedValue(null);
  m.attente.mockResolvedValue(null);
  m.garer.mockResolvedValue("outbox-1");
  m.liste.mockResolvedValue([{ id: "outbox-1", createdAt: new Date() }]);
  m.refuser.mockResolvedValue({ count: 0 });
});

describe("relance de devis (lot B9)", () => {
  it("gare le brouillon avec les bons clientId, entityType, entityId — sans rien envoyer", async () => {
    const url = await lancer();
    expect(m.garer).toHaveBeenCalledTimes(1);
    const arg = m.garer.mock.calls[0]![0];
    expect(arg).toMatchObject({
      template: "relance-devis-client",
      recipient: "compta@martin.example",
      clientId: CLIENT,
      entityType: "Devis",
      entityId: DEVIS,
    });
    expect(arg.jobId).toBe(`relance-devis:${DEVIS}`);
    expect(url).toContain("onglet=devis-factures");
    expect(url).toContain("message=");
    expect(m.transport).not.toHaveBeenCalled();
    expect(m.log).toHaveBeenCalledTimes(1);
  });

  it("lancée depuis la page du devis : le résultat revient sur CE devis, même action", async () => {
    const fd = formulaire();
    fd.set("retourDevis", DEVIS);
    const url = await lancer(fd);
    expect(m.garer).toHaveBeenCalledTimes(1);
    expect(url).toContain(`/qualiopi/devis/${DEVIS}?message=`);
    expect(url).not.toContain("/qualiopi/clients/");
  });
  it("retourDevis forgé (pas un UUID) : retour classique sur la fiche client", async () => {
    const fd = formulaire();
    fd.set("retourDevis", "https://evil.example");
    expect(await lancer(fd)).toContain(`/qualiopi/clients/${CLIENT}`);
  });
  it("refuse le devis d'un autre client", async () => {
    const url = await lancer(formulaire(AUTRE_CLIENT));
    expect(url).toContain(ERREUR_DEVIS_INTROUVABLE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("n'accepte que les devis au statut envoyé (le filtre est dans la requête)", async () => {
    await lancer();
    expect(m.devis.mock.calls[0]![0].where).toMatchObject({
      id: DEVIS,
      clientId: CLIENT,
      statut: "envoye",
    });
    m.devis.mockResolvedValue(null);
    const url = await lancer();
    expect(url).toContain(ERREUR_DEVIS_INTROUVABLE);
    expect(m.garer).toHaveBeenCalledTimes(1);
  });

  it("refuse le doublon : un brouillon déjà à valider", async () => {
    m.outbox.mockResolvedValue({ id: "deja" });
    const url = await lancer();
    expect(url).toContain(MESSAGE_RELANCE_PRETE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("garerPourValidation rend null : erreur, rien n'est envoyé", async () => {
    m.garer.mockResolvedValue(null);
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(url).toContain(ERREUR_GARAGE);
    expect(m.transport).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("refuse un rôle sans accès, avant toute lecture", async () => {
    m.echanges.mockRejectedValue(new Error("forbidden"));
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(m.devis).not.toHaveBeenCalled();
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("refuse le rôle en lecture seule : base non lue, rien garé", async () => {
    m.garde.mockRejectedValue(new Error("lecture seule"));
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(m.devis).not.toHaveBeenCalled();
    expect(m.outbox).not.toHaveBeenCalled();
    expect(m.garer).not.toHaveBeenCalled();
    expect(m.transport).not.toHaveBeenCalled();
  });

  it("devis envoyé mais périmé : erreur claire, rien garé", async () => {
    m.devis.mockResolvedValue({ ...DEVIS_ENVOYE, dateValidite: new Date(Date.now() - 1000) });
    const url = await lancer();
    expect(url).toContain(ERREUR_DEVIS_PERIME);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("devis remis en main propre : redirection avec l'erreur, rien garé, rien journalisé (I1)", async () => {
    m.trace.mockResolvedValue({ id: "trace-1" });
    const url = await lancer();
    expect(url).toContain(`erreur=${ERREUR_DEVIS_REMIS_MAIN_PROPRE}`);
    expect(m.garer).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("devis signé par le client : erreur, rien de garé", async () => {
    m.compte.mockResolvedValue(0);
    const url = await lancer();
    expect(url).toContain("Le client a déjà signé ce devis");
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("devis sans trace de main propre : chemin inchangé (I1)", async () => {
    m.trace.mockResolvedValue(null);
    await lancer();
    expect(m.garer).toHaveBeenCalledTimes(1);
  });

  it("double clic : deux appels simultanés, le surplus est refusé (jamais supprimé)", async () => {
    // Le contrôle préalable laisse passer les deux appels (pas atomique).
    m.outbox.mockResolvedValue(null);
    m.garer.mockResolvedValueOnce("outbox-1").mockResolvedValueOnce("outbox-2");
    m.liste.mockResolvedValue([
      { id: "outbox-1", createdAt: new Date(1000) },
      { id: "outbox-2", createdAt: new Date(2000) },
    ]);
    const [a, b] = await Promise.all([lancer(), lancer()]);
    expect(m.garer).toHaveBeenCalledTimes(2);
    const urls = [a, b];
    expect(urls.filter((u) => u.includes(MESSAGE_RELANCE_PRETE))).toHaveLength(1);
    expect(urls.filter((u) => u.includes(MESSAGE_RELANCE_GAREE))).toHaveLength(1);
    expect(m.log).toHaveBeenCalledTimes(1);
    expect(m.refuser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["outbox-2"] } }),
        data: expect.objectContaining({ statut: "refuse" }),
      }),
    );
    expect(m.transport).not.toHaveBeenCalled();
  });

  it("B3 — gare le PDF en pièce jointe et le marqueur « le lien naît à l'envoi », sans lien ni jeton", async () => {
    await lancer();
    const arg = m.garer.mock.calls[0]![0];
    expect(arg.attachments).toEqual([
      { filename: "AXI-DEV-2026-014.pdf", r2Key: "documents/2026/devis/AXI-DEV-2026-014.pdf" },
    ]);
    expect(arg.payload[CLE_MARQUEUR_LIEN]).toEqual({
      v: 1,
      nature: "devis-renvoi",
      documentGenereId: "piece-1",
      partie: "client",
      devisId: DEVIS,
    });
    expect(arg.payload.pieceJointe).toBe(true);
    expect(arg.payload.salutation).toEqual({ civilite: "monsieur", nomFamille: "Martin" });
    const brut = JSON.stringify(arg.payload);
    expect(brut).not.toMatch(/signatureUrl|token|jeton|\/portail\//i);
    // Journal : ni URL ni adresse, seulement « avecLien ».
    expect(m.log.mock.calls[0]![0].changes).toEqual({
      outboxId: "outbox-1",
      numero: "AXI-DEV-2026-014",
      avecLien: true,
    });
    expect(JSON.stringify(m.log.mock.calls)).not.toContain("martin.example");
  });

  it("B3 — devis classique (sans pièce signable) : PDF joint, pas de marqueur, le message le dit", async () => {
    m.devis.mockResolvedValue({ ...DEVIS_ENVOYE, documentGenereId: null });
    const url = await lancer();
    const arg = m.garer.mock.calls[0]![0];
    expect(arg.payload).not.toHaveProperty(CLE_MARQUEUR_LIEN);
    expect(arg.attachments).toHaveLength(1);
    expect(url).toContain(MESSAGE_RELANCE_GAREE_SANS_LIEN);
    expect(m.log.mock.calls[0]![0].changes.avecLien).toBe(false);
  });

  it("B3 — PDF absent : refus, rien garé", async () => {
    m.devis.mockResolvedValue({ ...DEVIS_ENVOYE, fichierPdfUrl: null });
    expect(await lancer()).toContain(ERREUR_PDF_ABSENT);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("B3 — devis à formules sans pièce : refus, rien garé", async () => {
    m.devis.mockResolvedValue({ ...DEVIS_ENVOYE, documentGenereId: null, offre: { v: 1 } });
    expect(await lancer()).toContain(ERREUR_FORMULES_SANS_PIECE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("B3 — un e-mail de devis (envoi ou renvoi) attend déjà : refus, rien garé", async () => {
    m.attente.mockResolvedValue({ id: "devis-envoi-en-attente" });
    expect(await lancer()).toContain(ERREUR_EMAIL_DEVIS_EN_ATTENTE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("B3 — la clé du marqueur copiée ici est celle du module à l'envoi", () => {
    // Lu en texte : importer le module du domaine ici violerait le cloisonnement.
    const src = readFileSync("src/server/qualiopi/documents/signature/lien-a-l-envoi.ts", "utf8");
    expect(/export const CLE_MARQUEUR = "([^"]+)"/.exec(src)?.[1]).toBe(CLE_MARQUEUR_LIEN);
  });

  it("contact absent : erreur, rien garé", async () => {
    m.devis.mockResolvedValue({
      ...DEVIS_ENVOYE,
      client: { raisonSociale: "Atelier Martin", contactEmail: "" },
    });
    const url = await lancer();
    expect(url).toContain(ERREUR_CONTACT_ABSENT);
    expect(m.garer).not.toHaveBeenCalled();
  });
});

describe("texte de la relance", () => {
  const r = construireRelanceDevis({
    numero: "AXI-DEV-2026-014",
    envoyeLe: new Date("2026-10-01T10:00:00Z"),
    raisonSociale: "Atelier Martin",
    contactEmail: "compta@martin.example",
    devisId: DEVIS,
    documentGenereId: "piece-1",
    fichierPdfUrl: "documents/2026/devis/AXI-DEV-2026-014.pdf",
  });

  it("ne porte ni montant ni mot interdit", () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texte = `${r.sujet} ${JSON.stringify(r.payload)}`;
    expect(texte).not.toMatch(/€|\d\s?(?:HT|TTC)|euros?/i);
    expect(texte).not.toMatch(/certifi|qualiopi|grenoble|gain garanti/i);
    expect(r.payload.dateEnvoi).toBe("01/10/2026");
  });
});
