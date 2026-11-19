/**
 * Tant que la certification Qualiopi n'est pas obtenue, l'écran des documents
 * ne propose pas l'option de condition suspensive liée au financement (le
 * serveur la refuse déjà) et n'affiche aucune mention de financement/OPCO dans
 * ce bloc. Avec `certificationObtenue`, le bloc est présent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
const { action } = vi.hoisted(() => ({
  action: () => vi.fn(async () => ({ error: "non appelée" })),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({
  genererConventionAction: action(),
  genererProgrammeAction: action(),
  genererOrganisationActionAction: action(),
  genererConventionTripartiteAction: action(),
  genererContratFormationAction: action(),
  genererEmargementAction: action(),
  genererReglementInterieurAction: action(),
  genererLivretAccueilAction: action(),
  genererPositionnementAction: action(),
  genererSatisfactionAction: action(),
  genererKitOpcoAction: action(),
  genererLettreMissionAction: action(),
  genererLettreMissionCadreAction: action(),
  listerSessionsLettreCadreAction: action(),
  genererConvocationAction: action(),
  genererGrilleEvaluationAction: action(),
  genererCertificatRealisationAction: action(),
  genererKitCpfAction: action(),
  genererKitFranceTravailAction: action(),
  genererAutorisationCaptationAction: action(),
  annulerDocumentAction: action(),
  relancerRemiseExemplaireAction: action(),
}));
vi.mock("@/server/actions/qualiopi/evaluations", () => ({
  genererAttestationAction: action(),
}));
vi.mock("@/server/actions/qualiopi/exports-pdf", () => ({
  genererFicheAdaptationAction: action(),
}));
vi.mock("@/server/actions/qualiopi/financements", () => ({
  setFinancementSessionAction: action(),
  validerAccordOpcoAction: action(),
  genererFactureFormationAction: action(),
  genererFacturePdfAction: action(),
}));
vi.mock("@/server/actions/qualiopi/audit-missions", () => ({ setAcompteAction: action() }));
vi.mock("@/server/actions/qualiopi/notes-pieces", () => ({ ajouterNotePieceAction: action() }));
vi.mock("@/server/actions/qualiopi/mission-formateur", () => ({
  consignerAccordHorsOutilAction: action(),
  renvoyerPropositionMissionAction: action(),
  declarerAbsenceFormateurAction: action(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DocumentsSection, type DocumentsSectionProps } from "../DocumentsSection";

afterEach(cleanup);

const BASE: DocumentsSectionProps = {
  sessionId: "s1",
  enrollments: [{ id: "e1", traineeId: "t1", nomStagiaire: "Ada Lovelace" }],
  documentsExistants: [],
  contexte: { financement: "direct", typeClient: "entreprise", statut: "planifiee" },
} as DocumentsSectionProps;

const MOTIF = /opco|financ|prise en charge|condition suspensive/i;

describe("DocumentsSection — condition suspensive masquée avant la certification", () => {
  it("sans la prop : aucune case de condition suspensive", () => {
    const { container } = render(<DocumentsSection {...BASE} />);
    expect(container.querySelector('input[id^="condition-opco-"]')).toBeNull();
    expect(container.textContent ?? "").not.toMatch(
      /condition suspensive|accord de prise en charge/i,
    );
  });

  it("certificationObtenue=false : même résultat", () => {
    const { container } = render(<DocumentsSection {...BASE} certificationObtenue={false} />);
    expect(container.querySelector('input[id^="condition-opco-"]')).toBeNull();
  });

  it("certificationObtenue=true : le bloc est présent", () => {
    const { container } = render(<DocumentsSection {...BASE} certificationObtenue={true} />);
    expect(container.querySelector('input[id^="condition-opco-"]')).not.toBeNull();
    expect(container.textContent ?? "").toMatch(MOTIF);
  });
});
