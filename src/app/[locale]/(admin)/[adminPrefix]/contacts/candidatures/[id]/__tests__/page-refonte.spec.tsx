// Rendu RÉEL de la fiche candidature, données simulées : la refonte est
// branchée dans `page.tsx` (tuiles, pastille d'état, motif visible).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";

const detail = vi.fn();
const invitationAllumee = vi.fn(async () => false);
const videosMock = vi.fn(async () => [
  { id: "v1", nomOriginal: "montage.mp4", taille: 1000, statut: "analyse", motifRejet: null },
]);
const candidatureLue = vi.fn(async (): Promise<unknown> => null);
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "admin" } }) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin-inbox/reads", () => ({ markInboxRead: async () => undefined }));
vi.mock("@/features/admin-job-applications/actions", () => ({
  getApplicationDetailAction: (...a: unknown[]) => detail(...a),
  updateApplicationStatusAction: vi.fn(),
  deleteApplicationAction: vi.fn(),
}));
vi.mock("@/features/admin-job-offers/actions", () => ({
  getJobOfferDetailAction: async () => null,
}));
vi.mock("@/features/admin-job-applications/timeline", () => ({
  lireFrise: async () => [],
  lireEntretiens: async () => [],
  LIBELLE_EVENEMENT: {},
  LIBELLE_LIVRAISON: {},
}));
vi.mock("@/features/admin-job-applications/accuse-reception", () => ({
  lireAccuseReception: async () => null,
}));
vi.mock("@/features/admin-job-applications/proposer-reseau", () => ({
  ficheApporteurDeLaCandidature: async () => null,
  proposerReseauApporteursAction: vi.fn(),
}));
vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  repondreAuCandidatAction: vi.fn(),
  rejouerReponseEchoueeAction: vi.fn(),
  etatLivraisonReponseAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  invitationAutoFormateursAllumee: () => invitationAllumee(),
  lireEtatsEntree: async () => ({ modeles_composeur: false }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/suivi-invitations", () => ({
  resumeInvitationDeLaFiche: async () => null,
}));
vi.mock("@/server/careers/videos-candidat", () => ({ relancerAnalysesEnAttente: async () => 0 }));
vi.mock("@/server/auth/habilitations", () => ({ peutEngager: () => false }));
vi.mock("@/env", () => ({ env: { CALENDLY_APPORTEUR_URL: undefined } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationLink: { findMany: async () => [] },
    jobApplicationVideo: {
      findMany: () => videosMock(),
    },
    trainer: { findUnique: async () => null },
    jobApplication: { findUnique: () => candidatureLue() },
  },
}));

// Composant serveur asynchrone (lit la boîte Zoho) : hors sujet de la présentation.
vi.mock("../ReponsesRecuesCandidat", () => ({ ReponsesRecuesCandidat: () => null }));

import Page from "../page";

function candidature(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    civility: null,
    firstName: "Amina",
    lastName: "Test",
    email: "a@exemple.invalid",
    phone: "0600000000",
    city: null,
    currentRole: null,
    experienceBand: null,
    availability: null,
    salaryExpectation: null,
    linkedinUrl: null,
    hasDriverLicense: null,
    hasVehicle: null,
    hasCv: false,
    cvOriginalName: null,
    hasPhoto: false,
    photoMimeType: null,
    photoOriginalName: null,
    motivation: null,
    answers: { q1: "oui" },
    offerId: null,
    offerTitleSnap: "Monteur vidéo",
    submittedAt: new Date("2026-10-01T10:00:00Z"),
    status: "rejected",
    rejectionReason: "competences_insuffisantes",
    internalNotes: null,
    assignedTo: null,
    needsAttention: false,
    trainerId: null,
    ...over,
  };
}

async function rendre(over: Record<string, unknown> = {}): Promise<HTMLElement> {
  detail.mockResolvedValue(candidature(over));
  const el = await Page({ params: Promise.resolve({ adminPrefix: "pilotage", id: "x" }) });
  return render(el).container;
}

beforeEach(() => {
  cleanup();
  detail.mockReset();
  invitationAllumee.mockReset().mockResolvedValue(false);
  candidatureLue.mockReset().mockResolvedValue(null);
});

describe("fiche candidature — refonte branchée", () => {
  it("affiche les chiffres clés en tuiles", async () => {
    await rendre();
    const liste = screen.getByRole("list", { name: /Chiffres clés/ });
    const items = within(liste).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText("Travaux à voir")).toBeTruthy();
    expect(within(items[0]!).getByText("1")).toBeTruthy();
  });

  it("affiche l'état de la candidature en pastille, avec un libellé français", async () => {
    const c = await rendre();
    expect(c.querySelector(".admin-badge-plein--destructive")?.textContent).toContain("Écartée");
    expect(c.textContent).not.toMatch(/\brejected\b/);
  });

  it("garde le motif de refus VISIBLE, hors de tout <details>", async () => {
    const c = await rendre();
    const encadre = c.querySelector(".admin-alert-error");
    expect(encadre?.textContent).toContain("Compétences insuffisantes");
    expect(encadre?.closest("details")).toBeNull();
  });

  it("n'affiche pas de motif pour une candidature en cours", async () => {
    const c = await rendre({ status: "reviewing", rejectionReason: null });
    expect(c.querySelector(".admin-alert-error")).toBeNull();
    expect(c.querySelector(".admin-badge-plein--neutral")?.textContent).toContain("En revue");
  });

  it("conserve les libellés lus par les parcours de bout en bout", async () => {
    await rendre();
    expect(screen.getByRole("heading", { name: /^entretiens$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^historique$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /planifier un entretien/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /répondre au candidat/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /consigner un fait/i })).toBeTruthy();
    expect(screen.getByText(/aucun entretien/i)).toBeTruthy();
    expect(screen.getByText(/n.a encore été consigné/i)).toBeTruthy();
  });

  it("garde le formulaire de suivi et ses champs", async () => {
    const c = await rendre();
    expect(c.querySelector("#status")).not.toBeNull();
    expect(c.querySelector("#rejectionReason")).not.toBeNull();
  });

  it("garde le passage « L'échange a eu lieu ? » et son lien VISIBLES, hors de tout <details>", async () => {
    invitationAllumee.mockResolvedValue(true);
    candidatureLue.mockResolvedValue({
      invitationFormateurAt: null,
      rattrapageAt: null,
      clotureSansSuiteAt: null,
    });
    await rendre({
      status: "reviewing",
      rejectionReason: null,
      offerTitleSnap: "Formateur IA indépendant (freelance)",
    });
    const lien = screen.getByRole("link", { name: /à faire le point/i });
    expect(lien.closest("details")).toBeNull();
    expect(lien.getAttribute("href")).toBe("/fr/pilotage/rendez-vous?vue=point");
    expect(screen.getByText(/L.échange a eu lieu/)).toBeTruthy();
  });

  it("enveloppe pastille, motif et tuiles dans un conteneur espacé", async () => {
    const c = await rendre();
    const conteneur = c.querySelector(".mb-\\[var\\(--space-admin-6\\)\\]");
    expect(conteneur).not.toBeNull();
    expect(conteneur!.className).toContain("space-y-[var(--space-admin-4)]");
    expect(conteneur!.className).not.toMatch(/\bgap-/);
    expect(conteneur!.querySelector(".admin-badge-plein--destructive")).not.toBeNull();
    expect(conteneur!.querySelector(".admin-alert-error")).not.toBeNull();
    expect(
      within(conteneur as HTMLElement).getByRole("list", { name: /Chiffres clés/ }),
    ).toBeTruthy();
  });

  it("ne plante pas sur un état de vidéo inconnu et n'affiche pas de pastille", async () => {
    videosMock.mockResolvedValueOnce([
      { id: "v9", nomOriginal: "bizarre.mp4", taille: 10, statut: "inconnu_x", motifRejet: null },
    ]);
    const c = await rendre();
    expect(screen.getByText(/bizarre\.mp4/)).toBeTruthy();
    expect(c.textContent).not.toMatch(/inconnu_x/);
  });
});
