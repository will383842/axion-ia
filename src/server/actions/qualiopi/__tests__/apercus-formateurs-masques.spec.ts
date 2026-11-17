/**
 * Lot I2-4b — les quatre aperçus formateurs (issue d'échange, fin de collaboration,
 * avertissement, nouvelle version du contrat) rendent avec le VRAI destinataire, par la
 * même fonction de rendu que l'envoi, et renvoient au navigateur un `ApercuLecteur`
 * MASQUÉ et INERTE : aucun jeton, aucun `href`.
 *
 * Seuls le rendu (`renderEmailTemplate`) et l'enfilage sont simulés : l'adaptateur
 * `envois.ts` est le vrai. Aucun e-mail ne part.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const JETON = "JETONMARQUEURabcdef0123456789ZZ";
const LIEN = `https://axion-ia.com/fr/portail/signer/${JETON}`;
const OPPOSITION = `https://axion-ia.com/fr/opposition?t=${JETON}`;
const HTML = `<html><body><div data-skip-in-text="true">Pré-entête test</div><p>Bonjour</p><a href="${LIEN}">Se connecter</a><a href="${OPPOSITION}">Se désabonner</a></body></html>`;
const TEXTE = `Bonjour\nSe connecter : ${LIEN}\nSe désabonner : ${OPPOSITION}`;

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  render: vi.fn(),
  enqueue: vi.fn(),
  allume: vi.fn(),
  etatsEntree: vi.fn(),
  preparerIssue: vi.fn(),
  contexte: vi.fn(),
  missions: vi.fn(),
  trainer: vi.fn(),
  dejaParti: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: (...a: unknown[]) => d.trainer(...a) },
    adminUser: { findUnique: vi.fn(async () => ({ name: "Admin" })) },
    emailLog: { findFirst: (...a: unknown[]) => d.dejaParti(...a) },
  },
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueue(...a),
  emailsQueue: null,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: (...a: unknown[]) => d.allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => d.etatsEntree(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs", () => ({
  lireDrapeauEnvoi: () => true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: async () => ({}),
}));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));
vi.mock("@/server/email/textes-valides", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/email/textes-valides")>()),
  estTexteValide: () => true,
}));
vi.mock("@/features/admin-rendezvous/issue-formateur-envoi", () => ({
  preparerIssueFormateur: (...a: unknown[]) => d.preparerIssue(...a),
}));
vi.mock("@/features/admin-job-applications/fiche-formateur-actions", () => ({
  creerFicheFormateurDepuisCandidatureAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/ouverture-dossier", () => ({
  ouvrirDossierRetenu: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/fin-collaboration-service", () => ({
  deciderFinCollaboration: vi.fn(),
  desactiverApresFin: vi.fn(),
  lireContexteFin: (...a: unknown[]) => d.contexte(...a),
  missionsApres: (...a: unknown[]) => d.missions(...a),
  estIndependant: () => true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-cadre-emission", () => ({
  preparerContratCadre: vi.fn(),
  lireFaitsEmissionContrat: vi.fn(),
  versionContratAEmettre: () => 4,
}));
vi.mock("@/server/qualiopi/formateurs-independants/mise-a-niveau", () => ({
  envoyerDossierMiseANiveau: vi.fn(),
  figerListeMiseANiveau: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/templates/versions-arretees", () => ({
  resumeVersionArretee: () => "Résumé des changements",
}));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", () => ({
  emettreLienSignature: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));

import { apercuIssueFormateurAction } from "@/features/admin-rendezvous/issue-formateur-actions";

import { apercuNouvelleVersionAction } from "../formateur-contrat-cadre";
import {
  apercuAvertissementAction,
  apercuFinCollaborationAction,
  envoyerAvertissementFormateurAction,
} from "../formateur-fin-collaboration";

const ID = "00000000-0000-4000-8000-0000000000aa";
const ADRESSE = "camille@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  d.auth.mockResolvedValue({ user: { id: "u1", role: "admin", email: "a@b.c" } });
  d.render.mockResolvedValue({ subject: "Objet test", html: HTML, text: TEXTE, famille: null });
  d.enqueue.mockResolvedValue({ enqueued: true });
  d.allume.mockResolvedValue(true);
  d.etatsEntree.mockResolvedValue({ suivi_echange: true });
  d.contexte.mockResolvedValue({
    trainer: {
      id: ID,
      prenom: "Camille",
      email: ADRESSE,
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      finCollaborationAt: null,
      finCollaborationDecideeAt: null,
      finCollaborationMotifPrevu: null,
      finCollaborationEffetAt: null,
    },
    debutRelation: new Date("2026-01-01T00:00:00Z"),
    avertissementEnvoyeAt: null,
  });
  d.missions.mockResolvedValue([]);
  d.trainer.mockResolvedValue({ prenom: "Camille", email: ADRESSE });
  d.dejaParti.mockResolvedValue(null);
  d.preparerIssue.mockResolvedValue({
    ok: true,
    calendlyEventId: "evt",
    candidatureId: "cand",
    lignes: ["cand"],
    absencesAnterieures: 0,
    envoi: {
      gabarit: "formateur-issue-non-retenu",
      destinataire: ADRESSE,
      payload: { prenom: "Camille" },
      jobId: "j",
    },
    sansEmail: null,
  });
});

/** Ce que le navigateur reçoit ne doit contenir ni jeton ni lien cliquable. */
function verifierLecteur(l: {
  html: string;
  texte?: string | null | undefined;
  objet?: string | null | undefined;
  de?: string | null | undefined;
  a?: string | null | undefined;
  repondreA?: string | null | undefined;
}): void {
  expect(JSON.stringify(l)).not.toContain(JETON); // témoin : le marqueur était dans le rendu
  expect(l.html).not.toMatch(/\shref\s*=/i);
  expect(l.html).toContain("Se connecter"); // le texte du lien reste
  expect(l.texte).toBeTruthy(); // bascule HTML / texte
  expect(l.texte).toContain("[masqué]");
  expect(l.a).toBe(ADRESSE);
  expect(l.de).toBeTruthy();
  expect(l.repondreA).toBeTruthy();
}

describe("le rendu de test porte bien le jeton (témoin)", () => {
  it("le marqueur est dans le HTML simulé", () => {
    expect(HTML).toContain(JETON);
    expect(TEXTE).toContain(JETON);
  });
});

describe("apercuIssueFormateurAction", () => {
  it("renvoie un aperçu masqué et inerte, avec le vrai destinataire", async () => {
    const r = await apercuIssueFormateurAction({ calendlyEventId: "evt", issue: "non_retenu" });
    expect(r.etat).toBe("apercu");
    if (r.etat !== "apercu" || !r.email) throw new Error("aperçu attendu");
    verifierLecteur(r.email);
    expect(d.render).toHaveBeenCalledWith(
      "formateur-issue-non-retenu",
      "fr",
      { prenom: "Camille" },
      { destinataire: ADRESSE },
    );
  });
});

describe("apercuFinCollaborationAction", () => {
  it("renvoie un aperçu masqué et inerte", async () => {
    const r = await apercuFinCollaborationAction({
      trainerId: ID,
      motif: "initiative_axion",
      dateEffet: "2026-12-01",
    });
    if (!("data" in r) || !r.data.email) throw new Error(`aperçu attendu : ${JSON.stringify(r)}`);
    verifierLecteur(r.data.email);
    expect(d.render.mock.calls[0]![3]).toEqual({ destinataire: ADRESSE });
  });
});

describe("apercuAvertissementAction", () => {
  const av = { trainerId: ID, fait: "Trois absences non signalées." };

  it("renvoie un aperçu masqué et inerte", async () => {
    const r = await apercuAvertissementAction(av);
    if (!("data" in r)) throw new Error(`aperçu attendu : ${JSON.stringify(r)}`);
    verifierLecteur(r.data);
  });

  it("aperçu et envoi : même gabarit, même destinataire, même payload", async () => {
    await apercuAvertissementAction(av);
    await envoyerAvertissementFormateurAction(av);
    const [gabarit, , , contexte] = d.render.mock.calls[0]! as [string, string, unknown, unknown];
    const payloadApercu = d.render.mock.calls[0]![2];
    const [gabaritEnvoi, destinataire, locale, payloadEnvoi] = d.enqueue.mock.calls[0]! as [
      string,
      string,
      string,
      unknown,
    ];
    expect(gabaritEnvoi).toBe(gabarit);
    expect(destinataire).toBe((contexte as { destinataire: string }).destinataire);
    expect(locale).toBe("fr");
    expect(payloadEnvoi).toEqual(payloadApercu);
  });
});

describe("apercuNouvelleVersionAction", () => {
  it("renvoie un aperçu masqué et inerte", async () => {
    const r = await apercuNouvelleVersionAction({ trainerId: ID });
    if (!("data" in r)) throw new Error(`aperçu attendu : ${JSON.stringify(r)}`);
    verifierLecteur(r.data.apercu);
    expect(r.data.texteValide).toBe(true);
    expect(d.render.mock.calls[0]![3]).toEqual({ destinataire: ADRESSE });
  });
});

describe("aucun e-mail ne part pour un aperçu", () => {
  it("les quatre aperçus n'enfilent rien", async () => {
    await apercuIssueFormateurAction({ calendlyEventId: "evt", issue: "non_retenu" });
    await apercuFinCollaborationAction({
      trainerId: ID,
      motif: "initiative_axion",
      dateEffet: "2026-12-01",
    });
    await apercuAvertissementAction({ trainerId: ID, fait: "x" });
    await apercuNouvelleVersionAction({ trainerId: ID });
    expect(d.enqueue).not.toHaveBeenCalled();
  });
});
