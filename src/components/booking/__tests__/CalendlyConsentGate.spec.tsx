/**
 * Le test qui garde le correctif X2 : rien de Calendly avant le clic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CalendlyConsentGate } from "../CalendlyConsentGate";

// `Link` de next-intl exige un contexte de routing hors de portée d'un test
// unitaire ; seul le href nous intéresse ici.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const URL_PARAMED = "https://calendly.com/axion-ia/premier-contact?hide_gdpr_banner=1";
const URL_RAW = "https://calendly.com/axion-ia/premier-contact";

function setup() {
  return render(<CalendlyConsentGate url={URL_PARAMED} fallbackUrl={URL_RAW} isFr height={720} />);
}

describe("CalendlyConsentGate", () => {
  beforeEach(() => {
    cleanup();
    document.head.querySelectorAll("script[data-calendly-loader]").forEach((s) => s.remove());
  });

  it("au rendu initial, aucun marqueur d'auto-scan Calendly n'est présent", () => {
    const { container } = setup();
    expect(container.querySelector(".calendly-inline-widget")).toBeNull();
    expect(container.querySelector("[data-url]")).toBeNull();
    expect(document.querySelector('script[src*="assets.calendly.com"]')).toBeNull();
  });

  it("le lien externe est présent AVANT le clic — le visiteur qui refuse garde un chemin de réservation", () => {
    setup();
    const link = screen.getByRole("link", { name: /nouvel onglet/i });
    expect(link).toHaveAttribute("href", URL_RAW);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("la notice de Calendly masquée par hide_gdpr_banner est compensée par un lien vers leur politique", () => {
    setup();
    const link = screen.getByRole("link", { name: /confidentialité calendly/i });
    expect(link).toHaveAttribute("href", "https://calendly.com/privacy");
  });

  it("après le clic, le conteneur natif et widget.js apparaissent", async () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: /afficher le calendrier/i }));
    const embed = container.querySelector(".calendly-inline-widget");
    expect(embed).not.toBeNull();
    expect(embed).toHaveAttribute("data-url", URL_PARAMED);
    await vi.waitFor(() => {
      expect(document.querySelector('script[src*="assets.calendly.com"]')).not.toBeNull();
    });
  });

  it("la boîte est identique avant et après le clic (CLS = 0)", () => {
    const { container } = setup();
    const before = (container.firstElementChild as HTMLElement).style;
    const beforeBox = { h: before.height, w: before.minWidth };
    fireEvent.click(screen.getByRole("button", { name: /afficher le calendrier/i }));
    const after = container.querySelector(".calendly-inline-widget") as HTMLElement;
    expect({ h: after.style.height, w: after.style.minWidth }).toEqual(beforeBox);
  });

  it("n'utilise pas l'appariement de couleurs bg-terracotta/text-paper (contraste axe, /fr/appel auditée)", () => {
    const { container } = setup();
    const btn = screen.getByRole("button", { name: /afficher le calendrier/i });
    expect(btn.className).toContain("text-mocha-fg");
    expect(container.innerHTML).not.toContain("bg-terracotta text-paper");
  });
});
