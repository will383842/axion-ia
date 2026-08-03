/**
 * Tests — coquille des espaces connectés.
 *
 * Ce que ces tests protègent n'est pas l'apparence, c'est la NAVIGABILITÉ. Les
 * trois espaces étaient des colonnes uniques où tout s'empilait ; la barre
 * latérale est ce qui remplace le défilement à l'aveugle. Trois choses doivent
 * donc rester vraies, et aucune ne se voit au typecheck :
 *
 *  1. chaque destination est atteignable sur les DEUX supports — barre latérale
 *     sur grand écran, barre du bas sur téléphone. En perdre une reviendrait à
 *     rendre l'espace inutilisable sur l'un des deux, sans erreur ;
 *  2. la destination courante est signalée, sinon l'utilisateur ne sait plus où
 *     il est — c'est le défaut d'origine, en pire ;
 *  3. la pastille compte ce qui est EN ATTENTE, et disparaît à zéro.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CalendarDays, CircleCheckBig, FileText } from "lucide-react";

import { EspaceShell, type EspaceNavItem } from "../EspaceShell";

const NAV: readonly EspaceNavItem[] = [
  { cle: "accueil", href: "/fr/x", label: "À faire", icone: CircleCheckBig, enAttente: 2 },
  {
    cle: "formations",
    href: "/fr/x/formations",
    label: "Mes formations",
    labelCourt: "Formations",
    icone: CalendarDays,
  },
  { cle: "documents", href: "/fr/x/documents", label: "Mes documents", icone: FileText },
];

function rendre(sectionActive = "accueil") {
  return render(
    <EspaceShell
      titreEspace="Mon espace"
      sousTitreEspace="Votre formation et vos documents"
      navigation={NAV}
      sectionActive={sectionActive}
      utilisateur={{ nom: "Simone Blanc" }}
      actionSortie={<button type="button">Quitter</button>}
    >
      <p>Contenu</p>
    </EspaceShell>,
  );
}

describe("EspaceShell — les deux navigations", () => {
  it("expose chaque destination sur grand écran ET sur téléphone", () => {
    rendre();

    // Deux barres portent le même `aria-label` : c'est la même navigation, sur
    // deux supports. En perdre une rendrait l'espace inutilisable sur l'un des
    // deux — sans qu'aucune erreur ne se produise.
    const barres = screen.getAllByRole("navigation", { name: /Mon espace/ });
    expect(barres).toHaveLength(2);

    for (const barre of barres) {
      expect(within(barre).getByRole("link", { name: /À faire/ })).toBeTruthy();
      expect(within(barre).getByRole("link", { name: /formations/i })).toBeTruthy();
      expect(within(barre).getByRole("link", { name: /documents/i })).toBeTruthy();
    }
  });

  it("utilise le libellé COURT sur la barre du bas quand il est fourni", () => {
    rendre();
    // « Mes formations » ne tient pas sous une icône de 20 px sur un téléphone.
    expect(screen.getByText("Formations")).toBeTruthy();
    expect(screen.getByText("Mes formations")).toBeTruthy();
  });

  it("retombe sur le libellé long quand aucun court n'est donné", () => {
    rendre();
    expect(screen.getAllByText("Mes documents")).toHaveLength(2);
  });
});

describe("EspaceShell — la destination courante", () => {
  it("signale la section active, sur les deux barres", () => {
    rendre("formations");

    const actifs = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");

    expect(actifs).toHaveLength(2);
    for (const lien of actifs) {
      expect(lien.getAttribute("href")).toBe("/fr/x/formations");
    }
  });

  it("ne marque RIEN quand la section ne correspond à aucune entrée", () => {
    // Repli volontairement muet : une entrée surlignée au hasard mentirait sur
    // l'endroit où se trouve l'utilisateur.
    rendre("section-inconnue");
    const actifs = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(actifs).toHaveLength(0);
  });
});

describe("EspaceShell — la pastille d'actions en attente", () => {
  it("annonce le nombre aux lecteurs d'écran, pas seulement en couleur", () => {
    rendre();
    // Une pastille colorée sans texte alternatif ne dit rien à qui n'y voit pas.
    expect(screen.getByLabelText("2 actions en attente")).toBeTruthy();
  });

  it("disparaît à zéro — « 0 » inquiète sans rien signaler", () => {
    render(
      <EspaceShell
        titreEspace="Mon espace"
        navigation={[{ cle: "accueil", href: "/fr/x", label: "À faire", icone: CircleCheckBig }]}
        sectionActive="accueil"
      >
        <p>Contenu</p>
      </EspaceShell>,
    );
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("EspaceShell — identité et sortie", () => {
  it("montre le nom et une porte de sortie", () => {
    rendre();
    expect(screen.getByText("Simone Blanc")).toBeTruthy();
    // 🔴 Retirer la sortie enfermerait l'utilisateur dans l'espace : c'est le
    // même défaut que « Déconnexion » disparue du tableau de bord admin.
    expect(screen.getByRole("button", { name: "Quitter" })).toBeTruthy();
  });

  it("rend le contenu de la page", () => {
    rendre();
    expect(screen.getByText("Contenu")).toBeTruthy();
  });
});
