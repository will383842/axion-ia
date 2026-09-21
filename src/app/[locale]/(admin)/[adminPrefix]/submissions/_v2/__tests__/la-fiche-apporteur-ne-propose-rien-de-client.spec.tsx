/**
 * Sur la fiche d'un apporteur, aucun geste de CLIENT.
 *
 * La fiche d'un message est partagée par tous les canaux. Elle proposait donc,
 * sur un apporteur d'affaires, « Convertir en client » (ou « Créer le devis »
 * quand l'adresse était déjà connue) et une carte « Identité société » vide :
 * trois invitations à traiter comme un prospect quelqu'un qui recommande
 * Axion-IA. Au mieux du bruit ; au pire une fiche client créée pour un
 * apporteur, et un devis qui n'a aucun sens.
 *
 * Le test vérifie les DEUX sens : absents pour un apporteur, présents pour une
 * demande client. Sans le second, supprimer ces boutons partout passerait au
 * vert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";

const getSubmissionDetailAction = vi.fn();
const findClientByEmail = vi.fn();

vi.mock("@/auth", () => ({ auth: () => Promise.resolve({ user: { id: "admin-1" } }) }));
vi.mock("@/features/admin-submissions/actions", () => ({
  getSubmissionDetailAction: (...a: unknown[]) => getSubmissionDetailAction(...a),
}));
vi.mock("@/server/qualiopi/crm/entrees", () => ({
  findClientByEmail: (...a: unknown[]) => findClientByEmail(...a),
}));
vi.mock("@/features/personne/fiche-personne", () => ({
  lireFichePersonne: () => Promise.resolve({ traces: [{}] }),
}));
vi.mock("@/features/admin-submissions/accuse-reception", () => ({
  lireAccuseMessage: () => Promise.resolve(null),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
// Les blocs voisins ont leurs propres tests ; ici seuls les gestes comptent.
vi.mock("@/components/admin/contacts/ReplyComposer", () => ({ ReplyComposer: () => null }));
vi.mock("@/components/admin/contacts/ReplyHistory", () => ({ ReplyHistory: () => null }));
vi.mock("@/components/admin/contacts/BlocInvitationApporteur", () => ({
  BlocInvitationApporteur: () => <p>bloc-invitation</p>,
}));
// Le bloc des echanges reserves lit `calendly_events` : c'est un composant
// serveur asynchrone, et un enfant asynchrone non resolu rend la fiche VIDE —
// pas une erreur, un ecran blanc. Ses deux tests vivent a cote de lui.
vi.mock("@/components/admin/contacts/RendezVousApporteur", () => ({
  RendezVousApporteur: () => null,
}));
vi.mock("@/components/admin/accuse/AccuseReceptionAuto", () => ({ BlocAccuse: () => null }));
vi.mock("../CandidatureCommercialeDetail", () => ({ CandidatureCommercialeDetail: () => null }));
vi.mock("../../[id]/SubmissionUpdateForm", () => ({ SubmissionUpdateForm: () => null }));

import { SubmissionDetailContent } from "../SubmissionDetailContent";

function soumission(details: Record<string, unknown>) {
  return {
    id: "sub-1",
    type: "contact",
    status: "new",
    locale: "fr",
    companyName: "Atelier Martin",
    sector: "industrie",
    employeesCount: "10-49",
    address: null,
    contactName: "Camille Martin",
    contactEmail: "camille@exemple.invalid",
    contactPhone: null,
    contactRole: null,
    internalNotes: null,
    assignedTo: null,
    ipAddress: null,
    userAgent: null,
    submittedAt: new Date("2026-09-19T10:00:00Z"),
    details,
  };
}

async function afficher(): Promise<void> {
  const el = (await SubmissionDetailContent({
    adminPrefix: "p",
    id: "sub-1",
    backHref: "/fr/p/contacts/messages",
  })) as ReactElement;
  render(el);
}

const GESTES_CLIENT = ["Convertir en client", /Créer le devis/, "Identité société"] as const;

beforeEach(() => {
  getSubmissionDetailAction.mockReset();
  findClientByEmail.mockReset();
});
afterEach(cleanup);

describe("fiche d'un message — gestes clients", () => {
  it("un apporteur : ni « Convertir en client », ni « Créer le devis », ni « Identité société »", async () => {
    getSubmissionDetailAction.mockResolvedValue(
      soumission({ unifiedType: "recrutement", subType: "candidature-commerciale" }),
    );
    // Même quand l'adresse est déjà celle d'un client : le devis ne doit pas
    // apparaître pour autant.
    findClientByEmail.mockResolvedValue({ id: "cli-1", raisonSociale: "Atelier Martin" });

    await afficher();

    for (const geste of GESTES_CLIENT) {
      expect(screen.queryByText(geste), String(geste)).toBeNull();
    }
    // Témoin : la fiche est bien rendue, avec le bloc propre aux apporteurs.
    expect(screen.getByText("bloc-invitation")).toBeTruthy();
  });

  it("une demande client sans fiche existante : « Convertir en client » et « Identité société »", async () => {
    getSubmissionDetailAction.mockResolvedValue(soumission({ unifiedType: "audit" }));
    findClientByEmail.mockResolvedValue(null);

    await afficher();

    expect(screen.getByText("Convertir en client")).toBeTruthy();
    expect(screen.getByText("Identité société")).toBeTruthy();
    expect(screen.queryByText("bloc-invitation")).toBeNull();
  });

  it("une demande client déjà connue : « Créer le devis » et « Identité société »", async () => {
    getSubmissionDetailAction.mockResolvedValue(soumission({ unifiedType: "audit" }));
    findClientByEmail.mockResolvedValue({ id: "cli-1", raisonSociale: "Atelier Martin" });

    await afficher();

    expect(screen.getByText(/Créer le devis/)).toBeTruthy();
    expect(screen.getByText("Identité société")).toBeTruthy();
  });

  it("le bloc de suivi s'appelle « Suivi », plus « Workflow admin »", async () => {
    getSubmissionDetailAction.mockResolvedValue(soumission({ unifiedType: "audit" }));
    findClientByEmail.mockResolvedValue(null);

    await afficher();

    expect(screen.getByRole("heading", { name: "Suivi" })).toBeTruthy();
    expect(screen.queryByText("Workflow admin")).toBeNull();
  });
});
