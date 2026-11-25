// La page d'aide de l'espace de l'apporteur : même contrôle du lien que les pages sœurs, un
// formulaire utilisable au clavier, des erreurs annoncées sans perdre la saisie, et le lien
// « Besoin d'aide ? » sur les pages personnelles de la coquille.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  params: vi.fn(),
  envoyer: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => h.params() }));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/demande-aide", () => ({
  envoyerDemandeAide: (...a: unknown[]) => h.envoyer(...a),
}));

import { TEXTES_AIDE as T } from "@/features/apporteurs-reseau/demande-aide-textes";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { Coquille } from "../Coquille";
import { TEXTES } from "../textes";

import { FormulaireAide } from "./FormulaireAide";
import AideApporteurPage from "./page";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const LIEN_AIDE = `/apporteur/dossier/${ID}/${JETON}/aide`;

const page = async (id = ID, jeton = JETON) =>
  renderToStaticMarkup(await AideApporteurPage({ params: Promise.resolve({ id, jeton }) }));

beforeEach(() => {
  vi.clearAllMocks();
  h.params.mockReturnValue({ id: ID, jeton: JETON });
  h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "signe", prenom: "Claire" });
});
afterEach(cleanup);

describe("la page d'aide", () => {
  it("lien valide : le formulaire, sans champ bancaire ni dépôt de pièce", async () => {
    const html = await page();
    expect(h.lireDossierParLien).toHaveBeenCalledWith(ID, JETON);
    expect(html).toContain('name="sujet"');
    expect(html).toContain('name="message"');
    expect(html).toContain("N&#x27;indiquez jamais de coordonnées bancaires dans ce message.");
    expect(html).not.toMatch(/type="file"|name="iban"/i);
    // La page d'aide ne renvoie pas vers elle-même, mais ramène à l'espace.
    expect(html).not.toContain(LIEN_AIDE);
    expect(html).toContain(`href="/apporteur/dossier/${ID}/${JETON}"`);
  });

  it.each([
    ["lien invalide", null],
    ["dossier refusé", { id: ID, statut: "refuse" }],
    ["contrat résilié", { id: ID, statut: "resilie" }],
  ])("%s : la page neutre, aucun formulaire", async (_cas, dossier) => {
    h.lireDossierParLien.mockResolvedValue(dossier);
    const html = await page();
    expect(html).toContain(TEXTES.invalideTitre);
    expect(html).not.toContain("<form");
  });

  it("lien d'exemple de l'aperçu : la page neutre, sans lecture en base", async () => {
    expect(await page(ID_DOSSIER_EXEMPLE)).not.toContain("<form");
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });

  it("les textes ne portent aucun mot interdit ni délai promis", () => {
    const tout = Object.values(T).join(" ");
    expect(tout).not.toMatch(/Grenoble|Aucun gain garanti|conférence/i);
    expect(tout).not.toMatch(/\d+\s*(jours?|heures?|h)\b/);
  });
});

describe("le formulaire", () => {
  const saisir = (container: HTMLElement, sujet: string, message: string) => {
    fireEvent.change(screen.getByLabelText(T.sujet), { target: { value: sujet } });
    fireEvent.change(screen.getByLabelText(T.message), { target: { value: message } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
  };

  it("chaque champ a son libellé ; la consigne bancaire est rattachée au message", () => {
    render(<FormulaireAide envoyerAction={h.envoyer} />);
    expect((screen.getByLabelText(T.sujet) as HTMLSelectElement).tagName).toBe("SELECT");
    const message = screen.getByLabelText(T.message) as HTMLTextAreaElement;
    expect(message.minLength).toBe(10);
    expect(message.maxLength).toBe(2000);
    const aide = document.getElementById(message.getAttribute("aria-describedby") ?? "");
    expect(aide?.textContent).toContain(T.jamaisBancaire);
    expect(
      Array.from((screen.getByLabelText(T.sujet) as HTMLSelectElement).options).map(
        (o) => o.textContent,
      ),
    ).toEqual([
      T.choisir,
      "Mon dossier",
      "Mon contrat",
      "Une entreprise présentée",
      "Mes commissions",
      "Autre",
    ]);
  });

  it("refus : l'erreur est annoncée et rattachée au champ, la saisie reste à l'écran", async () => {
    h.envoyer.mockResolvedValue({
      ok: false,
      champ: "message",
      message: T.messageCourt,
      saisie: { sujet: "contrat", message: "court" },
    });
    const { container } = render(<FormulaireAide envoyerAction={h.envoyer} />);
    saisir(container, "contrat", "court");
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe(T.messageCourt);
    const message = screen.getByLabelText(T.message) as HTMLTextAreaElement;
    expect(message.getAttribute("aria-invalid")).toBe("true");
    expect(message.getAttribute("aria-describedby")).toContain(alerte.id);
    await waitFor(() => expect(message.value).toBe("court"));
    expect((screen.getByLabelText(T.sujet) as HTMLSelectElement).value).toBe("contrat");
  });

  it("envoi réussi : la confirmation remplace le formulaire", async () => {
    h.envoyer.mockResolvedValue({ ok: true });
    const { container } = render(<FormulaireAide envoyerAction={h.envoyer} />);
    saisir(container, "autre", "Bonjour, une question sur mon espace.");
    const statut = await screen.findByRole("status");
    expect(statut.textContent).toBe(
      "Votre message est bien parti. Nous vous répondons par e-mail.",
    );
    expect(container.querySelector("form")).toBeNull();
    const fd = h.envoyer.mock.calls[0]![1] as FormData;
    expect(fd.get("sujet")).toBe("autre");
  });
});

describe("le lien « Besoin d'aide ? » de la coquille", () => {
  const coquille = (props: { titre?: string; sansAide?: boolean }) =>
    renderToStaticMarkup(
      <Coquille {...props}>
        <p>contenu</p>
      </Coquille>,
    );

  it("page personnelle (avec un titre) : le lien vers la page d'aide de CET espace", () => {
    const html = coquille({ titre: "Bonjour Claire" });
    expect(html).toContain(`href="${LIEN_AIDE}"`);
    expect(html).toContain("Besoin d&#x27;aide ?");
  });

  it("écran neutre (sans titre) ou page d'aide elle-même : pas de lien", () => {
    expect(coquille({})).not.toContain("/aide");
    expect(coquille({ titre: "Besoin d'aide ?", sansAide: true })).not.toContain("/aide");
  });

  it("hors d'un espace (« Retrouver mon espace ») : pas de lien", () => {
    h.params.mockReturnValue({});
    expect(coquille({ titre: "Retrouver mon espace" })).not.toContain("/aide");
    h.params.mockReturnValue(null);
    expect(coquille({ titre: "Retrouver mon espace" })).not.toContain("/aide");
  });
});
