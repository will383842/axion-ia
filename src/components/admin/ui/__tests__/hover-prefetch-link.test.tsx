/**
 * La barre latérale ne précharge plus ses ~150 liens à l'ouverture de la page.
 *
 * Audit UI du 2026-09-02 : 16 à 30 requêtes `?_rsc=` par page admin, 20 à 60 %
 * en 503. Le lien de navigation doit dire `prefetch={false}` tant qu'il n'a
 * pas été survolé (ou focalisé), puis rendre la main au comportement par
 * défaut de Next (`null`).
 */
// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

const linkProps = vi.fn();

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a"> & { prefetch?: boolean | null }) => {
    const { prefetch, ...rest } = props;
    linkProps({ prefetch });
    return <a {...rest} data-prefetch={String(prefetch)} />;
  },
}));

import { HoverPrefetchLink } from "../HoverPrefetchLink";

describe("HoverPrefetchLink", () => {
  it("désactive le préchargement tant que le lien n'a pas été survolé", () => {
    render(<HoverPrefetchLink href="/fr/admin/content-gen/jobs">Jobs</HoverPrefetchLink>);
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "false");
  });

  it("rend la main au comportement par défaut de Next au survol", () => {
    render(<HoverPrefetchLink href="/fr/admin/content-gen/jobs">Jobs</HoverPrefetchLink>);
    fireEvent.mouseEnter(screen.getByRole("link"));
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "null");
  });

  it("le focus clavier vaut survol", () => {
    render(<HoverPrefetchLink href="/fr/admin/content-gen/jobs">Jobs</HoverPrefetchLink>);
    fireEvent.focus(screen.getByRole("link"));
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "null");
  });

  it("transmet les gestionnaires d'événements de l'appelant", () => {
    const onMouseEnter = vi.fn();
    render(
      <HoverPrefetchLink href="/x" onMouseEnter={onMouseEnter}>
        x
      </HoverPrefetchLink>,
    );
    fireEvent.mouseEnter(screen.getByRole("link"));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});
