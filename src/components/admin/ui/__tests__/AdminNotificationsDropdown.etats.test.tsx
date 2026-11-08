import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNotificationsDropdown } from "../AdminNotificationsDropdown";

describe("AdminNotificationsDropdown — icône ET mot", () => {
  it("chaque sévérité affiche son mot et une icône, l'erreur s'écrit « Erreur »", () => {
    render(
      <AdminNotificationsDropdown
        allHref="/alerts"
        items={[
          {
            id: "1",
            title: "Envoi",
            href: "/a",
            severity: "destructive",
            createdAt: "2026-11-07T10:00:00Z",
          },
          {
            id: "2",
            title: "Quota",
            href: "/b",
            severity: "warning",
            createdAt: "2026-11-07T10:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("Erreur")).toBeDefined();
    expect(screen.queryByText("Critique")).toBeNull();
    expect(screen.getByText("Attention")).toBeDefined();
    const badges = document.querySelectorAll("li .admin-badge-v2");
    expect(badges.length).toBe(2);
    for (const b of badges) expect(b.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
