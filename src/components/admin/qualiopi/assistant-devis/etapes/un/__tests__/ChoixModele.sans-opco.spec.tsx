import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { ChoixModele } from "../ChoixModele";
import { etatT1 } from "../../../fixtures";

describe("ChoixModele — aucune mention d'OPCO", () => {
  it("le rendu réel des modèles ne contient pas « OPCO »", () => {
    const { container } = render(<ChoixModele etat={etatT1()} dispatch={vi.fn()} />);
    expect(container.textContent).toContain("Formation");
    expect(container.textContent).not.toMatch(/OPCO/i);
  });
});
