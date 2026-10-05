/**
 * ⛔ LE DEVIS S'OUVRE VIDE ET L'AIDE EST À CÔTÉ (PR 7, décision de Will du 29/09).
 *
 * Ouvert depuis un projet, le formulaire de devis ne reçoit QUE l'identifiant
 * du projet (pour le lien `projet_devis`) : aucune ligne, aucune quantité,
 * aucun financement, aucune activité n'est pré-remplie. Et la page place le
 * panneau « Ce que le client a dit » À CÔTÉ du formulaire, jamais dedans.
 *
 *   1. rendu : `DevisForm` avec un `projetId` s'ouvre exactement comme sans ;
 *   2. envoi : l'action reçoit `projetId` et ce que Will a saisi, rien d'autre ;
 *   3. page : `devis/new` et `vente/new` passent à `DevisForm`/`VenteWizard`
 *      le seul `projetId` (jamais l'aide), et rendent `CeQueLeClientADit` à part.
 *
 * Mutation qui rougit : passer une valeur de l'aide en prop du formulaire
 * (`defaultLignes={…}`), ou pré-remplir `nbParticipants` depuis le projet.
 * Contre-témoin : le même formulaire sans projet n'envoie pas de `projetId`.
 * Angle mort : le rendu serveur réel de la page n'est pas monté ici (garde
 * statique sur son source) — la chaîne de Gate D ouvre un devis de projet.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const createDevisActionMock = vi.fn();
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: (...args: unknown[]) => createDevisActionMock(...args),
  // INT-T07-A : le bandeau d'attribution d'Axion Partners, sans attribution ici.
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { DevisForm } from "@/components/admin/qualiopi/DevisForm";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJET_ID = "22222222-2222-4222-8222-222222222222";
const CLIENTS = [{ id: CLIENT_ID, numero: "AXI-CLI-001", raisonSociale: "Client fictif" }];

function monter(projetId?: string) {
  return render(
    <DevisForm
      clients={CLIENTS}
      offres={[]}
      activites={[{ value: "formation", label: "Formation" }]}
      basePath="/fr/adm/qualiopi/devis"
      defaultClientId={CLIENT_ID}
      {...(projetId ? { projetId } : {})}
    />,
  );
}

function valeurs(container: HTMLElement): string[] {
  return [...container.querySelectorAll("input, select, textarea")].map(
    (e) => (e as HTMLInputElement).value,
  );
}

describe("⛔ le devis s'ouvre vide et l'aide est à côté", () => {
  beforeEach(() => {
    createDevisActionMock.mockReset();
    createDevisActionMock.mockResolvedValue({ data: { id: "d-1", numero: "AXI-DEV-2026-001" } });
  });

  it("avec un projet, le formulaire s'ouvre exactement comme sans", () => {
    const sans = valeurs(monter().container);
    document.body.innerHTML = "";
    const avec = valeurs(monter(PROJET_ID).container);
    expect(avec).toEqual(sans);
  });

  it("l'envoi porte le projet et ce que Will a saisi, rien d'autre", async () => {
    const { container } = monter(PROJET_ID);
    const designation = container.querySelector(
      'input[placeholder], input[type="text"]',
    ) as HTMLInputElement;
    fireEvent.change(designation, { target: { value: "Ligne saisie par Will" } });
    const prix = [...container.querySelectorAll('input[type="number"]')].at(-1) as HTMLInputElement;
    fireEvent.change(prix, { target: { value: "100000" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const envoi = createDevisActionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi["projetId"]).toBe(PROJET_ID);
    expect(Object.keys(envoi).sort()).toEqual(["clientId", "lignes", "projetId"]);
    void screen;
  });

  it("contre-témoin : sans projet, aucun projetId", async () => {
    const { container } = monter();
    const designation = container.querySelector(
      'input[placeholder], input[type="text"]',
    ) as HTMLInputElement;
    fireEvent.change(designation, { target: { value: "Ligne" } });
    const prix = [...container.querySelectorAll('input[type="number"]')].at(-1) as HTMLInputElement;
    fireEvent.change(prix, { target: { value: "100000" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    expect(createDevisActionMock.mock.calls[0]?.[0]).not.toHaveProperty("projetId");
  });

  it.each([
    ["src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/new/page.tsx", "DevisForm"],
    ["src/app/[locale]/(admin)/[adminPrefix]/qualiopi/vente/new/page.tsx", "VenteWizard"],
  ])("%s : le formulaire reçoit le projet, l'aide est rendue à part", (page, composant) => {
    const s = readFileSync(join(process.cwd(), page), "utf8");
    // L'élément entier (jusqu'à sa fermeture en début de ligne), panneau retiré :
    // la vente guidée le reçoit comme un EMPLACEMENT (`aside`), rendu tel quel.
    const balise = (new RegExp(`<${composant}\\b[\\s\\S]*?\\n\\s*/>`).exec(s)?.[0] ?? "").replace(
      /<CeQueLeClientADit\b[^>]*\/>/g,
      "",
    );
    expect(balise).toContain("projetId");
    expect(balise).not.toMatch(/aide=|citations|valeurs=|defaultLignes|nbParticipants/);
    expect(s).toContain("<CeQueLeClientADit");
  });
});
