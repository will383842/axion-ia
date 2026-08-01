import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Trash2, ArrowRight } from "lucide-react";
import { AdminButton } from "./AdminButton";

describe("AdminButton", () => {
  it("rend un bouton primaire par défaut", () => {
    render(<AdminButton>Enregistrer</AdminButton>);
    const el = screen.getByRole("button", { name: "Enregistrer" });
    expect(el.className).toContain("admin-button");
    expect(el.getAttribute("type")).toBe("button");
  });

  // `type="button"` par défaut : un `<button>` sans type vaut `submit`, ce qui
  // fait envoyer le formulaire au moindre clic sur une action secondaire.
  it("n'envoie pas le formulaire sauf demande explicite", () => {
    render(<AdminButton type="submit">Envoyer</AdminButton>);
    expect(screen.getByRole("button", { name: "Envoyer" }).getAttribute("type")).toBe("submit");
  });

  it("applique la classe de chaque variante", () => {
    const cases = [
      ["primary", "admin-button"],
      ["secondary", "admin-button-secondary"],
      ["ghost", "admin-button-ghost"],
      ["danger", "admin-button-danger"],
      ["ghost-danger", "admin-button-ghost-danger"],
    ] as const;
    for (const [variant, expected] of cases) {
      const { unmount } = render(<AdminButton variant={variant}>{variant}</AdminButton>);
      expect(screen.getByRole("button", { name: variant }).className).toContain(expected);
      unmount();
    }
  });

  it("expose `block` et `size` via les modificateurs de admin.css", () => {
    render(
      <AdminButton block size="sm">
        Continuer
      </AdminButton>,
    );
    const el = screen.getByRole("button", { name: "Continuer" });
    expect(el.className).toContain("admin-button-block");
    expect(el.className).toContain("admin-button-sm");
  });

  // Le libellé reste affiché pendant le chargement : le remplacer ferait
  // sauter la largeur du bouton et priverait le lecteur d'écran du contexte.
  it("pendant le chargement, désactive, annonce aria-busy et garde le libellé", () => {
    render(
      <AdminButton loading icon={Trash2}>
        Supprimer
      </AdminButton>,
    );
    const el = screen.getByRole("button", { name: "Supprimer" });
    expect(el.hasAttribute("disabled")).toBe(true);
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("rend un lien quand `href` est fourni", () => {
    render(
      <AdminButton href="/fr/admin/devis" variant="secondary" iconAfter={ArrowRight}>
        Voir les devis
      </AdminButton>,
    );
    const el = screen.getByRole("link", { name: "Voir les devis" });
    expect(el.getAttribute("href")).toBe("/fr/admin/devis");
    expect(el.className).toContain("admin-button-secondary");
  });

  // Les props de présentation ne doivent pas fuir dans le DOM : React
  // émettrait un avertissement et l'attribut se retrouverait dans le HTML.
  it("ne laisse aucune prop de présentation atteindre le DOM", () => {
    render(
      <AdminButton variant="ghost" size="sm" block icon={Trash2}>
        Retirer
      </AdminButton>,
    );
    const el = screen.getByRole("button", { name: "Retirer" });
    for (const leaked of ["variant", "size", "block", "icon", "iconAfter", "loading"]) {
      expect(el.hasAttribute(leaked)).toBe(false);
    }
  });
});
