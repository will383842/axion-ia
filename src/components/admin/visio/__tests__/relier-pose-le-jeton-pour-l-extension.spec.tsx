/**
 * « Relier » (page Enregistreur ouverte par l'extension 1.4.0) : l'action crée
 * le jeton ; le composant le pose dans un élément MASQUÉ portant
 * `data-relier-nonce` et `data-relier-jeton`, que le relais de l'extension
 * lit. Le jeton n'est jamais affiché en clair.
 *
 * Relecture sécurité du 02/10 :
 *   · dès la réponse (ok, refuse) ou le délai écoulé, le jeton QUITTE le DOM
 *     (et l'état React : l'élément porteur n'est plus rendu) ;
 *   · refus ou silence : l'appareil créé est RÉVOQUÉ (`annuler`, identifiant
 *     rendu par l'action) — pas d'appareil orphelin dont personne n'a le
 *     jeton — et la page le dit.
 *
 * Mutation qui rougit : ne plus appeler `annuler` sur « refuse » → 3e cas.
 */

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { RelierPosteForm } from "../RelierPosteForm";
import type { EtatLiaison } from "@/features/admin-enregistreur/etat-jeton";

const NONCE = "0123456789abcdef0123456789abcdef";
const JETON = "ab".repeat(32);
const APPAREIL = "app-relie-1";
const RELIE: EtatLiaison = { etat: "relie", nonce: NONCE, jeton: JETON, appareilId: APPAREIL };
const NON_ABOUTIE = "Liaison non aboutie, rien n'a été gardé. Relancez depuis l'extension.";

async function relier(etatRendu: EtatLiaison, sansReponseMs = 60_000) {
  const action = vi.fn(async (_e: EtatLiaison, f: FormData): Promise<EtatLiaison> => {
    expect(f.get("nonce")).toBe(NONCE);
    return etatRendu;
  });
  const annuler = vi.fn(async (_id: string) => true);
  const vue = render(
    <RelierPosteForm
      action={action}
      annuler={annuler}
      nonce={NONCE}
      sansReponseMs={sansReponseMs}
    />,
  );
  expect(screen.getByLabelText(/nom du poste/i)).toHaveValue("Poste de Williams");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Relier" }));
  });
  return { vue, action, annuler };
}

async function marquer(vue: ReturnType<typeof render>, valeur: string) {
  const el = vue.container.querySelector("[data-relier-nonce]") as HTMLElement;
  await act(async () => {
    el.setAttribute("data-relier-etat", valeur);
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("« Relier » pose le jeton pour l'extension", () => {
  it("élément masqué porteur du nonce et du jeton ; jamais affiché en clair", async () => {
    const { vue } = await relier(RELIE);
    const el = vue.container.querySelector("[data-relier-nonce]");
    expect(el?.getAttribute("data-relier-nonce")).toBe(NONCE);
    expect(el?.getAttribute("data-relier-jeton")).toBe(JETON);
    expect(el?.hasAttribute("hidden")).toBe(true);
    expect(vue.container.textContent).not.toContain(JETON);
    expect(screen.queryByDisplayValue(JETON)).toBeNull();
  });

  it("l'extension confirme : « Relié ✓ », le jeton quitte le DOM, rien n'est révoqué", async () => {
    const { vue, annuler } = await relier(RELIE);
    await marquer(vue, "ok");
    expect(await screen.findByText("Relié ✓ — vous pouvez fermer cet onglet")).toBeInTheDocument();
    expect(vue.container.querySelector("[data-relier-jeton]")).toBeNull();
    expect(vue.container.innerHTML).not.toContain(JETON);
    expect(annuler).not.toHaveBeenCalled();
  });

  it("l'extension refuse : l'appareil est révoqué, le jeton quitte le DOM, la page le dit", async () => {
    const { vue, annuler } = await relier(RELIE);
    await marquer(vue, "refuse");
    expect(await screen.findByText(NON_ABOUTIE)).toBeInTheDocument();
    expect(annuler).toHaveBeenCalledWith(APPAREIL);
    expect(vue.container.innerHTML).not.toContain(JETON);
  });

  it("l'extension ne répond pas dans le délai : même révocation", async () => {
    const { vue, annuler } = await relier(RELIE, 20);
    expect(await screen.findByText(NON_ABOUTIE)).toBeInTheDocument();
    expect(annuler).toHaveBeenCalledWith(APPAREIL);
    expect(vue.container.innerHTML).not.toContain(JETON);
  });

  it("erreur de l'action : message, pas d'élément porteur", async () => {
    const { vue } = await relier({ etat: "erreur", message: "Lien de liaison invalide." });
    expect(screen.getByRole("alert")).toHaveTextContent("Lien de liaison invalide.");
    expect(vue.container.querySelector("[data-relier-jeton]")).toBeNull();
  });
});
