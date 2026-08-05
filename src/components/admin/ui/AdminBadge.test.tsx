import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminBadge, AdminStatusBadge } from "./AdminBadge";

describe("AdminBadge", () => {
  it("renders children with neutral default tone", () => {
    render(<AdminBadge>NEW</AdminBadge>);
    expect(screen.getByText("NEW")).toBeDefined();
  });

  it("applies className prop", () => {
    render(<AdminBadge className="custom-x">A</AdminBadge>);
    // Le libellé vit dans un span interne (cf. garde des espaces ci-dessous) :
    // les classes de ton/forme restent sur l'enveloppe.
    const el = screen.getByText("A");
    expect(el.parentElement?.className).toContain("custom-x");
  });

  // 🔴 Vu en production le 2026-08-05 : « Client AXI-CLI-004créé ». L'enveloppe
  // est un flex, donc chaque nœud de texte devenait un flex item dont les
  // espaces de bord étaient supprimés. Réintroduire le rendu direct des
  // children fait rougir ce test.
  it("préserve les espaces autour d'une valeur interpolée (piège flex)", () => {
    const numero = "AXI-CLI-004";
    render(
      <AdminBadge tone="success">Client {numero} créé — passez à l&apos;étape suivante</AdminBadge>,
    );
    const el = screen.getByText(/Client/);
    expect(el.textContent).toContain("Client AXI-CLI-004 créé");
    expect(el.textContent).not.toContain("AXI-CLI-004créé");
  });

  it("le point de statut reste un item distinct du libellé", () => {
    render(
      <AdminBadge tone="info" dot>
        Actif
      </AdminBadge>,
    );
    const libelle = screen.getByText("Actif");
    const enveloppe = libelle.parentElement;
    expect(enveloppe?.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(enveloppe?.children.length).toBe(2);
  });
});

describe("AdminStatusBadge", () => {
  it("derives FR label from status when no override", () => {
    render(<AdminStatusBadge status="in_progress" type="job" />);
    expect(screen.getByText("En cours")).toBeDefined();
  });

  /**
   * 🔴 CONTRAT CHANGÉ le 2026-08-03, volontairement.
   *
   * Ce test verrouillait un repli qui transformait `generating_text` en
   * « generating text » : de l'anglais brut, espacé, présenté comme du
   * français. Six statuts au moins étaient dans ce cas (`quarantined_factcheck`,
   * `running_qa`, `quality_improving`, `bounced`, `delivered`…), tous présents
   * dans les énumérations Prisma, aucun dans la table de libellés — sur les
   * 48 écrans qui importent ce composant, sans erreur ni alerte.
   *
   * On ne peut pas traduire ce qu'on ne connaît pas. On peut cesser de faire
   * passer un identifiant machine pour une phrase : la valeur exacte est
   * conservée (elle sert au diagnostic) et présentée comme un code cité.
   */
  it("cite le statut inconnu au lieu de le maquiller en français", () => {
    render(<AdminStatusBadge status="some_unknown_state" type="job" />);
    expect(screen.getByText("« some_unknown_state »")).toBeDefined();
  });

  it("uses label override when provided", () => {
    render(<AdminStatusBadge status="paid" type="invoice" label="Payée" />);
    expect(screen.getByText("Payée")).toBeDefined();
  });

  it("maps 'completed' / 'paid' / 'published' to success tone", () => {
    const { container, rerender } = render(<AdminStatusBadge status="completed" type="job" />);
    expect(container.firstChild).toBeDefined();
    rerender(<AdminStatusBadge status="paid" type="invoice" />);
    expect(container.firstChild).toBeDefined();
  });

  it("maps 'failed' / 'cancelled' / 'overdue' to destructive tone", () => {
    const { container } = render(<AdminStatusBadge status="failed" type="job" />);
    expect(container.firstChild).toBeDefined();
  });

  it("maps 'pending' / 'processing' to warning tone", () => {
    const { container } = render(<AdminStatusBadge status="pending" type="invoice" />);
    expect(container.firstChild).toBeDefined();
  });
});
