/**
 * Badge « E-mail à valider » des devis (B2, PR 5, lecture seule) : présent pour un brouillon dont
 * l'e-mail attend, absent sinon ; badge « ancien » pour un devis marqué envoyé dont l'e-mail n'est
 * pas encore parti. Le badge mène à l'écran des e-mails à valider.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BadgeEmailDevis } from "../BadgeEmailDevis";
import {
  TEXTE_BADGE_ANCIEN,
  TEXTE_BADGE_A_VALIDER,
  badgeEmailDevis,
} from "@/server/qualiopi/devis/badge-email-devis";

afterEach(cleanup);

describe("badgeEmailDevis (règle)", () => {
  it("brouillon avec e-mail en attente : « à valider »", () => {
    expect(badgeEmailDevis("brouillon", true)).toBe("a_valider");
  });
  it("envoyé avec e-mail en attente : « ancien »", () => {
    expect(badgeEmailDevis("envoye", true)).toBe("ancien");
  });
  it("sans e-mail en attente : aucun badge", () => {
    expect(badgeEmailDevis("brouillon", false)).toBeNull();
    expect(badgeEmailDevis("envoye", false)).toBeNull();
  });
  it("autres statuts : aucun badge, même avec une ligne en attente", () => {
    for (const s of ["accepte", "refuse", "expire", "transforme_convention"]) {
      expect(badgeEmailDevis(s, true)).toBeNull();
    }
  });
});

describe("<BadgeEmailDevis />", () => {
  const href = "/fr/adm/qualiopi/emails";

  it("textes exacts", () => {
    expect(TEXTE_BADGE_A_VALIDER).toBe("E-mail à valider");
    expect(TEXTE_BADGE_ANCIEN).toBe("Marqué envoyé, e-mail pas encore parti");
  });

  it("brouillon en attente : badge avec lien vers les e-mails à valider", () => {
    const { container } = render(<BadgeEmailDevis statut="brouillon" enAttente href={href} />);
    expect(container.textContent).toBe("E-mail à valider");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(href);
  });

  it("brouillon sans e-mail en attente : rien", () => {
    const { container } = render(
      <BadgeEmailDevis statut="brouillon" enAttente={false} href={href} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("envoyé avec ligne à valider : badge « ancien »", () => {
    const { container } = render(<BadgeEmailDevis statut="envoye" enAttente href={href} />);
    expect(container.textContent).toBe("Marqué envoyé, e-mail pas encore parti");
  });

  it("accepté : rien", () => {
    const { container } = render(<BadgeEmailDevis statut="accepte" enAttente href={href} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("fiche client : cartes de devis", () => {
  it("le badge n'apparaît que sur les devis dont l'e-mail attend, lien vers les e-mails à valider", async () => {
    const { CartesDevis } = await import("@/components/admin/dossier-client/fiche/CartesPieces");
    const d = (id: string, statut: string) => ({
      id,
      numero: id,
      statut,
      montantTotalHtCents: 1000,
      createdAt: new Date("2030-01-01T00:00:00Z"),
    });
    const { container } = render(
      <CartesDevis
        devis={[d("b1", "brouillon"), d("b2", "brouillon"), d("e1", "envoye")]}
        qBase="/fr/adm/qualiopi"
        statuts={{}}
        emailsEnAttente={new Set(["b1", "e1"])}
      />,
    );
    const badges = [...container.querySelectorAll('[data-testid="badge-email-devis"]')];
    expect(badges.map((b) => b.textContent)).toEqual([
      "E-mail à valider",
      "Marqué envoyé, e-mail pas encore parti",
    ]);
    expect(badges[0]?.getAttribute("href")).toBe("/fr/adm/qualiopi/emails");
  });
});
