import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/fiche/actions-notes", () => ({
  ajouterNoteFormAction: vi.fn(),
  basculerEpingleFormAction: vi.fn(),
}));

import { CarteNotes } from "../CarteNotes";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const note = (id: string, epinglee: boolean, texte: string | null) => ({
  id,
  auteurLabel: "Will",
  texte,
  epinglee,
  createdAt: new Date("2026-10-29T08:30:00Z"),
  projetId: null,
});

describe("CarteNotes", () => {
  it("rend les notes dans l'ordre reçu, avec date Paris, auteur et bouton adapté", () => {
    const html = renderToStaticMarkup(
      <CarteNotes
        clientId={ID}
        notes={[note("a", true, "Première"), note("b", false, "Seconde")]}
        total={2}
        prestations={[]}
        peutEcrire
      />,
    );
    expect(html.indexOf("Première")).toBeLessThan(html.indexOf("Seconde"));
    expect(html).toContain("Détacher");
    expect(html).toContain("Épingler");
    expect(html).toContain("Will");
    expect(html).toContain("Ajouter une note");
  });

  it("sans droit d'écriture : ni bouton ni formulaire", () => {
    const html = renderToStaticMarkup(
      <CarteNotes
        clientId={ID}
        notes={[note("a", false, "x")]}
        total={1}
        prestations={[]}
        peutEcrire={false}
      />,
    );
    expect(html).not.toContain("<form");
  });

  it("un texte illisible n'est jamais un faux texte", () => {
    const html = renderToStaticMarkup(
      <CarteNotes
        clientId={ID}
        notes={[note("a", false, null)]}
        total={1}
        prestations={[]}
        peutEcrire={false}
      />,
    );
    expect(html).toContain("Texte illisible");
  });
});
