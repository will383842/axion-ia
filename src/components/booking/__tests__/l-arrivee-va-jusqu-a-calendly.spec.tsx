/**
 * L'UTM d'ARRIVÉE va jusqu'à Calendly (chantier « Types de rendez-vous », L5a,
 * relecture de la PR 1293).
 *
 * Drapeau de réservation directe éteint (valeur par défaut) : le visiteur
 * arrivé sur `/fr/appel?utm_source=linkedin&utm_campaign=x` réserve CHEZ
 * Calendly. Le sondage ne relit que le `tracking` de l'invité, donc que les UTM
 * présentes dans l'URL Calendly. Avant : seule `utm_content` y était — la
 * source et la campagne se perdaient au dernier clic.
 *
 * Garde : créneau, iframe et lien de secours portent `utm_source`,
 * `utm_medium`, `utm_campaign` à côté de `utm_content` (le bouton), et jamais
 * `ref` (Calendly ne le reprend pas).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const fetchAvailableSlotsMock = vi.fn();
vi.mock("@/server/calendly/availability", () => ({
  fetchAvailableSlots: (...args: unknown[]) => fetchAvailableSlotsMock(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// L'iframe n'est posée qu'après consentement : on lit l'URL que le widget
// confie au pavé, telle qu'elle partira chez Calendly.
const gateProps: Array<{ url: string; fallbackUrl: string }> = [];
vi.mock("../CalendlyConsentGate", () => ({
  CalendlyConsentGate: (p: { url: string; fallbackUrl: string }) => {
    gateProps.push(p);
    return <a href={p.fallbackUrl}>secours</a>;
  },
}));

import { CalendlyInlineWidget } from "../CalendlyInlineWidget";

const DIAG = "https://calendly.com/axion-ia/diagnostic-ia";
const DAYS = [
  {
    dateKey: "2026-08-04",
    slots: [{ startIso: "2026-08-04T07:00:00.000Z", schedulingUrl: `${DIAG}/x` }],
  },
];
const SUIVI = { utm_source: "linkedin", utm_medium: "social", utm_campaign: "x", ref: "p-42" };

function verifier(href: string | null | undefined) {
  const p = new URL(href ?? "").searchParams;
  expect(p.get("utm_content")).toBe("diagnostic");
  expect(p.get("utm_source")).toBe("linkedin");
  expect(p.get("utm_medium")).toBe("social");
  expect(p.get("utm_campaign")).toBe("x");
  expect(p.get("ref")).toBeNull();
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  gateProps.length = 0;
});

describe("🔑 l'UTM d'arrivée va jusqu'à Calendly", () => {
  it("créneau qui part chez Calendly", async () => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: true, days: DAYS });
    const { container } = render(
      await CalendlyInlineWidget({
        calendlyUrl: DIAG,
        isFr: true,
        utmContent: "diagnostic",
        suivi: SUIVI,
      }),
    );
    verifier(container.querySelector('a[data-cta="appel_slot_pick"]')?.getAttribute("href"));
  });

  it("iframe et lien de secours", async () => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: false, reason: "api_error" });
    render(
      await CalendlyInlineWidget({
        calendlyUrl: DIAG,
        isFr: true,
        utmContent: "diagnostic",
        suivi: SUIVI,
      }),
    );
    expect(gateProps).toHaveLength(1);
    verifier(gateProps[0]?.url);
    verifier(gateProps[0]?.fallbackUrl);
  });

  it("sans arrivée : les URL d'avant, inchangées", async () => {
    fetchAvailableSlotsMock.mockResolvedValue({ ok: false, reason: "api_error" });
    render(await CalendlyInlineWidget({ calendlyUrl: DIAG, isFr: true }));
    expect(gateProps[0]?.fallbackUrl).toBe(DIAG);
    expect(new URL(gateProps[0]?.url ?? "").searchParams.get("utm_source")).toBeNull();
  });
});
