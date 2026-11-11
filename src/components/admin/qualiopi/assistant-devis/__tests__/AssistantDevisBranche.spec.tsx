import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const A = vi.hoisted(() => ({
  creer: vi.fn(),
  sauver: vi.fn(),
  reprendre: vi.fn(),
  numeroter: vi.fn(),
  envoyer: vi.fn(),
  apercu: vi.fn(),
  sources: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/devis-assistant-brouillon", () => ({
  creerBrouillonAssistantAction: A.creer,
  sauverBrouillonAssistantAction: A.sauver,
  reprendreBrouillonAssistantAction: A.reprendre,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-finaliser", () => ({
  numeroterDevisAssistantAction: A.numeroter,
  envoyerDepuisAssistantAction: A.envoyer,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-apercu", () => ({
  apercuAssistantAction: A.apercu,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-sources", () => ({
  listerSourcesPourQuiAction: A.sources,
}));

import { calculerApercu } from "@/server/qualiopi/devis/assistant/apercu";
import { lirePayload } from "@/server/qualiopi/devis/assistant/payload";

import { AssistantDevisBranche } from "../AssistantDevisBranche";
import type { ClientOption } from "../etapes/un/BlocClient";
import { etatT1 } from "../fixtures";
import type { Etape, EtatAssistant } from "../types";
import { etatVersPayload } from "../vers-payload";

const BROUILLON = "11111111-1111-4111-8111-111111111111";
const CLIENT: ClientOption = {
  id: "client-test",
  numero: "CLI-1",
  raisonSociale: "Client Test SAS",
  type: "entreprise",
  adresse: null,
  contactNom: null,
  email: "client@example.test",
};
const CTX = { tvaStandardPct: 20, textes: [] };

function monter(
  o: {
    etat?: EtatAssistant;
    etape?: Etape;
    brouillon?: { id: string; revision: number } | null;
    clients?: ClientOption[];
    devisId?: string;
    onEnvoye?: (r: { devisId: string }) => void;
  } = {},
) {
  const etat = o.etat ?? etatT1();
  const payload = etatVersPayload(etat, o.etape ?? 1, CTX);
  return render(
    <AssistantDevisBranche
      payloadInitial={payload}
      brouillon={o.brouillon === undefined ? { id: BROUILLON, revision: 5 } : o.brouillon}
      clients={o.clients ?? [CLIENT]}
      textesParDefaut={[]}
      tauxStandard={20}
      formulesActives
      validiteParDefaut="2026-12-08"
      versionCgv="version lue en configuration"
      urlAssistant="/fr/adm/qualiopi/devis/new"
      devisId={o.devisId}
      onEnvoye={o.onEnvoye}
      rendreEtape={({ etape, etat: e, dispatch }) => (
        <div>
          <p data-testid="corps">
            étape {String(etape)} · type {String(e.clientType)}
          </p>
          <button type="button" onClick={() => dispatch({ type: "remplacer", etat })}>
            Saisir le devis
          </button>
        </div>
      )}
    />,
  );
}

const NUM = {
  devisId: "22222222-2222-4222-8222-222222222222",
  numero: "AXI-DEV-2026-0001",
  devisMajLe: "2026-11-08T10:00:00.000Z",
  revision: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  A.sources.mockResolvedValue({ data: [] });
  A.sauver.mockImplementation(async (i: { attenduRevision: number }) => ({
    data: { revision: i.attenduRevision + 1 },
  }));
  A.creer.mockResolvedValue({ data: { id: BROUILLON, revision: 0 } });
  // Par défaut le serveur n'a pas bougé depuis la numérotation (révision 8).
  A.reprendre.mockResolvedValue({ data: { revision: NUM.revision } });
  A.numeroter.mockResolvedValue({ data: NUM });
  A.apercu.mockImplementation(async (p: never) => ({
    data: calculerApercu(p, {
      regime: "assujetti",
      tauxStandard: 20,
      formulesActives: true,
      typeClient: "entreprise",
      maintenant: new Date("2026-11-08T10:00:00Z"),
    }),
  }));
  A.envoyer.mockResolvedValue({
    data: { devisId: NUM.devisId, emailEnvoye: true, signatureCreee: true },
  });
});

const continuer = () => fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

describe("sauvegarde : la révision du serveur suit chaque sauvegarde (jeton opaque)", () => {
  it("chaque envoi porte la révision rendue par le précédent, avec un sauvegardeId neuf", async () => {
    monter();
    continuer();
    await waitFor(() => expect(A.sauver).toHaveBeenCalledTimes(1));
    await screen.findByText(/étape 1b/);
    continuer();
    await waitFor(() => expect(A.sauver).toHaveBeenCalledTimes(2));
    const [a, b] = A.sauver.mock.calls.map((c) => c[0]);
    expect([a.attenduRevision, b.attenduRevision]).toEqual([5, 6]);
    expect(a.id).toBe(BROUILLON);
    expect(a.sauvegardeId).not.toBe(b.sauvegardeId);
    expect(a.sauvegardeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.etape).toBe(1);
    expect(lirePayload(a.payload).ok).toBe(true);
    expect(A.creer).not.toHaveBeenCalled();
  });

  it("sans brouillon : création (avec le devis rouvert), puis sauvegardes sur la révision créée", async () => {
    A.creer.mockResolvedValue({ data: { id: BROUILLON, revision: 2 } });
    monter({ brouillon: null, devisId: "33333333-3333-4333-8333-333333333333" });
    fireEvent.click(screen.getByRole("button", { name: "Saisir le devis" }));
    continuer();
    await waitFor(() => expect(A.creer).toHaveBeenCalledTimes(1));
    expect(A.creer.mock.calls[0]![0].devisId).toBe("33333333-3333-4333-8333-333333333333");
    expect(A.sauver).not.toHaveBeenCalled();
    await screen.findByText(/étape 1b/);
    continuer();
    await waitFor(() => expect(A.sauver).toHaveBeenCalledTimes(1));
    expect(A.sauver.mock.calls[0]![0].attenduRevision).toBe(2);
    expect(A.sauver.mock.calls[0]![0].id).toBe(BROUILLON);
  });

  it("un conflit s'arrête : message affiché, aucune nouvelle tentative", async () => {
    A.sauver.mockResolvedValue({
      error: "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.",
      conflit: true,
      revisionActuelle: 9,
    });
    monter();
    continuer();
    expect((await screen.findByRole("alert")).textContent).toContain("modifié ailleurs");
    expect(screen.getByTestId("corps").textContent).toContain("étape 1 ");
    continuer();
    await act(async () => void (await Promise.resolve()));
    expect(A.sauver).toHaveBeenCalledTimes(1);
    expect(A.creer).not.toHaveBeenCalled();
  });
});

describe("« Pour qui ? »", () => {
  it("affiche la note de la liste des demandes", async () => {
    A.sources.mockResolvedValue({
      data: [
        { clientId: "client-test", libelle: "Dupont", detail: "Appel", lien: "/x" },
        { clientId: null, libelle: "Inconnu", detail: "", lien: "/y" },
      ],
      note: "Liste incomplète : messages n'ont pas pu être lus.",
    });
    monter();
    expect((await screen.findByRole("note")).textContent).toContain("Liste incomplète");
    expect(screen.getByRole("button", { name: "Choisir ce client" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir la demande" }).getAttribute("href")).toBe("/y");
  });

  it("choisir une demande pose le client et son type", async () => {
    A.sources.mockResolvedValue({
      data: [{ clientId: "client-test", libelle: "Dupont", detail: "", lien: "/x" }],
    });
    const e = etatT1();
    monter({
      etat: { ...e, clientId: "", clientType: null },
      clients: [{ ...CLIENT, type: "particulier" }],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Choisir ce client" }));
    expect((await screen.findByTestId("corps")).textContent).toContain("type particulier");
  });

  it("l'action « client » part dès le montage : le type du client préchoisi est posé", async () => {
    const e = etatT1();
    monter({
      etat: { ...e, clientType: null },
      clients: [{ ...CLIENT, type: "particulier" }],
    });
    await waitFor(() =>
      expect(screen.getByTestId("corps").textContent).toContain("type particulier"),
    );
  });
});

describe("étape 4 : sauver → numéroter → aperçu → envoyer", () => {
  it("enchaîne dans l'ordre avec les bonnes révisions et affiche l'aperçu du serveur", async () => {
    const ordre: string[] = [];
    A.sauver.mockImplementation(async (i: { attenduRevision: number }) => {
      ordre.push("sauver");
      return { data: { revision: i.attenduRevision + 1 } };
    });
    A.numeroter.mockImplementation(async () => {
      ordre.push("numeroter");
      return { data: NUM };
    });
    A.apercu.mockImplementation(async (p: never) => {
      ordre.push("apercu");
      return {
        data: calculerApercu(p, {
          regime: "assujetti",
          tauxStandard: 20,
          formulesActives: true,
          typeClient: "entreprise",
          maintenant: new Date("2026-11-08T10:00:00Z"),
        }),
      };
    });
    monter({ etape: 4 });
    expect(await screen.findByText(/Proposition n° AXI-DEV-2026-0001/)).toBeTruthy();
    expect(ordre).toEqual(["sauver", "numeroter", "apercu"]);
    expect(A.numeroter.mock.calls[0]![0]).toEqual({ brouillonId: BROUILLON, attenduRevision: 6 });
    const payloadApercu = A.apercu.mock.calls[0]![0];
    expect(payloadApercu.sync.devisId).toBe(NUM.devisId);
    expect(document.body.textContent!.replace(/[\s  ]/g, "")).toContain("4483,93");
    expect(A.envoyer).not.toHaveBeenCalled();
  });

  it("l'adresse du client s'affiche en LECTURE SEULE", async () => {
    monter({ etape: 4 });
    const champ = (await screen.findByLabelText("À")) as HTMLInputElement;
    expect(champ.value).toBe("client@example.test");
    expect(champ.readOnly).toBe(true);
  });

  it("« Envoyer au client » envoie avec la révision de la numérotation, UNE fois", async () => {
    const onEnvoye = vi.fn();
    monter({ etape: 4, onEnvoye });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect(await screen.findByText(/en corbeille, à valider/i)).toBeTruthy();
    expect(A.envoyer).toHaveBeenCalledTimes(1);
    expect(A.envoyer.mock.calls[0]![0]).toEqual({ brouillonId: BROUILLON, attenduRevision: 8 });
    expect(onEnvoye).toHaveBeenCalledWith({ devisId: NUM.devisId });
  });

  it("envoi rejoué : l'erreur du serveur est affichée, aucun second appel d'envoi", async () => {
    A.envoyer.mockResolvedValue({
      error: "Envoi déjà demandé : rechargez la page pour voir l'état du devis.",
    });
    monter({ etape: 4 });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Envoi déjà demandé");
    await act(async () => void (await Promise.resolve()));
    expect(A.envoyer).toHaveBeenCalledTimes(1);
  });

  it("devis « à renuméroter » à l'envoi : révision 8+1 adoptée, l'aperçu est REFAIT (sauver → numéroter → aperçu), jamais réenvoyé directement", async () => {
    A.envoyer.mockResolvedValueOnce({
      error:
        "La saisie a été modifiée pendant la numérotation : le devis porte la version précédente. Relancez l'envoi.",
    });
    A.reprendre.mockResolvedValueOnce({ data: { revision: 9 } });
    monter({ etape: 4 });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() => expect(A.numeroter).toHaveBeenCalledTimes(2));
    expect(A.envoyer).toHaveBeenCalledTimes(1);
    expect(A.apercu).toHaveBeenCalledTimes(2);
    expect(A.numeroter.mock.calls[1]![0]).toEqual({ brouillonId: BROUILLON, attenduRevision: 10 });
    expect(await screen.findByText(/L'aperçu a été recalculé/)).toBeTruthy();
  });

  it("après un échec d'envoi, une révision autre que dernier + 1 N'EST PAS adoptée : conflit, plus aucun envoi", async () => {
    A.envoyer.mockResolvedValueOnce({ error: "Envoi refusé." });
    A.reprendre.mockResolvedValueOnce({ data: { revision: 12 } });
    monter({ etape: 4 });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("modifié ailleurs");
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() => expect(screen.getAllByRole("alert")[0]!.textContent).toContain("ailleurs"));
    expect(A.envoyer).toHaveBeenCalledTimes(1);
    expect(A.numeroter).toHaveBeenCalledTimes(1);
  });

  it("l'envoi qui lève une exception rend une erreur affichée (pas d'attente infinie)", async () => {
    A.envoyer.mockRejectedValueOnce(new Error("réseau"));
    monter({ etape: 4 });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Vérifiez l'état du devis");
  });

  it("la préparation qui lève une exception affiche l'erreur et « Réessayer »", async () => {
    A.apercu.mockRejectedValueOnce(new Error("réseau"));
    monter({ etape: 4 });
    expect((await screen.findByRole("alert")).textContent).toContain("Vérifiez l'état du devis");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });

  it("numérotation « à renuméroter » : message affiché, ni aperçu ni envoi", async () => {
    A.numeroter.mockResolvedValue({ data: { ...NUM, aRenumeroter: true } });
    monter({ etape: 4 });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "a changé pendant la numérotation",
    );
    expect(A.apercu).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Envoyer au client/ })).toBeNull();
  });

  it("une erreur de numérotation est affichée telle quelle (aucun aperçu)", async () => {
    A.numeroter.mockResolvedValue({ error: "Numérotation déjà en cours" });
    A.reprendre.mockResolvedValue({ data: { revision: 6 } });
    monter({ etape: 4 });
    expect((await screen.findByRole("alert")).textContent).toContain("Numérotation déjà en cours");
    expect(A.apercu).not.toHaveBeenCalled();
  });

  it("numérotation en erreur de validité (révision avancée) : la révision est relue, le « Réessayer » repart de 7", async () => {
    A.numeroter.mockResolvedValueOnce({
      error: "Le devis est numéroté, mais sa validité a échoué.",
    });
    A.reprendre.mockResolvedValueOnce({ data: { revision: 7 } });
    monter({ etape: 4 });
    await screen.findByRole("alert");
    expect(A.reprendre).toHaveBeenCalledWith(BROUILLON);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await screen.findByText(/Proposition n°/);
    expect(A.numeroter.mock.calls[1]![0]).toEqual({ brouillonId: BROUILLON, attenduRevision: 8 });
  });

  it("e-mail non préparé : le devis est déjà envoyé, onEnvoye est appelé et le message n'est PAS une erreur", async () => {
    A.envoyer.mockResolvedValue({
      data: {
        devisId: NUM.devisId,
        emailEnvoye: false,
        signatureCreee: true,
        note: "Le client n'a pas d'adresse.",
      },
    });
    const onEnvoye = vi.fn();
    monter({ etape: 4, onEnvoye });
    await screen.findByText(/Proposition n°/);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() =>
      expect(document.body.textContent).toContain("Le client n'a pas d'adresse."),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/en corbeille, à valider/i)).toBeNull();
    expect(onEnvoye).toHaveBeenCalledWith({ devisId: NUM.devisId });
  });
});

describe("brouillon fourni mais illisible", () => {
  it("est remplacé AVEC le message, sans envoyer devisId à la création (le lien existe déjà)", async () => {
    const etat = etatT1();
    const payload = etatVersPayload(etat, 1, CTX);
    payload.nonImprime = { ecran: { v: 99 } };
    render(
      <AssistantDevisBranche
        payloadInitial={payload}
        brouillon={{ id: BROUILLON, revision: 5 }}
        clients={[CLIENT]}
        textesParDefaut={[]}
        tauxStandard={20}
        formulesActives
        validiteParDefaut="2026-12-08"
        versionCgv="v"
        urlAssistant="/fr/adm/qualiopi/devis/new"
        devisId="33333333-3333-4333-8333-333333333333"
        rendreEtape={({ dispatch }) => (
          <button type="button" onClick={() => dispatch({ type: "remplacer", etat })}>
            Saisir le devis
          </button>
        )}
      />,
    );
    expect(await screen.findByText(/vos saisies iront dans un nouveau brouillon/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Saisir le devis" }));
    continuer();
    await waitFor(() => expect(A.creer).toHaveBeenCalled());
    expect(A.creer.mock.calls[0]![0]).not.toHaveProperty("devisId");
    expect(A.sauver).not.toHaveBeenCalled();
  });
});
