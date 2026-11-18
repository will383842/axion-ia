/**
 * Page « Nouveau devis » par l'assistant (E17b) : assemblage des étapes.
 * Les étapes et la branche sont simulées : on vérifie ce que la page leur PASSE.
 *
 * Mutations qui font rougir ces tests (essayées à la main) :
 *   - ne pas tenir les contacts créés dans la page (ou ne pas passer `onClientCree`) → « un contact
 *     créé à l'étape 1 » rougit (la branche ne le reçoit pas, donc l'envoi non plus) ;
 *   - inverser `texteDelais` / `phraseGarantie` → « délais et garantie » rougit ;
 *   - passer `creerClient` en mode essai → « mode essai » rougit ;
 *   - retirer `router.push` de `onEnvoye` → « envoi » rougit.
 */
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  branche: vi.fn(),
  un: vi.fn(),
  phases: vi.fn(),
  formules: vi.fn(),
  paiement: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/server/actions/qualiopi/clients", () => ({ createClientAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/devis", () => ({ lireBandeauAttributionAction: vi.fn() }));
vi.mock("../AssistantDevisBranche", () => ({
  AssistantDevisBranche: (p: unknown) => {
    m.branche(p);
    return null;
  },
}));
vi.mock("../etapes/un/EtapeClientProjet", () => ({
  EtapeClientProjet: (p: unknown) => (m.un(p), (<i data-testid="e1" />)),
}));
vi.mock("../etapes/phases/EtapePhases", () => ({
  EtapePhases: (p: unknown) => (m.phases(p), (<i data-testid="e1b" />)),
}));
vi.mock("../etapes/formules/EtapeFormules", () => ({
  EtapeFormules: (p: unknown) => (m.formules(p), (<i data-testid="e2" />)),
}));
vi.mock("../etapes/paiement/EtapePaiement", () => ({
  EtapePaiement: (p: unknown) => (m.paiement(p), (<i data-testid="e3" />)),
}));

import { payloadVide } from "@/server/qualiopi/devis/assistant/payload";
import { AssistantDevisPage, SALUTATION_SUIT_LA_FICHE } from "../AssistantDevisPage";

type PropsBranche = {
  clients: { id: string; email: string | null; raisonSociale: string }[];
  salutations: Record<string, string>;
  rendreEtape: (c: { etape: unknown; etat: unknown; dispatch: unknown }) => ReactNode;
  onEnvoye: (r: { devisId: string }) => void;
};
const derniere = () => m.branche.mock.calls.at(-1)![0] as PropsBranche;

const base = {
  payloadInitial: payloadVide(20),
  brouillon: null,
  clients: [
    {
      id: "c1",
      numero: "CLI-1",
      raisonSociale: "Existant",
      type: "entreprise" as const,
      adresse: null,
      contactNom: null,
      email: "a@x.test",
      salutation: "Bonjour Léa,",
    },
  ],
  offres: [],
  textesParDefaut: [],
  bibliotheque: {
    avantages: { A: [], B: [] },
    aSavoir: { A: [], B: [] },
    delais: "TEXTE-DELAIS",
    garantie: "TEXTE-GARANTIE",
    plafond: "TEXTE-PLAFOND",
  },
  tauxStandard: 20,
  formulesActives: true,
  validiteParDefaut: "2026-12-18",
  versionCgv: "2026-11",
  aujourdhui: "2026-11-18",
  urlAssistant: "/fr/adm/qualiopi/devis/new",
  baseDevis: "/fr/adm/qualiopi/devis",
};
const ctx = (etape: unknown) => ({ etape, etat: { e: 1 }, dispatch: vi.fn() });

beforeEach(() => vi.clearAllMocks());

describe("AssistantDevisPage", () => {
  it("monte les étapes 1, 1b, 2 et 3 (et rien d'autre)", () => {
    render(<AssistantDevisPage {...base} />);
    const { rendreEtape } = derniere();
    const r = (e: unknown) => render(<>{rendreEtape(ctx(e))}</>).queryByTestId;
    expect(r(1)("e1")).toBeTruthy();
    expect(r("1b")("e1b")).toBeTruthy();
    expect(r(2)("e2")).toBeTruthy();
    expect(r(3)("e3")).toBeTruthy();
    expect(rendreEtape(ctx(4))).toBeNull();
  });

  it("délais et garantie ne sont pas inversés ; plafond à l'étape 2", () => {
    render(<AssistantDevisPage {...base} />);
    const { rendreEtape } = derniere();
    render(<>{rendreEtape(ctx("1b"))}</>);
    expect(m.phases.mock.calls[0]![0]).toMatchObject({
      texteDelais: "TEXTE-DELAIS",
      phraseGarantie: "TEXTE-GARANTIE",
    });
    render(<>{rendreEtape(ctx(2))}</>);
    expect(m.formules.mock.calls[0]![0]).toMatchObject({ textePlafond: "TEXTE-PLAFOND" });
  });

  it("envoi : onEnvoye ouvre la fiche du devis", () => {
    render(<AssistantDevisPage {...base} />);
    derniere().onEnvoye({ devisId: "d-42" });
    expect(m.push).toHaveBeenCalledWith("/fr/adm/qualiopi/devis/d-42");
  });

  it("mode essai : aucune création de fiche (creerClient absent) ; actif : fournie", () => {
    render(<AssistantDevisPage {...base} modeEssai />);
    render(<>{derniere().rendreEtape(ctx(1))}</>);
    expect(m.un.mock.calls.at(-1)![0].creerClient).toBeUndefined();
    render(<AssistantDevisPage {...base} />);
    render(<>{derniere().rendreEtape(ctx(1))}</>);
    expect(typeof m.un.mock.calls.at(-1)![0].creerClient).toBe("function");
  });

  it("un contact créé à l'étape 1 est vu par la branche (destinataire, nom, salutation)", () => {
    render(<AssistantDevisPage {...base} />);
    render(<>{derniere().rendreEtape(ctx(1))}</>);
    const creer = m.un.mock.calls.at(-1)![0].onClientCree as (c: unknown) => void;
    act(() =>
      creer({
        id: "neuf",
        numero: "CLI-9",
        raisonSociale: "Nouvelle SARL",
        type: "entreprise",
        adresse: null,
        contactNom: "Jo",
        email: "jo@nouvelle.test",
      }),
    );
    const b = derniere();
    const neuf = b.clients.find((c) => c.id === "neuf");
    expect(neuf).toMatchObject({ email: "jo@nouvelle.test", raisonSociale: "Nouvelle SARL" });
    expect(b.salutations["neuf"]).toBe(SALUTATION_SUIT_LA_FICHE);
    expect(b.salutations["c1"]).toBe("Bonjour Léa,");
    // Après sortie de l'étape 1, la liste tient toujours.
    expect(b.clients.map((c) => c.id)).toEqual(["c1", "neuf"]);
    // L'étape 1 reçoit la liste fusionnée, sans doublon possible.
    render(<>{b.rendreEtape(ctx(1))}</>);
    expect(m.un.mock.calls.at(-1)![0].clients.map((c: { id: string }) => c.id)).toEqual([
      "c1",
      "neuf",
    ]);
  });
});
