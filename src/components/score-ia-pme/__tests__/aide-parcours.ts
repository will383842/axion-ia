// Aide de test partagée : monte le parcours et le déroule jusqu'au résultat.
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Titre (h2) de la question affichée. */
export function titreQuestion(): HTMLElement {
  return screen.getByRole("heading", { level: 2 });
}

/** Choisit la première option de l'écran courant (radio ou case) puis clique « Suivant ». */
export async function repondreEtSuivre(user: UserEvent): Promise<void> {
  const groupe = screen.getByRole("group");
  const premiere = groupe.querySelector<HTMLElement>(
    'input[type="radio"], input[type="checkbox"]',
  ) as HTMLElement;
  await user.click(premiere);
  await user.click(screen.getByRole("button", { name: /Suivant|Voir mon score/ }));
}

export async function parcourirJusquAuResultat(user: UserEvent, nb: number): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Commencer" }));
  for (let i = 0; i < nb; i += 1) await repondreEtSuivre(user);
}
