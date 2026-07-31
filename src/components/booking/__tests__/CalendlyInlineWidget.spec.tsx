/**
 * L'aiguillage d'ADR 0038 : créneaux si l'API répond, placeholder d'ADR 0034
 * sinon. C'est le point où une régression serait la plus coûteuse et la moins
 * visible — un `ok: false` mal traité laisserait /appel vide, et un throw non
 * rattrapé casserait le funnel unique du site.
 *
 * Vérifié en complément par un rendu Next réel (dev, sans jeton) : la page
 * répond 200 et n'émet ni `calendly-inline-widget` ni `assets.calendly.com`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const fetchAvailableSlotsMock = vi.fn();
vi.mock("@/server/calendly/availability", () => ({
  fetchAvailableSlots: (...args: unknown[]) => fetchAvailableSlotsMock(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { CalendlyInlineWidget } from "../CalendlyInlineWidget";

const URL_PUBLIC = "https://calendly.com/axion-ia/premier-contact";

const DAYS = [
  {
    dateKey: "2026-08-04",
    slots: [{ startIso: "2026-08-04T07:00:00.000Z", schedulingUrl: `${URL_PUBLIC}/x` }],
  },
];

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Pas de valeur par défaut sur `url` : passer `undefined` à un paramètre qui en
// a une le remplace par cette valeur, et le test « sans URL configurée »
// testerait alors exactement le contraire de ce qu'il annonce.
async function renderWidget(url: string | undefined) {
  return render(await CalendlyInlineWidget({ calendlyUrl: url, isFr: true, height: 720 }));
}

describe("CalendlyInlineWidget — aiguillage", () => {
  it("API OK : affiche les créneaux, et AUCUN écran de consentement", async () => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: true, days: DAYS });
    await renderWidget(URL_PUBLIC);

    expect(screen.getByText(/Choisissez votre créneau/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /09:00/ })).toBeInTheDocument();
    // Le pavé d'ADR 0034 ne doit pas coexister avec le calendrier.
    expect(screen.queryByRole("button", { name: /afficher le calendrier/i })).toBeNull();
  });

  it.each([
    ["jeton absent (cas du build)", "not_configured"],
    ["plan sans accès à l'API", "forbidden"],
    ["API injoignable", "api_error"],
    ["agenda plein", "no_slots"],
    ["event-type introuvable", "no_event_type"],
  ])("API en échec — %s : retombe sur le placeholder d'ADR 0034", async (_l, reason) => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: false, reason });
    await renderWidget(URL_PUBLIC);

    expect(screen.getByRole("button", { name: /afficher le calendrier/i })).toBeInTheDocument();
    expect(screen.queryByText(/Choisissez votre créneau/i)).toBeNull();
  });

  it("dans le repli, rien de Calendly n'est émis avant le clic (PIÈGE 1 d'ADR 0034)", async () => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: false, reason: "not_configured" });
    const { container } = await renderWidget(URL_PUBLIC);

    expect(container.querySelector(".calendly-inline-widget")).toBeNull();
    expect(container.querySelector("[data-url]")).toBeNull();
  });

  it("sans URL publique configurée : n'interroge même pas l'API", async () => {
    await renderWidget(undefined);

    expect(fetchAvailableSlotsMock).not.toHaveBeenCalled();
    expect(screen.getByText(/temporairement indisponible/i)).toBeInTheDocument();
  });

  it("aucun lien de créneau ne traîne nos paramètres d'embed", async () => {
    // Le lien « toutes les disponibilités » a été retiré le 2026-07-31, et avec
    // lui le test qui gardait ce point. L'inquiétude, elle, reste entière et se
    // reporte sur les liens de créneaux : `hide_gdpr_banner` & co. n'ont de sens
    // que dans l'iframe. Les traîner dans une navigation utilisateur masquerait
    // la notice native de Calendly — alors que, cette fois, plus rien de notre
    // côté ne la remplace, la mention du pied de boîte ayant elle aussi disparu.
    fetchAvailableSlotsMock.mockResolvedValue({ ok: true, days: DAYS });
    const { container } = await renderWidget(URL_PUBLIC);

    const liens = [...container.querySelectorAll('a[href^="https://calendly.com"]')];
    expect(liens.length).toBeGreaterThan(0);
    for (const a of liens) {
      const href = a.getAttribute("href") ?? "";
      expect(href).not.toContain("hide_gdpr_banner");
      expect(href).not.toContain("embed_domain");
      expect(href).not.toContain("embed_type");
    }
  });
});
