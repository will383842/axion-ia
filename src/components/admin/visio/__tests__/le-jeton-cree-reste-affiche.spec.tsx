/**
 * Le jeton créé RESTE AFFICHÉ (constaté par Williams en production, 02/10 :
 * « lorsque je crée le jeton, il n'apparaît pas à l'écran »).
 *
 * Cause : l'action revalidait la page ; le formulaire de création, rendu
 * seulement sans jeton actif, était démonté au re-rendu, et le jeton en clair
 * (l'état de `useActionState`) perdu sans avoir été montré. Gardes :
 *
 *   · composant : après « Créer », le jeton s'affiche, avec « Copier » et le
 *     lien « J'ai collé le jeton : actualiser la liste » ; un re-rendu de la
 *     page (mêmes props) ne le fait pas disparaître ;
 *   · actions : `creerJetonAction` et `renouvelerJetonAction` ne revalident
 *     plus la page (lecture de source — une action `"use server"` ne se
 *     charge pas sans la pile Next) ; `revoquerJetonAction`, si.
 *
 * Mutation qui rougit : remettre `revalidatePath` dans `creerJetonAction`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { JetonAppareilForm } from "../JetonAppareilForm";
import { etatJetonCree, type EtatJeton } from "@/features/admin-enregistreur/etat-jeton";

const JETON = "ab".repeat(32);
const ACTUALISER = "/fr/p/rendez-vous/enregistreur";

describe("le jeton créé reste affiché", () => {
  it("après « Créer », le jeton, « Copier » et le lien d'actualisation ; un re-rendu ne l'efface pas", async () => {
    const action = vi.fn(async (_e: EtatJeton, _f: FormData): Promise<EtatJeton> =>
      etatJetonCree(JETON),
    );
    const props = {
      action,
      libelle: "Créer un jeton",
      avecNom: true,
      actualiserHref: ACTUALISER,
    } as const;
    const { rerender } = render(<JetonAppareilForm {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer un jeton" }));
    });

    expect(await screen.findByDisplayValue(JETON)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copier/i })).toBeInTheDocument();
    const lien = screen.getByRole("link", { name: /actualiser la liste/i });
    expect(lien.getAttribute("href")).toBe(ACTUALISER);
    expect(screen.getByText(/jusqu'à sa révocation/)).toBeInTheDocument();

    // La page se re-rend (nouvelle lecture des appareils) : le jeton reste.
    rerender(<JetonAppareilForm {...props} />);
    expect(screen.getByDisplayValue(JETON)).toBeInTheDocument();
  });

  it("« Copier » écrit le jeton dans le presse-papiers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <JetonAppareilForm
        action={async () => etatJetonCree(JETON)}
        libelle="Créer un jeton"
        actualiserHref={ACTUALISER}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer un jeton" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /copier/i }));
    });
    expect(writeText).toHaveBeenCalledWith(JETON);
  });

  it("créer et renouveler ne revalident plus la page ; révoquer, si", () => {
    const src = readFileSync(
      join(process.cwd(), "src/features/admin-enregistreur/actions.ts"),
      "utf8",
    );
    const corps = (nom: string): string => {
      const debut = src.indexOf(`export async function ${nom}`);
      const suite = src.indexOf("export async function", debut + 1);
      return src.slice(debut, suite === -1 ? undefined : suite);
    };
    expect(corps("creerJetonAction")).not.toContain("revalidatePath(");
    expect(corps("renouvelerJetonAction")).not.toContain("revalidatePath(");
    expect(corps("revoquerJetonAction")).toContain("revalidatePath(");
  });
});
