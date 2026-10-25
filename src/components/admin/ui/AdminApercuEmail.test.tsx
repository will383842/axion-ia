import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminApercuEmail } from "./AdminApercuEmail";

const HTML = "<p>Bonjour</p><script>window.parent.document.title='x'</script>";

function rendre() {
  return render(
    <AdminApercuEmail
      de="Axion IA <contact@axion-ia.com>"
      a="client@example.com"
      objet="Votre questionnaire"
      html={HTML}
    />,
  );
}

describe("AdminApercuEmail", () => {
  it("isole le corps de l'e-mail : sandbox vide, titre, srcDoc", () => {
    const { container } = rendre();
    const cadre = container.querySelector("iframe");
    expect(cadre).not.toBeNull();
    // sandbox="" = aucune permission (ni script, ni formulaire, ni navigation).
    expect(cadre?.getAttribute("sandbox")).toBe("");
    expect(cadre?.getAttribute("title")).toBe("Aperçu de l'e-mail");
    expect(cadre?.getAttribute("srcdoc")).toBe(HTML);
  });

  it("n'injecte jamais le HTML de l'e-mail dans la page", () => {
    const { container } = rendre();
    // Le script du corps n'existe que dans l'attribut srcdoc, pas dans le DOM de la page.
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByText("Bonjour")).toBeNull();
  });

  it("affiche l'enveloppe De / À / Objet", () => {
    rendre();
    expect(screen.getByText("De")).toBeDefined();
    expect(screen.getByText("Axion IA <contact@axion-ia.com>")).toBeDefined();
    expect(screen.getByText("client@example.com")).toBeDefined();
    expect(screen.getByText("Votre questionnaire")).toBeDefined();
  });

  it("bascule Ordinateur / Téléphone en CSS seul : deux radios, Ordinateur coché", () => {
    const { container } = rendre();
    const radios = container.querySelectorAll<HTMLInputElement>("input[type='radio']");
    expect(radios).toHaveLength(2);
    expect(radios[0]?.checked).toBe(true);
    expect(radios[0]?.name).toBe(radios[1]?.name);
    expect(screen.getByLabelText("Téléphone")).toBeDefined();
    expect(screen.getByLabelText("Ordinateur")).toBeDefined();
  });
});
