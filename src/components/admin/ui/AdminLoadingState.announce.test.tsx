/**
 * Lot 4 — « au lecteur d'écran, le chargement est annoncé UNE fois, pas cinq ».
 *
 * C'est le critère de sortie du lot, et c'est un critère que la granularisation
 * elle-même met en danger : `AdminLoadingState` posait `aria-live` sans
 * condition, donc cinq blocs d'attente simultanés faisaient cinq annonces.
 * Le défaut n'existait pas avant le lot — il serait NÉ du lot.
 *
 * ⚠️ La distinction que ces tests figent, et qu'il est facile de retourner :
 *   · une ROUTE (`loading.tsx`) annonce — en App Router, une navigation ne
 *     montre qu'une seule frontière d'attente, la plus proche du segment qui
 *     change. La rendre muette rendrait muette toute navigation interne ;
 *   · une SECTION d'une page qui en compte plusieurs n'annonce pas — sinon
 *     l'utilisateur entend cinq fois la même chose pour un seul écran.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminLoadingState } from "./AdminLoadingState";

describe("🔴 le bloc d'attente annonce par défaut", () => {
  it("expose une région live et un libellé lisible", () => {
    render(<AdminLoadingState ariaLabel="Chargement des sessions" />);
    const bloc = screen.getByRole("status");
    expect(bloc).toHaveAttribute("aria-live", "polite");
    expect(bloc).toHaveAttribute("aria-busy", "true");
    // Le texte sr-only est ce que le lecteur d'écran ÉNONCE. Sans lui, la
    // région live est vide et n'annonce rien du tout.
    expect(screen.getByText("Chargement des sessions")).toBeInTheDocument();
  });
});

describe("🔴 une sous-section se tait, sans devenir invisible", () => {
  it("announce={false} retire la région live", () => {
    const { container } = render(
      <AdminLoadingState ariaLabel="Chargement des indicateurs" announce={false} />,
    );
    // Plus de role=status : c'est LUI qui déclenche l'annonce (role=status
    // implique aria-live=polite, même sans l'attribut).
    expect(screen.queryByRole("status")).toBeNull();
    const bloc = container.querySelector(".admin-loading-state");
    expect(bloc).not.toBeNull();
    expect(bloc).not.toHaveAttribute("aria-live");
  });

  it("mais conserve aria-busy et son libellé", () => {
    // 🔴 Se taire n'est pas disparaître. Sans `aria-busy`, la zone paraîtrait
    // simplement VIDE à une technologie d'assistance — pire que bruyante :
    // trompeuse. Ce qu'on retire, c'est l'annonce, pas l'information.
    const { container } = render(
      <AdminLoadingState ariaLabel="Chargement des indicateurs" announce={false} />,
    );
    const bloc = container.querySelector(".admin-loading-state");
    expect(bloc).toHaveAttribute("aria-busy", "true");
    expect(bloc).toHaveAttribute("aria-label", "Chargement des indicateurs");
  });

  it("cinq sous-sections ne produisent AUCUNE annonce concurrente", () => {
    // Le cas exact du critère de sortie : le hub, ses cinq blocs, une seule
    // voix. Ici les cinq sections se taisent ; c'est la frontière de route qui
    // parle, au-dessus d'elles.
    render(
      <>
        {["Sessions", "Dossiers", "Créances", "Alertes", "Formateurs"].map((s) => (
          <AdminLoadingState key={s} ariaLabel={`Chargement — ${s}`} announce={false} />
        ))}
      </>,
    );
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });
});
