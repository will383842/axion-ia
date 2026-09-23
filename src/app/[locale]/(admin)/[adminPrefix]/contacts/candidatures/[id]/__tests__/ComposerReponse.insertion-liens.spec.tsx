/**
 * INSÉRER UN LIEN AU CURSEUR — le composeur n'accepte aucune pièce jointe, et
 * Will ne retenait pas les adresses de tête. Ces boutons collent le lien
 * markdown `[libellé](url)` là où le curseur se trouve, prêt à partir.
 *
 * 🔴 CE QUE CE TEST PROUVE, ET RIEN DE PLUS. Il ne rouvre pas l'envoi
 * (mocké) : il prouve que le CLIC met le bon fragment markdown dans le
 * `<textarea>`, à la bonne position — le seul comportement neuf de ce lot.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

// Les Server Actions ne sont jamais appelées dans ce test (aucun envoi n'est
// déclenché) : le mock existe pour que l'import du module ne tire pas `auth`,
// `prisma` et la file d'e-mails dans un environnement jsdom qui ne les a pas.
vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  repondreAuCandidatAction: vi.fn(),
  rejouerReponseEchoueeAction: vi.fn(),
  etatLivraisonReponseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ComposerReponse } from "../ComposerReponse";

const LIENS = [
  { id: "depliant-formations", label: "Catalogue des prestations", url: "https://x.invalid/a.pdf" },
  { id: "calendly-echange", label: "Réserver un échange", url: "https://calendly.com/x/y" },
];

afterEach(cleanup);

function ouvrirComposeur(liens = LIENS): void {
  render(
    <ComposerReponse
      applicationId="11111111-1111-1111-1111-111111111111"
      prenom="Amina"
      poste="Monteur vidéo"
      liensInsertion={liens}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre au candidat" }));
}

describe("ComposerReponse — insertion de lien au curseur", () => {
  it("n'affiche AUCUN bouton d'insertion quand la liste est vide", () => {
    ouvrirComposeur([]);
    expect(screen.queryByRole("group", { name: "Insérer un lien" })).toBeNull();
  });

  it("insère le lien markdown en fin de message quand il est vide", () => {
    ouvrirComposeur();
    fireEvent.click(screen.getByRole("button", { name: "Catalogue des prestations" }));
    const zone = screen.getByLabelText("Message") as HTMLTextAreaElement;
    expect(zone.value).toBe("[Catalogue des prestations](https://x.invalid/a.pdf)");
  });

  it("🔴 insère AU CURSEUR, pas seulement en fin de texte", () => {
    ouvrirComposeur();
    const zone = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(zone, { target: { value: "AvantApres" } });
    // Curseur entre « Avant » (5 lettres, indices 0-4) et « Apres ».
    zone.setSelectionRange(5, 5);
    fireEvent.click(screen.getByRole("button", { name: "Réserver un échange" }));
    expect(zone.value).toBe("Avant[Réserver un échange](https://calendly.com/x/y)Apres");
  });

  it("🔴 remplace la SÉLECTION plutôt que de l'ignorer", () => {
    ouvrirComposeur();
    const zone = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(zone, { target: { value: "un TEXTE à remplacer" } });
    // Sélection sur « TEXTE » seul (indices 3 à 8, espace exclu des deux côtés).
    zone.setSelectionRange(3, 8);
    fireEvent.click(screen.getByRole("button", { name: "Catalogue des prestations" }));
    expect(zone.value).toBe("un [Catalogue des prestations](https://x.invalid/a.pdf) à remplacer");
  });
});
