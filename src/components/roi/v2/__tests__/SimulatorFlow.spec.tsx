// Parcours rendu — les invariants que la logique pure ne peut pas garantir.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Le pré-cochage sectoriel a été livré avec un défaut BLOQUANT : les fonctions
// étaient bien inscrites dans les réponses (`applyStepAnswer`, couvert par
// `steps.spec.ts`, était juste), mais l'écran les affichait décochées et le
// bouton « Continuer » restait DÉSACTIVÉ. Le parcours s'arrêtait là, pour tout
// le monde, sous un texte annonçant « nous avons coché ce qui existe chez
// presque tous les acteurs de votre secteur ».
//
// La logique était bonne, l'AFFICHAGE était rompu. Aucun test de fonction pure
// ne pouvait le voir — seul un rendu le pouvait. D'où ces tests-ci.

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulatorFlow } from "../SimulatorFlow";
import { SECTOR_DEFAULT_FUNCTIONS } from "@/content/roi/model/functions";

// L'action serveur et Turnstile tirent Prisma, Redis et un script tiers : hors
// sujet ici, et impossibles à charger en jsdom.
vi.mock("@/features/roi-report/actions", () => ({
  submitRoiReportAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/components/forms/TurnstileWidget", () => ({
  useTurnstileToken: () => ({ token: null, widget: null, reset: vi.fn() }),
}));
// `next-intl` construit sa navigation à partir de `next/navigation`, que jsdom
// ne sait pas résoudre depuis le paquet. Un simple lien suffit : ce qui est
// testé ici, c'est le parcours, pas le routage localisé.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/fr/simulateur",
}));

function renderFlow() {
  return render(<SimulatorFlow locale="fr" />);
}

/**
 * Traverse les trois écrans de cadrage jusqu'à celui des fonctions — le seul
 * qui demande une validation explicite, et celui où le défaut se logeait.
 */
async function allerAuxFonctions(user: ReturnType<typeof userEvent.setup>, secteur: string) {
  await user.click(screen.getByText(secteur));
  await user.click(await screen.findByText("11 à 20"));
  await user.click(await screen.findByText("Bureautique classique"));
  return screen.findByRole("group", { name: /qui vous prend du temps/i });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/fr/simulateur");
  // jsdom n'implémente pas `scrollIntoView`. Le défilement entre écrans est un
  // comportement de navigateur, pas une règle métier : on le neutralise plutôt
  // que d'ajouter une garde défensive dans le produit pour un cas qui n'existe
  // que dans l'environnement de test.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("pré-cochage sectoriel — chemin d'affichage", () => {
  it("affiche les fonctions du secteur DÉJÀ COCHÉES et « Continuer » actif", async () => {
    const user = userEvent.setup();
    renderFlow();

    const groupe = await allerAuxFonctions(user, "BTP, immobilier");

    const coches = within(groupe)
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked);
    expect(coches.length).toBe(SECTOR_DEFAULT_FUNCTIONS.btp_immobilier.length);

    // 🔴 L'assertion qui aurait attrapé le défaut : le bouton ne doit pas être
    // désactivé alors que des cases sont cochées.
    expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled();
  });

  it("laisse décocher jusqu'à bloquer « Continuer », puis le réactive", async () => {
    const user = userEvent.setup();
    renderFlow();
    const groupe = await allerAuxFonctions(user, "BTP, immobilier");
    const cochees = within(groupe)
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked);

    for (const c of cochees) await user.click(c);
    expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();

    await user.click(cochees[0]!);
    expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled();
  });
});

describe("enchaînement des écrans", () => {
  it("avance seul sur un choix unique, sans appui supplémentaire", async () => {
    const user = userEvent.setup();
    renderFlow();

    expect(screen.getByText("Dans quel secteur travaillez-vous ?")).toBeInTheDocument();
    await user.click(screen.getByText("Juridique"));

    expect(await screen.findByText("Combien êtes-vous dans l'entreprise ?")).toBeInTheDocument();
  });

  it("permet de revenir en arrière sans perdre la réponse déjà donnée", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByText("Juridique"));
    await screen.findByText("Combien êtes-vous dans l'entreprise ?");
    await user.click(screen.getByRole("button", { name: /Revenir à la question précédente/i }));

    const secteur = await screen.findByText("Dans quel secteur travaillez-vous ?");
    expect(secteur).toBeInTheDocument();
    // La radio du secteur choisi doit être retrouvée cochée.
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["juridique"]);
  });
});

describe("habillage", () => {
  it("porte le thème clair par défaut et le thème sombre à la demande", () => {
    // Le basculement passe par `data-tone` sur `.sim-scope` : c'est ce qui
    // permet au MÊME composant de servir `/roi` en ivoire et `/simulateur` en
    // encre, sans duplication.
    const { container, rerender } = render(<SimulatorFlow locale="fr" />);
    expect(container.querySelector(".sim-scope")?.getAttribute("data-tone")).toBe("light");

    rerender(<SimulatorFlow locale="fr" tone="dark" />);
    expect(container.querySelector(".sim-scope")?.getAttribute("data-tone")).toBe("dark");
  });
});
