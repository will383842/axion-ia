// Déclaration d'entreprise, côté navigateur : une coupure réseau ne perd pas la saisie,
// et la date du contact est plafonnée à « aujourd'hui » en heure de Paris.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  declarer: vi.fn(),
  rechercher: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("./actions-declaration", () => ({
  declarerEntrepriseAction: (...a: unknown[]) => h.declarer(...a),
  rechercherEntrepriseDeclarationAction: (...a: unknown[]) => h.rechercher(...a),
}));

import { DeclarationEntreprise } from "./DeclarationEntreprise";
import { TEXTES } from "./textes";
import { lignesComment } from "./textes-comment";

const ACTUEL = lignesComment(null, 6, 60);

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DeclarationEntreprise", () => {
  it("« Comment ça se passe » : contact de notre part, durée reçue de la page, commission due quand la prestation est réalisée ET entièrement payée", () => {
    const { container } = render(<DeclarationEntreprise id="i" jeton="j" lignesComment={ACTUEL} />);
    const t = container.textContent ?? "";
    expect(t).toContain("Comment ça se passe");
    expect(t).toContain("nous prenons contact avec l'entreprise de votre part");
    expect(t).toContain("réservé 6 mois à compter de votre déclaration");
    // 2026-10-07 (a1) : la commission naît de la prestation RÉALISÉE et ENTIÈREMENT payée.
    expect(t).toContain(
      "dès que le client a payé l'intégralité, même si la prestation n'est pas encore livrée",
    );
    expect(t).not.toContain("une fois payée");
    expect(t).not.toMatch(/\d+\s*(jours|heures)/);
  });

  it("lot 7b : règle « rendez_vous » → texte 60 jours ; règle nulle → texte actuel inchangé", () => {
    const rdv = render(
      <DeclarationEntreprise
        id="i"
        jeton="j"
        lignesComment={lignesComment("rendez_vous", 6, 60)}
      />,
    );
    const t = rdv.container.textContent ?? "";
    expect(t).toContain("vous est gardée 60 jours à compter de votre déclaration");
    expect(t).toContain(
      "Une commission est due quand le client a payé la totalité de sa commande.",
    );
    expect(t).not.toContain("réservé 6 mois à compter de votre déclaration");
    cleanup();
    const nulle = render(
      <DeclarationEntreprise id="i" jeton="j" lignesComment={lignesComment(null, 6, 60)} />,
    );
    const actuel = render(<DeclarationEntreprise id="i" jeton="j" lignesComment={ACTUEL} />);
    expect(nulle.container.textContent).toBe(actuel.container.textContent);
    expect(actuel.container.textContent).toContain("réservé 6 mois à compter de votre déclaration");
  });

  it("coupure réseau : message « connexion perdue », saisie conservée", async () => {
    h.declarer.mockRejectedValue(new Error("Failed to fetch"));
    const { container } = render(<DeclarationEntreprise id="i" jeton="j" lignesComment={ACTUEL} />);
    const siren = container.querySelector('input[name="siret"]') as HTMLInputElement;
    fireEvent.change(siren, { target: { value: "73282932000074" } });
    const form = container.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(await screen.findByText(TEXTES.connexionPerdue)).toBeTruthy();
    await waitFor(() => expect(siren.value).toBe("73282932000074"));
  });

  it("date du contact : plafond en heure de Paris (1er janvier 00 h 30 à Paris = 31/12 en UTC)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
    const { container } = render(<DeclarationEntreprise id="i" jeton="j" lignesComment={ACTUEL} />);
    const date = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(date.max).toBe("2027-01-01");
  });
});
