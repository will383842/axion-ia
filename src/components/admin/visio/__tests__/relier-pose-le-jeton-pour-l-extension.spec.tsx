/**
 * « Relier » (page Enregistreur ouverte par l'extension 1.4.0) : l'action crée
 * le jeton ; le composant le pose dans un élément MASQUÉ portant
 * `data-relier-nonce` et `data-relier-jeton`, que le relais de l'extension
 * lit. Le jeton n'est jamais affiché en clair. Quand le relais marque
 * l'élément `data-relier-etat="ok"`, la page dit « Relié ✓ — vous pouvez
 * fermer cet onglet » ; `refuse`, elle dit quoi faire.
 */

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { RelierPosteForm } from "../RelierPosteForm";
import type { EtatLiaison } from "@/features/admin-enregistreur/etat-jeton";

const NONCE = "0123456789abcdef0123456789abcdef";
const JETON = "ab".repeat(32);

async function relier(etatRendu: EtatLiaison) {
  const action = vi.fn(async (_e: EtatLiaison, f: FormData): Promise<EtatLiaison> => {
    expect(f.get("nonce")).toBe(NONCE);
    return etatRendu;
  });
  const vue = render(<RelierPosteForm action={action} nonce={NONCE} />);
  expect(screen.getByLabelText(/nom du poste/i)).toHaveValue("Poste de Williams");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Relier" }));
  });
  return { vue, action };
}

describe("« Relier » pose le jeton pour l'extension", () => {
  it("élément masqué porteur du nonce et du jeton ; jamais affiché en clair", async () => {
    const { vue } = await relier({ etat: "relie", nonce: NONCE, jeton: JETON });
    const el = vue.container.querySelector("[data-relier-nonce]");
    expect(el?.getAttribute("data-relier-nonce")).toBe(NONCE);
    expect(el?.getAttribute("data-relier-jeton")).toBe(JETON);
    expect(el?.hasAttribute("hidden")).toBe(true);
    expect(vue.container.textContent).not.toContain(JETON);
    expect(screen.queryByDisplayValue(JETON)).toBeNull();
  });

  it("l'extension confirme : « Relié ✓ — vous pouvez fermer cet onglet »", async () => {
    const { vue } = await relier({ etat: "relie", nonce: NONCE, jeton: JETON });
    const el = vue.container.querySelector("[data-relier-nonce]") as HTMLElement;
    await act(async () => {
      el.setAttribute("data-relier-etat", "ok");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByText("Relié ✓ — vous pouvez fermer cet onglet")).toBeInTheDocument();
  });

  it("l'extension refuse : la page dit de relancer depuis l'extension", async () => {
    const { vue } = await relier({ etat: "relie", nonce: NONCE, jeton: JETON });
    const el = vue.container.querySelector("[data-relier-nonce]") as HTMLElement;
    await act(async () => {
      el.setAttribute("data-relier-etat", "refuse");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByText(/relancez « Relier à ma console »/)).toBeInTheDocument();
  });

  it("erreur de l'action : message, pas d'élément porteur", async () => {
    const { vue } = await relier({ etat: "erreur", message: "Lien de liaison invalide." });
    expect(screen.getByRole("alert")).toHaveTextContent("Lien de liaison invalide.");
    expect(vue.container.querySelector("[data-relier-jeton]")).toBeNull();
  });
});
