// Tests AdminTabs — Sprint Notif Infra 2026-05-26 / fix P1-7 audit 2026-05-27.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminTabs, type AdminTabItem } from "../AdminTabs";

const tabs: AdminTabItem[] = [
  { id: "messages", label: "Messages", href: "/admin/contacts/messages", count: 5 },
  { id: "calendly", label: "RDV Calendly", href: "/admin/contacts/calendly" },
];

describe("AdminTabs", () => {
  it("rend tous les onglets avec leur label", () => {
    render(<AdminTabs tabs={tabs} activeTabId="messages" />);
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("RDV Calendly")).toBeInTheDocument();
  });

  it("expose role=tablist + role=tab a11y", () => {
    render(<AdminTabs tabs={tabs} activeTabId="messages" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabEls = screen.getAllByRole("tab");
    expect(tabEls).toHaveLength(2);
  });

  it("marque l'onglet actif avec aria-current=page", () => {
    render(<AdminTabs tabs={tabs} activeTabId="messages" />);
    const active = screen.getByRole("tab", { name: /Messages/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("aria-selected", "true");
    const inactive = screen.getByRole("tab", { name: /RDV Calendly/i });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("affiche le badge compteur quand count > 0", () => {
    render(<AdminTabs tabs={tabs} activeTabId="messages" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByLabelText("5 éléments")).toBeInTheDocument();
  });

  it("formate 999+ pour les compteurs > 999", () => {
    const big: AdminTabItem[] = [{ id: "x", label: "X", href: "/x", count: 1500 }];
    render(<AdminTabs tabs={big} activeTabId="x" />);
    expect(screen.getByText("999+")).toBeInTheDocument();
  });

  it("aria-controls pointe vers l'id panel correspondant", () => {
    render(<AdminTabs tabs={tabs} activeTabId="messages" />);
    const msg = screen.getByRole("tab", { name: /Messages/i });
    expect(msg).toHaveAttribute("aria-controls", "messages-panel");
  });
});
